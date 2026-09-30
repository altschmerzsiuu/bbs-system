-- 0027_fix_notification_aggregate.sql
-- Correct aggregate_type and aggregate_id mapping for all notification events.


-- ---------------------------------------------------------------------------
-- 1. approve_booking (from 0007_domain_functions.sql)
-- Modified to insert BOOKING_CONFIRMED (Owner + Member Participants)
-- ---------------------------------------------------------------------------
create or replace function approve_booking(p_booking_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
  v_slot    session_slots%rowtype;
  p         record;
  v_available int;
  v_history_id uuid;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;
  if v_booking.status <> 'PENDING' then perform raise_domain_error('INVALID_BOOKING_STATUS'); end if;

  select * into v_slot from session_slots where id = v_booking.slot_id for update;
  if not v_slot.is_open then perform raise_domain_error('SLOT_CLOSED'); end if;
  if slot_occupancy(v_slot.id) > v_slot.capacity then perform raise_domain_error('SLOT_FULL'); end if;

  -- Revalidate and reserve one credit per MEMBER participant, independently.
  for p in
    select bp.*, m.end_date, m.status as ms_status
    from booking_participants bp
    join memberships m on m.id = bp.membership_id
    where bp.booking_id = p_booking_id and bp.participant_type = 'MEMBER'
    order by bp.membership_id
  loop
    perform 1 from memberships where id = p.membership_id for update;
    if p.ms_status <> 'ACTIVE' or v_slot.slot_date > p.end_date then
      perform raise_domain_error('MEMBERSHIP_EXPIRED');
    end if;
    select available into v_available from membership_credit_state(p.membership_id);
    if v_available <= 0 then perform raise_domain_error('INSUFFICIENT_CREDITS'); end if;

    insert into membership_credit_ledger
      (membership_id, member_id, booking_id, participant_id, txn_type, delta_reserved, reason, actor_id)
    values (p.membership_id, p.member_id, p_booking_id, p.id, 'SESSION_RESERVED', 1,
            'booking approved', p_actor_id);
  end loop;

  update bookings set status = 'CONFIRMED', pending_expires_at = null, updated_at = now()
   where id = p_booking_id;
  
  insert into booking_status_history (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, 'PENDING', 'CONFIRMED', p_actor_id)
  returning id into v_history_id;

  -- NOTIFICATION INSTRUMENTATION
  -- Notify Owner
  insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
  values ('BOOKING_CONFIRMED', 'booking', p_booking_id, v_booking.created_by, 'FCM', jsonb_build_object(
    'booking_id', p_booking_id,
    'slot_date', v_slot.slot_date,
    'start_time', v_slot.start_time
  )) on conflict do nothing;

  -- Notify Member Participants (excluding owner to avoid duplicates)
  insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
  select 'BOOKING_CONFIRMED', 'booking', p_booking_id, m.user_id, 'FCM', jsonb_build_object(
    'booking_id', p_booking_id,
    'slot_date', v_slot.slot_date,
    'start_time', v_slot.start_time
  )
  from booking_participants bp
  join members m on m.id = bp.member_id
  where bp.booking_id = p_booking_id and bp.participant_type = 'MEMBER'
    and m.user_id != v_booking.created_by
  on conflict do nothing;

end $$;


-- ---------------------------------------------------------------------------
-- 2. reject_booking (from 0012_booking_features.sql)
-- Modified to insert BOOKING_REJECTED (Owner ONLY)
-- ---------------------------------------------------------------------------
create or replace function reject_booking(p_booking_id uuid, p_actor_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
  v_slot    session_slots%rowtype;
  v_history_id uuid;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;
  if v_booking.status <> 'PENDING' then perform raise_domain_error('INVALID_BOOKING_STATUS'); end if;

  select * into v_slot from session_slots where id = v_booking.slot_id;

  update bookings 
  set status = 'REJECTED', 
      pending_expires_at = null,
      cancellation_reason = p_reason,
      cancelled_by = p_actor_id,
      cancelled_at = now(),
      updated_at = now()
  where id = p_booking_id;

  insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  values (p_booking_id, 'PENDING', 'REJECTED', p_actor_id, coalesce(p_reason, 'admin rejection'))
  returning id into v_history_id;

  -- NOTIFICATION INSTRUMENTATION (Owner ONLY)
  insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
  values ('BOOKING_REJECTED', 'booking', p_booking_id, v_booking.created_by, 'FCM', jsonb_build_object(
    'booking_id', p_booking_id,
    'slot_date', v_slot.slot_date,
    'start_time', v_slot.start_time,
    'reason', p_reason
  )) on conflict do nothing;

end $$;


-- ---------------------------------------------------------------------------
-- 3. cancel_booking (from 0014_booking_ownership.sql)
-- Modified to insert BOOKING_BBS_CANCELLED (Owner + Member Participants) ONLY if p_source = 'BBS'
-- ---------------------------------------------------------------------------
create or replace function cancel_booking(
  p_booking_id uuid, p_actor_id uuid, p_source text, p_reason text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
  v_slot    session_slots%rowtype;
  v_deadline_hours int := setting_int('cancellation_deadline_hours', 6);
  v_starts_at timestamptz;
  v_late boolean;
  v_new_status booking_status;
  p record;
  v_history_id uuid;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;
  
  -- AUTHORIZATION: Member can only cancel their own booking
  if p_source = 'MEMBER' and v_booking.created_by != p_actor_id then
    perform raise_domain_error('FORBIDDEN');
  end if;

  if v_booking.status not in ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED') then
    perform raise_domain_error('INVALID_BOOKING_STATUS');
  end if;

  select * into v_slot from session_slots where id = v_booking.slot_id;
  v_starts_at := (v_slot.slot_date + v_slot.start_time) at time zone 'Asia/Jakarta';
  v_late := (p_source = 'MEMBER')
            and now() > v_starts_at - (v_deadline_hours || ' hours')::interval;
  v_new_status := case when p_source = 'BBS' then 'BBS_CANCELLED' else 'MEMBER_CANCELLED' end;

  for p in
    select bp.* from booking_participants bp
    where bp.booking_id = p_booking_id and bp.participant_type = 'MEMBER'
    order by bp.membership_id
  loop
    -- Only settle participants that actually hold a reservation.
    if exists (select 1 from membership_credit_ledger
               where participant_id = p.id and txn_type = 'SESSION_RESERVED') then
      if v_late then
        insert into membership_credit_ledger
          (membership_id, member_id, booking_id, participant_id, txn_type,
           delta_reserved, delta_consumed, reason, actor_id)
        values (p.membership_id, p.member_id, p_booking_id, p.id, 'LATE_CANCELLATION',
                -1, 1, p_reason, p_actor_id);
      else
        insert into membership_credit_ledger
          (membership_id, member_id, booking_id, participant_id, txn_type,
           delta_reserved, reason, actor_id)
        values (p.membership_id, p.member_id, p_booking_id, p.id,
                case when p_source = 'BBS' then 'BBS_CANCELLATION_RETURN'
                     else 'EARLY_CANCELLATION_RETURN' end,
                -1, p_reason, p_actor_id);
      end if;
    end if;
  end loop;

  update bookings
     set status = v_new_status, cancellation_reason = p_reason,
         cancelled_by = p_actor_id, cancelled_at = now(), updated_at = now()
   where id = p_booking_id;
   
  insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  values (p_booking_id, v_booking.status, v_new_status, p_actor_id, p_reason)
  returning id into v_history_id;

  -- NOTIFICATION INSTRUMENTATION
  if p_source = 'BBS' then
    -- Notify Owner
    insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
    values ('BOOKING_BBS_CANCELLED', 'booking', p_booking_id, v_booking.created_by, 'FCM', jsonb_build_object(
      'booking_id', p_booking_id,
      'slot_date', v_slot.slot_date,
      'start_time', v_slot.start_time,
      'reason', p_reason
    )) on conflict do nothing;

    -- Notify Member Participants
    insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
    select 'BOOKING_BBS_CANCELLED', 'booking', p_booking_id, m.user_id, 'FCM', jsonb_build_object(
      'booking_id', p_booking_id,
      'slot_date', v_slot.slot_date,
      'start_time', v_slot.start_time,
      'reason', p_reason
    )
    from booking_participants bp
    join members m on m.id = bp.member_id
    where bp.booking_id = p_booking_id and bp.participant_type = 'MEMBER'
      and m.user_id != v_booking.created_by
    on conflict do nothing;
  end if;

  return case when v_late then 'LATE' else 'EARLY' end;
end $$;


-- ---------------------------------------------------------------------------
-- 4. approve_reschedule (from 0007_domain_functions.sql)
-- Modified to insert RESCHEDULE_APPROVED (Owner + Member Participants)
-- ---------------------------------------------------------------------------
create or replace function approve_reschedule(p_booking_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
  v_new_slot session_slots%rowtype;
  v_old_slot session_slots%rowtype;
  v_participants int;
  v_history_id uuid;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if v_booking.status <> 'RESCHEDULE_REQUESTED' then
    perform raise_domain_error('INVALID_RESCHEDULE');
  end if;
  if v_booking.requested_slot_id is null then perform raise_domain_error('INVALID_RESCHEDULE'); end if;

  select * into v_new_slot from session_slots where id = v_booking.requested_slot_id for update;
  if not found or not v_new_slot.is_open then perform raise_domain_error('SLOT_CLOSED'); end if;
  select count(*) into v_participants from booking_participants where booking_id = p_booking_id;
  if slot_occupancy(v_new_slot.id) + v_participants > v_new_slot.capacity then
    perform raise_domain_error('SLOT_FULL');
  end if;
  
  select * into v_old_slot from session_slots where id = v_booking.slot_id;

  insert into booking_slot_history (booking_id, from_slot_id, to_slot_id, actor_id, reason)
  values (p_booking_id, v_booking.slot_id, v_new_slot.id, p_actor_id, 'reschedule approved');

  -- Credit reservation is untouched: the same reservation follows the booking.
  update bookings set slot_id = v_new_slot.id, requested_slot_id = null,
         status = 'CONFIRMED', updated_at = now()
   where id = p_booking_id;
   
  insert into booking_status_history (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, 'RESCHEDULE_REQUESTED', 'CONFIRMED', p_actor_id)
  returning id into v_history_id;

  -- NOTIFICATION INSTRUMENTATION
  -- Notify Owner
  insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
  values ('RESCHEDULE_APPROVED', 'booking', p_booking_id, v_booking.created_by, 'FCM', jsonb_build_object(
    'booking_id', p_booking_id,
    'old_slot_date', v_old_slot.slot_date,
    'old_start_time', v_old_slot.start_time,
    'new_slot_date', v_new_slot.slot_date,
    'new_start_time', v_new_slot.start_time
  )) on conflict do nothing;

  -- Notify Member Participants
  insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
  select 'RESCHEDULE_APPROVED', 'booking', p_booking_id, m.user_id, 'FCM', jsonb_build_object(
    'booking_id', p_booking_id,
    'old_slot_date', v_old_slot.slot_date,
    'old_start_time', v_old_slot.start_time,
    'new_slot_date', v_new_slot.slot_date,
    'new_start_time', v_new_slot.start_time
  )
  from booking_participants bp
  join members m on m.id = bp.member_id
  where bp.booking_id = p_booking_id and bp.participant_type = 'MEMBER'
    and m.user_id != v_booking.created_by
  on conflict do nothing;

end $$;


-- ---------------------------------------------------------------------------
-- 5. reject_reschedule (from 0012_booking_features.sql)
-- Modified to insert RESCHEDULE_REJECTED (Owner ONLY)
-- ---------------------------------------------------------------------------
create or replace function reject_reschedule(p_booking_id uuid, p_actor_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
  v_requested_slot session_slots%rowtype;
  v_history_id uuid;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;
  if v_booking.status <> 'RESCHEDULE_REQUESTED' then perform raise_domain_error('INVALID_BOOKING_STATUS'); end if;

  select * into v_requested_slot from session_slots where id = v_booking.requested_slot_id;

  update bookings 
  set status = 'CONFIRMED', 
      requested_slot_id = null,
      updated_at = now()
  where id = p_booking_id;

  insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  values (p_booking_id, 'RESCHEDULE_REQUESTED', 'CONFIRMED', p_actor_id, coalesce(p_reason, 'reschedule rejected'))
  returning id into v_history_id;

  -- NOTIFICATION INSTRUMENTATION
  insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
  values ('RESCHEDULE_REJECTED', 'booking', p_booking_id, v_booking.created_by, 'FCM', jsonb_build_object(
    'booking_id', p_booking_id,
    'requested_slot_date', v_requested_slot.slot_date,
    'requested_start_time', v_requested_slot.start_time,
    'reason', p_reason
  )) on conflict do nothing;

end $$;


-- ---------------------------------------------------------------------------
-- 6. activate_membership (from 0011_membership_applications.sql)
-- Modified to insert MEMBERSHIP_ACTIVATED
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- 7. activate_pending_memberships (from 0015_automation_cron.sql)
-- Modified to insert MEMBERSHIP_ACTIVATED
-- ---------------------------------------------------------------------------
create or replace function activate_pending_memberships() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m record; 
  v_activated int := 0;
  v_skipped int := 0;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_plan record;
  v_user_id uuid;
begin
  for m in select * from memberships
           where status = 'PENDING_ACTIVATION'
             and start_date <= v_today
           for update loop
    
    -- Invariant: Must NOT activate if an ACTIVE membership already exists for this member
    if not exists (
      select 1 from memberships
      where member_id = m.member_id and status = 'ACTIVE'
    ) then
      update memberships set status = 'ACTIVE', updated_at = now() where id = m.id;
      
      -- NOTIFICATION INSTRUMENTATION
      select user_id into v_user_id from members where id = m.member_id;
      select * into v_plan from membership_plans where id = m.plan_id;
      
      insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
      values ('MEMBERSHIP_ACTIVATED', 'membership', m.id, v_user_id, 'FCM', jsonb_build_object(
        'membership_id', m.id,
        'plan_name', v_plan.name,
        'start_date', m.start_date,
        'end_date', m.end_date
      )) on conflict do nothing;

      v_activated := v_activated + 1;
    else
      -- Do NOT mutate the pending membership, just skip it and report the conflict
      v_skipped := v_skipped + 1;
    end if;
  end loop;
  
  return jsonb_build_object(
    'activated', v_activated,
    'skipped_due_to_conflict', v_skipped
  );
end $$;


-- ---------------------------------------------------------------------------
-- 8. Membership Application Triggers
-- ---------------------------------------------------------------------------
create or replace function trg_membership_application_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_event_type text;
begin
  -- Only fire if status actually changed
  if TG_OP = 'UPDATE' and OLD.status = NEW.status then
    return NEW;
  end if;

  if TG_OP = 'UPDATE' and NEW.status in ('APPROVED', 'PAYMENT_CONFIRMED', 'REJECTED') then
    select user_id into v_user_id from members where id = NEW.member_id;

    v_event_type := 'MEMBERSHIP_APPLICATION_' || NEW.status;

    insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
    values (v_event_type, 'membership_application', NEW.id, v_user_id, 'FCM', jsonb_build_object(
      'application_id', NEW.id,
      'plan_id', NEW.requested_plan_id
    )) on conflict do nothing;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_membership_application_notifications on membership_applications;
create trigger trg_membership_application_notifications
  after update on membership_applications
  for each row execute function trg_membership_application_notifications();
