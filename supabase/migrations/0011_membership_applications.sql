-- 0011_membership_applications.sql

-- Add PENDING_ACTIVATION to membership_status if not exists
ALTER TYPE membership_status ADD VALUE IF NOT EXISTS 'PENDING_ACTIVATION';

-- Safely rename table and preserve history
ALTER TABLE renewal_requests RENAME TO membership_applications;

-- Rename constraints and primary keys
ALTER INDEX IF EXISTS renewal_requests_pkey RENAME TO membership_applications_pkey;

-- Add application_type
ALTER TABLE membership_applications 
ADD COLUMN IF NOT EXISTS application_type text not null default 'NEW' 
CHECK (application_type IN ('NEW', 'RENEWAL'));

-- Safely swap status constraints
ALTER TABLE membership_applications DROP CONSTRAINT IF EXISTS renewal_requests_status_check;
ALTER TABLE membership_applications DROP CONSTRAINT IF EXISTS membership_applications_status_check;
ALTER TABLE membership_applications ADD CONSTRAINT membership_applications_status_check CHECK (
  status IN ('PENDING_REVIEW', 'APPROVED', 'PAYMENT_CONFIRMED', 'ACTIVATED', 'REJECTED', 'CANCELLED')
);

-- Add partial unique index for concurrency protection
CREATE UNIQUE INDEX IF NOT EXISTS membership_apps_one_active_per_member 
ON membership_applications (member_id) 
WHERE status IN ('PENDING_REVIEW', 'APPROVED', 'PAYMENT_CONFIRMED');

-- Rename RLS Policies
ALTER POLICY renewals_owner ON membership_applications RENAME TO membership_applications_owner;
ALTER POLICY renewals_admin ON membership_applications RENAME TO membership_applications_admin;

-- RPC for Atomic Activation
create or replace function activate_membership(
  p_application_id uuid,
  p_admin_id uuid
) returns void
language plpgsql security definer as $$
declare
  v_app record;
  v_plan record;
  v_current_membership record;
  v_new_membership_id uuid;
  v_start_date date;
  v_end_date date;
  v_status membership_status;
begin
  -- 1. Lock the application
  select * into v_app
  from membership_applications
  where id = p_application_id
  for update;

  if v_app is null then
    raise exception 'APPLICATION_NOT_FOUND';
  end if;

  if v_app.status != 'PAYMENT_CONFIRMED' then
    raise exception 'INVALID_APPLICATION_STATUS';
  end if;

  -- 2. Get plan details
  select * into v_plan
  from membership_plans
  where id = v_app.requested_plan_id;

  -- 3. Check member's current active membership
  select * into v_current_membership
  from memberships
  where member_id = v_app.member_id and status = 'ACTIVE'
  for update;

  if v_current_membership is not null then
    -- Early Renewal (Scenario B)
    v_status := 'PENDING_ACTIVATION';
    if v_current_membership.end_date >= current_date then
      v_start_date := v_current_membership.end_date + interval '1 day';
    else
      v_start_date := current_date;
    end if;
  else
    -- Expired / No Active Membership (Scenario A)
    v_status := 'ACTIVE';
    v_start_date := current_date;
  end if;

  v_end_date := v_start_date + (v_plan.duration_months || ' months')::interval;

  -- 4. Insert membership
  insert into memberships (
    member_id, plan_id, status, start_date, end_date,
    allocated_credits, price_paid_idr, previous_membership_id,
    activated_by, activated_at
  ) values (
    v_app.member_id, v_app.requested_plan_id, v_status, v_start_date, v_end_date,
    v_plan.credits, v_app.final_price_idr, v_app.previous_membership_id,
    p_admin_id, now()
  ) returning id into v_new_membership_id;

  -- 5. Create Ledger Entry for allocation
  insert into membership_credit_ledger (
    membership_id, member_id, txn_type, delta_allocated, reason, actor_id
  ) values (
    v_new_membership_id, v_app.member_id, 'MEMBERSHIP_ALLOCATION', v_plan.credits, 'Membership Activation', p_admin_id
  );

  -- 6. Update Application
  update membership_applications
  set status = 'ACTIVATED',
      new_membership_id = v_new_membership_id,
      updated_at = now()
  where id = p_application_id;
end;
$$;
