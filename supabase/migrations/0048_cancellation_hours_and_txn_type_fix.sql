-- 0048_cancellation_hours_and_txn_type_fix.sql
-- 1. Add cancellation_hours and photographer_enabled settings to site_settings
ALTER TABLE site_settings 
ADD COLUMN IF NOT EXISTS cancellation_hours integer not null default 8,
ADD COLUMN IF NOT EXISTS photographer_enabled boolean not null default true;

-- 2. Fix cancel_booking RPC enum casting (credit_txn_type) & dynamic cancellation_hours
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id uuid, 
  p_actor_id uuid, 
  p_source text, 
  p_reason text
) RETURNS text
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public AS $$
declare
  v_booking bookings%rowtype;
  v_slot    session_slots%rowtype;
  v_deadline_hours int := 8;
  v_starts_at timestamptz;
  v_late boolean;
  v_new_status booking_status;
  p record;
  v_is_participant boolean;
begin
  -- Fetch dynamic cancellation_hours from site_settings (default 8)
  select coalesce(cancellation_hours, 8) into v_deadline_hours from site_settings where id = 1;
  if v_deadline_hours is null then
    v_deadline_hours := 8;
  end if;

  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;

  -- AUTHORIZATION: Member can cancel if they created it OR if they are a participant
  if p_source = 'MEMBER' then
    select exists (
      select 1 from booking_participants bp
      join members m on m.id = bp.member_id
      where bp.booking_id = p_booking_id and m.user_id = p_actor_id
    ) into v_is_participant;

    if v_booking.created_by != p_actor_id and not v_is_participant then
      perform raise_domain_error('FORBIDDEN');
    end if;
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
               where participant_id = p.id and txn_type = 'SESSION_RESERVED'::credit_txn_type) then
      if v_late then
        insert into membership_credit_ledger
          (membership_id, member_id, booking_id, participant_id, txn_type,
           delta_reserved, delta_consumed, reason, actor_id)
        values (p.membership_id, p.member_id, p_booking_id, p.id, 'LATE_CANCELLATION'::credit_txn_type,
                -1, 1, p_reason, p_actor_id);
      else
        insert into membership_credit_ledger
          (membership_id, member_id, booking_id, participant_id, txn_type,
           delta_reserved, reason, actor_id)
        values (p.membership_id, p.member_id, p_booking_id, p.id,
                (case when p_source = 'BBS' then 'BBS_CANCELLATION_RETURN'
                     else 'EARLY_CANCELLATION_RETURN' end)::credit_txn_type,
                -1, p_reason, p_actor_id);
      end if;
    end if;
  end loop;

  update bookings
     set status = v_new_status, cancellation_reason = p_reason,
         cancelled_by = p_actor_id, cancelled_at = now(), updated_at = now()
   where id = p_booking_id;
  insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  values (p_booking_id, v_booking.status, v_new_status, p_actor_id, p_reason);

  return case when v_late then 'LATE' else 'EARLY' end;
end $$;

-- 3. Ensure create_member_booking uses 'FCM' channel for admin notifications
CREATE OR REPLACE FUNCTION public.create_member_booking(
  p_booking_owner_id uuid, 
  p_slot_id uuid, 
  p_participants jsonb, 
  p_actor_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_slot session_slots%rowtype;
  v_available int;
  v_booking_id uuid;
  v_window_days int := setting_int('booking_window_days', 7);
  v_max_active int := setting_int('max_active_future_bookings', 2);
  v_timeout_min int := setting_int('pending_timeout_minutes', 1440);
  v_max_weekly_sessions int := 2;
  v_active_count int;
  v_weekly_count int;
  v_num_participants int;
  v_participant jsonb;
  v_member_id uuid;
  v_membership memberships%rowtype;
  v_casual_id uuid;
  v_slot_week_start date;
  v_slot_week_end date;
  v_admin_user_id uuid;
  v_has_premium boolean;
begin
  v_num_participants := jsonb_array_length(p_participants);
  if v_num_participants = 0 then
    perform raise_domain_error('NO_PARTICIPANTS');
  end if;

  -- 0. Concurrency Lock
  perform 1 from users where id = p_actor_id for update;

  -- 1. Lock the slot: capacity decisions serialise here.
  select * into v_slot from session_slots where id = p_slot_id for update;
  if not found then perform raise_domain_error('SLOT_NOT_FOUND'); end if;
  if not v_slot.is_open then perform raise_domain_error('SLOT_CLOSED'); end if;

  -- 2. Booking window
  if v_slot.slot_date < current_date then perform raise_domain_error('SLOT_IN_PAST'); end if;
  if v_slot.slot_date > current_date + (v_window_days || ' days')::interval then
    perform raise_domain_error('BOOKING_WINDOW_EXCEEDED');
  end if;

  -- 3A. Constraint A: Active future booking limit (Applies only to the booking owner)
  select count(*) into v_active_count
  from bookings b
  where b.created_by = p_actor_id
    and b.status in ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED')
    and exists (
      select 1 from session_slots s where s.id = b.slot_id and (s.slot_date + s.start_time) > now()
    );

  -- Dynamic weekly limit from site_settings (default 2)
  select coalesce(max_weekly_bookings, 2) into v_max_weekly_sessions from site_settings where id = 1;
  if v_max_weekly_sessions is null then
    v_max_weekly_sessions := 2;
  end if;

  -- Premium members (SILVER / GOLD) have no weekly or active limits
  select exists (
    select 1 from memberships ms
    join membership_plans mp on mp.id = ms.plan_id
    join members m on m.id = ms.member_id
    where m.user_id = p_actor_id
      and ms.status = 'ACTIVE'
      and mp.name ilike any (array['%SILVER%', '%GOLD%'])
  ) into v_has_premium;

  if v_has_premium then
    v_max_active := 999;
    v_max_weekly_sessions := 999;
  end if;

  if v_active_count >= v_max_active then
    perform raise_domain_error('ACTIVE_BOOKING_LIMIT_REACHED');
  end if;

  -- 3B. Constraint B: Weekly frequency limit (Applies only to the booking owner)
  v_slot_week_start := date_trunc('week', v_slot.slot_date::timestamp)::date;
  v_slot_week_end := v_slot_week_start + interval '6 days';

  select count(distinct b.id) into v_weekly_count
  from bookings b
  join session_slots s on s.id = b.slot_id
  where b.created_by = p_actor_id
    and b.status in ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED','COMPLETED')
    and s.slot_date >= v_slot_week_start
    and s.slot_date <= v_slot_week_end;

  if v_weekly_count >= v_max_weekly_sessions then
    perform raise_domain_error('WEEKLY_LIMIT_EXCEEDED');
  end if;

  -- 4. Capacity check
  select count(*) into v_available
  from booking_participants bp
  join bookings b on b.id = bp.booking_id
  where b.slot_id = p_slot_id
    and b.status in ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED');

  if (v_available + v_num_participants) > v_slot.capacity then
    perform raise_domain_error('CAPACITY_EXCEEDED');
  end if;

  -- 5. Insert booking with PENDING status (Requires Admin Approval)
  insert into bookings (
    slot_id, 
    created_by, 
    status, 
    requires_approval, 
    expires_at
  )
  values (
    p_slot_id, 
    p_actor_id, 
    'PENDING', 
    true, 
    now() + (v_timeout_min || ' minutes')::interval
  )
  returning id into v_booking_id;

  -- 6. Process participants
  for v_participant in select * from jsonb_array_elements(p_participants) loop
    if v_participant->>'type' = 'MEMBER' then
      v_member_id := (v_participant->>'member_id')::uuid;

      -- Check for DOUBLE BOOKING for the same slot
      if exists (
        select 1
        from booking_participants bp
        join bookings b on b.id = bp.booking_id
        where bp.member_id = v_member_id
          and b.slot_id = p_slot_id
          and b.status in ('PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED')
      ) then
        perform raise_domain_error('ALREADY_BOOKED_FOR_SLOT');
      end if;

      -- Validate member exists and has an ACTIVE membership covering the date
      select * into v_membership from memberships
      where member_id = v_member_id and status = 'ACTIVE' for update;

      if not found or v_slot.slot_date > v_membership.end_date then
        perform raise_domain_error('MEMBERSHIP_EXPIRED');
      end if;

      -- Validate credit availability (does NOT reserve yet)
      select available into v_available from membership_credit_state(v_membership.id);
      if v_available <= 0 then
        perform raise_domain_error('INSUFFICIENT_CREDITS');
      end if;

      insert into booking_participants (booking_id, participant_type, member_id, membership_id)
      values (v_booking_id, 'MEMBER', v_member_id, v_membership.id);

    elsif v_participant->>'type' = 'CASUAL' then
      insert into casual_customers (full_name, phone)
      values (v_participant->>'full_name', v_participant->>'phone')
      returning id into v_casual_id;

      insert into booking_participants (booking_id, participant_type, casual_customer_id)
      values (v_booking_id, 'CASUAL', v_casual_id);
    else
      perform raise_domain_error('INVALID_PARTICIPANT_TYPE');
    end if;
  end loop;

  insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  values (v_booking_id, null, 'PENDING', p_actor_id, 'member submission');

  -- 7. NOTIFY ADMINS via FCM
  for v_admin_user_id in select id from users where role = 'ADMIN' loop
    insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
    values (
      'NEW_BOOKING_REQUEST',
      'BOOKING',
      v_booking_id,
      v_admin_user_id,
      'FCM'::notification_channel,
      jsonb_build_object(
        'booking_id', v_booking_id,
        'slot_date', v_slot.slot_date,
        'start_time', v_slot.start_time
      )
    ) on conflict do nothing;
  end loop;

  return v_booking_id;
end $function$;
