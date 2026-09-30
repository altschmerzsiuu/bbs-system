-- 0031_reschedule_deadline_guard.sql

-- ---------------------------------------------------------------------------
-- request_reschedule: member-initiated (Section 26). Validates the target slot
-- but does not move the booking until an admin approves.
-- Fixes: Implements cancellation deadline guard on the original slot.
-- ---------------------------------------------------------------------------
create or replace function request_reschedule(
  p_booking_id uuid, p_new_slot_id uuid, p_member_id uuid, p_actor_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
  v_slot    session_slots%rowtype;
  v_old_slot session_slots%rowtype;
  v_participants int;
  v_window_days int := setting_int('booking_window_days', 7);
  v_deadline_hours int := setting_int('cancellation_deadline_hours', 6);
  v_starts_at timestamptz;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;
  if v_booking.status <> 'CONFIRMED' then perform raise_domain_error('INVALID_BOOKING_STATUS'); end if;
  
  -- AUTHORIZATION: Only the booking creator can request a reschedule
  if v_booking.created_by != p_actor_id then
    perform raise_domain_error('FORBIDDEN');
  end if;

  -- ORIGINAL SLOT VALIDATION: Enforce cancellation deadline on the original slot
  select * into v_old_slot from session_slots where id = v_booking.slot_id;
  v_starts_at := (v_old_slot.slot_date + v_old_slot.start_time) at time zone 'Asia/Jakarta';
  if now() > v_starts_at - (v_deadline_hours || ' hours')::interval then
    perform raise_domain_error('CANCELLATION_DEADLINE_PASSED');
  end if;

  -- TARGET SLOT VALIDATION
  select * into v_slot from session_slots where id = p_new_slot_id;
  if not found or not v_slot.is_open then perform raise_domain_error('SLOT_CLOSED'); end if;
  if v_slot.slot_date > current_date + (v_window_days || ' days')::interval then
    perform raise_domain_error('BOOKING_WINDOW_EXCEEDED');
  end if;
  
  select count(*) into v_participants from booking_participants where booking_id = p_booking_id;
  if slot_occupancy(p_new_slot_id) + v_participants > v_slot.capacity then 
    perform raise_domain_error('SLOT_FULL'); 
  end if;

  update bookings set status = 'RESCHEDULE_REQUESTED', requested_slot_id = p_new_slot_id,
         updated_at = now() where id = p_booking_id;
  insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  values (p_booking_id, 'CONFIRMED', 'RESCHEDULE_REQUESTED', p_actor_id, 'member reschedule request');
end $$;
