-- 0045_fix_activate_membership.sql
-- Corrective migration for activate_membership().
--
-- Background: 0043 (early renewal / zero-credit top-up) was authored from a stale
-- baseline and regressed the last known-good definition (0030):
--   * lost `v_has_active := FOUND` -> `v_current_membership is not null` is false for any
--     record containing a NULL column, so the renewal branches never ran and activation
--     tried to INSERT a 2nd ACTIVE row (memberships_one_active_per_member violation);
--   * lost `set search_path = public` on a SECURITY DEFINER function.
--
-- 0043 is already physically applied in Production and is intentionally NOT edited.
-- This migration = 0030 hardening + 0043 intended renewal behaviour.
--
-- Notification ownership: activate_membership() deliberately does NOT enqueue any
-- notification (0030 did; 0043 dropped it and that stays dropped).
-- confirm_and_activate_membership() (0046) owns the MEMBERSHIP_ACTIVATED outbox + inbox
-- rows, so one activation yields exactly one push and one in-app notification.

create or replace function activate_membership(
  p_application_id uuid,
  p_admin_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_app record;
  v_plan record;
  v_current_membership record;
  v_new_membership_id uuid;
  v_start_date date;
  v_end_date date;
  v_status membership_status;
  v_available int;
  v_has_active boolean;
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

  -- 3. Check member's current active membership.
  -- NOTE: use FOUND, not `record is not null` (which is false if ANY field is NULL).
  select * into v_current_membership
  from memberships
  where member_id = v_app.member_id and status = 'ACTIVE'
  for update;

  v_has_active := FOUND;

  if v_has_active then
    -- Check if they have credits left
    select available into v_available from membership_credit_state(v_current_membership.id);

    if v_available <= 0 then
      -- Top-up Scenario: out of credits but still active.
      -- Expire the old one immediately so the new one takes effect today.
      update memberships
      set status = 'EXPIRED', updated_at = now()
      where id = v_current_membership.id;

      v_status := 'ACTIVE';
      v_start_date := current_date;

      -- Preserve remaining days by extending from the old end_date
      if v_current_membership.end_date >= current_date then
        v_end_date := v_current_membership.end_date + (v_plan.duration_months || ' months')::interval;
      else
        v_end_date := current_date + (v_plan.duration_months || ' months')::interval;
      end if;
    else
      -- Early Renewal Scenario: credits remain, queue as PENDING_ACTIVATION
      v_status := 'PENDING_ACTIVATION';
      if v_current_membership.end_date >= current_date then
        v_start_date := v_current_membership.end_date + interval '1 day';
      else
        v_start_date := current_date;
      end if;
      v_end_date := v_start_date + (v_plan.duration_months || ' months')::interval;
    end if;
  else
    -- Expired / No Active Membership (Scenario A)
    v_status := 'ACTIVE';
    v_start_date := current_date;
    v_end_date := v_start_date + (v_plan.duration_months || ' months')::interval;
  end if;

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
