-- 0012_booking_features.sql

-- Drop the old single-participant RPC
DROP FUNCTION IF EXISTS create_member_booking(uuid, uuid, uuid);

-- ---------------------------------------------------------------------------
-- create_member_booking: Multi-participant member self-service submission
-- ---------------------------------------------------------------------------
create or replace function create_member_booking(
  p_booking_owner_id uuid,
  p_slot_id uuid,
  p_participants jsonb, -- Array of { type: 'MEMBER', member_id: uuid } | { type: 'CASUAL', full_name: text, phone: text }
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
  v_active_count int;
  v_num_participants int;
  v_participant jsonb;
  v_member_id uuid;
  v_membership memberships%rowtype;
  v_casual_id uuid;
begin
  v_num_participants := jsonb_array_length(p_participants);
  if v_num_participants = 0 then
    perform raise_domain_error('NO_PARTICIPANTS');
  end if;

  -- 1. Lock the slot: capacity decisions serialise here.
  select * into v_slot from session_slots where id = p_slot_id for update;
  if not found then perform raise_domain_error('SLOT_NOT_FOUND'); end if;
  if not v_slot.is_open then perform raise_domain_error('SLOT_CLOSED'); end if;

  -- 2. Booking window
  if v_slot.slot_date < current_date then perform raise_domain_error('SLOT_IN_PAST'); end if;
  if v_slot.slot_date > current_date + (v_window_days || ' days')::interval then
    perform raise_domain_error('BOOKING_WINDOW_EXCEEDED');
  end if;

  -- 3. Active future booking limit (Applies only to the booking owner)
  select count(*) into v_active_count
  from bookings b
  where b.created_by = p_actor_id
    and b.status in ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED')
    and exists (
      select 1 from session_slots s where s.id = b.slot_id and (s.slot_date + s.start_time) > now()
    );
  
  if v_active_count >= v_max_active then
    perform raise_domain_error('ACTIVE_BOOKING_LIMIT_REACHED');
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

  return v_booking_id;
end $$;

-- ---------------------------------------------------------------------------
-- reject_booking: Admin rejecting a PENDING booking
-- ---------------------------------------------------------------------------
create or replace function reject_booking(p_booking_id uuid, p_actor_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;
  if v_booking.status <> 'PENDING' then perform raise_domain_error('INVALID_BOOKING_STATUS'); end if;

  update bookings 
  set status = 'REJECTED', 
      pending_expires_at = null,
      cancellation_reason = p_reason,
      cancelled_by = p_actor_id,
      cancelled_at = now(),
      updated_at = now()
  where id = p_booking_id;

  insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  values (p_booking_id, 'PENDING', 'REJECTED', p_actor_id, coalesce(p_reason, 'admin rejection'));
end $$;

-- ---------------------------------------------------------------------------
-- reject_reschedule: Admin rejecting a RESCHEDULE_REQUESTED booking
-- ---------------------------------------------------------------------------
create or replace function reject_reschedule(p_booking_id uuid, p_actor_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;
  if v_booking.status <> 'RESCHEDULE_REQUESTED' then perform raise_domain_error('INVALID_BOOKING_STATUS'); end if;

  update bookings 
  set status = 'CONFIRMED', 
      requested_slot_id = null,
      updated_at = now()
  where id = p_booking_id;

  insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  values (p_booking_id, 'RESCHEDULE_REQUESTED', 'CONFIRMED', p_actor_id, coalesce(p_reason, 'reschedule rejected'));
end $$;
