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
  v_deadline_hours int := setting_int('reschedule_hours', 24);
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

create or replace function cancel_booking(
  p_booking_id uuid, p_actor_id uuid, p_source text, p_reason text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
  v_slot    session_slots%rowtype;
  v_deadline_hours int := setting_int('reschedule_hours', 24);
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
