-- 0040_fix_member_cancellation_ownership.sql
-- 0040_allow_pending_horse_assign.sql
-- (merged to resolve prefix conflict)

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
  v_is_participant boolean;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;

  -- AUTHORIZATION: Member can cancel if they created it OR if they are a participant (for basic members approved by admin)
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
  values (p_booking_id, v_booking.status, v_new_status, p_actor_id, p_reason);

  return case when v_late then 'LATE' else 'EARLY' end;
end $$;

create or replace function assign_horse(
  p_participant_id uuid,
  p_horse_id uuid,
  p_actor_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_participant booking_participants%rowtype;
  v_booking bookings%rowtype;
  v_horse horses%rowtype;
  v_conflict boolean;
  v_slot_id uuid;
  v_booking_id uuid;
begin
  -- Authorize (Must be ADMIN or GROOMER)
  if not exists (
    select 1 from users where id = p_actor_id and role in ('ADMIN', 'GROOMER')
  ) then
    perform raise_domain_error('FORBIDDEN');
  end if;

  -- Read IDs without locking to establish the correct lock order
  select b.slot_id, b.id into v_slot_id, v_booking_id
  from booking_participants bp
  join bookings b on b.id = bp.booking_id
  where bp.id = p_participant_id;

  if not found then perform raise_domain_error('PARTICIPANT_NOT_FOUND'); end if;

  -- LOCK ORDER 1: session_slots
  -- This entirely serializes assignments for the same slot, preventing horse collision races
  perform 1 from session_slots where id = v_slot_id for update;

  -- LOCK ORDER 2: bookings
  select * into v_booking from bookings where id = v_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;

  -- Prevent race if the booking was rescheduled (slot changed) while waiting for lock
  if v_booking.status = 'RESCHEDULE_REQUESTED' then
    -- Disallow assignment if they requested a reschedule that hasn't been approved yet
    perform raise_domain_error('INVALID_BOOKING_STATUS');
  end if;

  if v_booking.slot_id != v_slot_id then
    perform raise_domain_error('INVALID_BOOKING_STATUS');
  end if;

  -- LOCK ORDER 3: booking_participants
  select * into v_participant from booking_participants where id = p_participant_id for update;
  if not found then perform raise_domain_error('PARTICIPANT_NOT_FOUND'); end if;

  -- Verify operationally valid booking for grooming/assignment
  if v_booking.status not in ('PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW') then
    perform raise_domain_error('INVALID_BOOKING_STATUS');
  end if;

  -- Verify horse if one is provided (allow un-assign by sending null)
  if p_horse_id is not null then
    -- 'for share' is safe here since horses is independent of the slot->booking lock order
    select * into v_horse from horses where id = p_horse_id for share;
    if not found then perform raise_domain_error('HORSE_NOT_FOUND'); end if;
    if v_horse.status != 'ACTIVE' then perform raise_domain_error('HORSE_INACTIVE'); end if;

    -- Enforce collision rule: no other participant in the same slot_id can have this horse
    -- Because we hold the session_slots lock, this read is absolutely serialized and race-free.
    select exists (
      select 1
      from booking_participants bp
      join bookings b on b.id = bp.booking_id
      where b.slot_id = v_booking.slot_id
        and b.status in ('PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'RESCHEDULE_REQUESTED')
        and bp.horse_id = p_horse_id
        and bp.id != p_participant_id
    ) into v_conflict;

    if v_conflict then
      perform raise_domain_error('HORSE_ALREADY_ASSIGNED_IN_SLOT');
    end if;
  end if;

  -- Apply
  update booking_participants
  set horse_id = p_horse_id
  where id = p_participant_id;

end;
$$;
