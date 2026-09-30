-- 0030_fix_activate_membership_record_null_check.sql
-- Fix PL/pgSQL bug where `v_current_membership is not null` evaluates to false
-- if the record contains any null fields (like previous_membership_id).

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
  v_user_id uuid;
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

  -- Resolve user_id early for notification
  select user_id into v_user_id from members where id = v_app.member_id;

  -- 2. Get plan details
  select * into v_plan
  from membership_plans
  where id = v_app.requested_plan_id;

  -- 3. Check member's current active membership
  select * into v_current_membership
  from memberships
  where member_id = v_app.member_id and status = 'ACTIVE'
  for update;
  
  v_has_active := FOUND;

  if v_has_active then
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

  -- NOTIFICATION INSTRUMENTATION
  if v_status = 'ACTIVE' then
    insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
    values ('MEMBERSHIP_ACTIVATED', 'membership', v_new_membership_id, v_user_id, 'FCM', jsonb_build_object(
      'membership_id', v_new_membership_id,
      'plan_name', v_plan.name,
      'start_date', v_start_date,
      'end_date', v_end_date
    )) on conflict do nothing;
  end if;

end;
$$;
