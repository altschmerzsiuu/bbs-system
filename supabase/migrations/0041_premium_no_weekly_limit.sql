-- 0041_premium_no_weekly_limit.sql
create or replace function create_member_booking(
  p_booking_owner_id uuid,
  p_slot_id uuid,
  p_participants jsonb,
  p_actor_id uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_slot session_slots%rowtype;
  v_available int;
  v_booking_id uuid;
  v_window_days int := setting_int('booking_window_days', 7);
  v_max_active int := setting_int('max_active_future_bookings', 2);
  v_timeout_min int := setting_int('pending_timeout_minutes', 1440);
  v_max_weekly_sessions int := 2; -- Domain Rule: max 2 sessions per calendar week
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

  -- Premium members have no limits
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
    and s.slot_date between v_slot_week_start and v_slot_week_end;

  if v_weekly_count >= v_max_weekly_sessions then
    perform raise_domain_error('WEEKLY_BOOKING_LIMIT_REACHED');
  end if;

  -- 4. Capacity (occupancy includes PENDING and CONFIRMED)
  if slot_occupancy(p_slot_id) + v_num_participants > v_slot.capacity then
    perform raise_domain_error('SLOT_FULL');
  end if;

  -- 5. Insert Booking (PENDING)
  insert into bookings (slot_id, status, created_by, is_casual, pending_expires_at)
  values (p_slot_id, 'PENDING', p_actor_id, false, now() + (v_timeout_min || ' minutes')::interval)
  returning id into v_booking_id;

  -- 6. Process Participants
  for v_participant in select * from jsonb_array_elements(p_participants)
  loop
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

  -- 7. NOTIFY ADMINS
  for v_admin_user_id in select id from users where role = 'ADMIN' loop
    insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
    values (
      'NEW_BOOKING_REQUEST',
      'BOOKING',
      v_booking_id,
      v_admin_user_id,
      'PWA_PUSH',
      jsonb_build_object(
        'booking_id', v_booking_id,
        'slot_date', v_slot.slot_date,
        'start_time', v_slot.start_time
      )
    ) on conflict do nothing;
  end loop;

  return v_booking_id;
end $$;
