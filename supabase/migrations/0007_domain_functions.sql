-- 0007_domain_functions.sql
-- Sections 12,16,20,64.9: every capacity/credit mutation happens inside one
-- transaction that re-validates state under a row lock.
--
-- ENGINEERING DECISION (Section 64.24): locks are always taken in the order
--   session_slots -> memberships (ascending id)
-- so concurrent bookings can never deadlock.
--
-- ENGINEERING DECISION: a PENDING booking holds CAPACITY but not credit.
-- Credit is reserved at approval (Section 15: "confirmed member booking").
-- Eligibility still checks available credit at submission so a member cannot
-- queue a booking they can never pay for.

create or replace function setting_int(p_key text, p_default int)
returns int language sql stable as $$
  select coalesce((select (value #>> '{}')::int from system_settings where key = p_key), p_default)
$$;

create or replace function slot_occupancy(p_slot_id uuid)
returns int language sql stable as $$
  select coalesce(count(bp.id),0)::int
  from bookings b
  join booking_participants bp on bp.booking_id = b.id
  where b.slot_id = p_slot_id
    and b.status in ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED','COMPLETED','NO_SHOW')
$$;

create or replace function raise_domain_error(p_code text) returns void
language plpgsql as $$ begin raise exception '%', p_code using errcode = 'P0001'; end $$;

-- ---------------------------------------------------------------------------
-- create_member_booking: member self-service submission (Section 17)
-- ---------------------------------------------------------------------------
create or replace function create_member_booking(
  p_member_id uuid,
  p_slot_id   uuid,
  p_actor_id  uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_slot        session_slots%rowtype;
  v_membership  memberships%rowtype;
  v_available   int;
  v_booking_id  uuid;
  v_participant_id uuid;
  v_window_days int := setting_int('booking_window_days', 7);
  v_max_active  int := setting_int('max_active_future_bookings', 2);
  v_timeout_min int := setting_int('pending_timeout_minutes', 1440);
  v_active_count int;
begin
  -- 1. Lock the slot: capacity decisions serialise here.
  select * into v_slot from session_slots where id = p_slot_id for update;
  if not found then perform raise_domain_error('SLOT_NOT_FOUND'); end if;
  if not v_slot.is_open then perform raise_domain_error('SLOT_CLOSED'); end if;

  -- 2. Booking window (Section 17 / 44.10)
  if v_slot.slot_date < current_date then perform raise_domain_error('SLOT_IN_PAST'); end if;
  if v_slot.slot_date > current_date + (v_window_days || ' days')::interval then
    perform raise_domain_error('BOOKING_WINDOW_EXCEEDED');
  end if;

  -- 3. Membership must be ACTIVE and cover the session date (Section 44.11)
  select * into v_membership from memberships
   where member_id = p_member_id and status = 'ACTIVE' for update;
  if not found then perform raise_domain_error('MEMBERSHIP_EXPIRED'); end if;
  if v_slot.slot_date > v_membership.end_date then
    perform raise_domain_error('MEMBERSHIP_EXPIRED');
  end if;

  -- 4. Credit availability (reserved at approval, checked here)
  select available into v_available from membership_credit_state(v_membership.id);
  if v_available <= 0 then perform raise_domain_error('INSUFFICIENT_CREDITS'); end if;

  -- 5. Active future booking limit (Section 17)
  select count(*) into v_active_count
  from bookings b
  join booking_participants bp on bp.booking_id = b.id
  join session_slots s on s.id = b.slot_id
  where bp.member_id = p_member_id
    and b.status in ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED')
    and (s.slot_date + s.start_time) > now();
  if v_active_count >= v_max_active then
    perform raise_domain_error('ACTIVE_BOOKING_LIMIT_REACHED');
  end if;

  -- 6. Capacity, re-read under the lock taken in step 1 (Section 12)
  if slot_occupancy(p_slot_id) >= v_slot.capacity then
    perform raise_domain_error('SLOT_FULL');
  end if;

  insert into bookings (slot_id, status, created_by, is_casual, pending_expires_at)
  values (p_slot_id, 'PENDING', p_actor_id, false,
          now() + (v_timeout_min || ' minutes')::interval)
  returning id into v_booking_id;

  insert into booking_participants (booking_id, participant_type, member_id, membership_id)
  values (v_booking_id, 'MEMBER', p_member_id, v_membership.id)
  returning id into v_participant_id;

  insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  values (v_booking_id, null, 'PENDING', p_actor_id, 'member submission');

  return v_booking_id;
end $$;

-- ---------------------------------------------------------------------------
-- approve_booking: admin confirmation + credit reservation (Section 20)
-- ---------------------------------------------------------------------------
create or replace function approve_booking(p_booking_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
  v_slot    session_slots%rowtype;
  p         record;
  v_available int;
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
  values (p_booking_id, 'PENDING', 'CONFIRMED', p_actor_id);
end $$;

-- ---------------------------------------------------------------------------
-- cancel_booking: Sections 23 / 44
-- p_source: 'MEMBER' | 'BBS'
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
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;
  if v_booking.status not in ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED') then
    perform raise_domain_error('INVALID_BOOKING_STATUS');
  end if;

  select * into v_slot from session_slots where id = v_booking.slot_id;
  v_starts_at := (v_slot.slot_date + v_slot.start_time) at time zone 'Asia/Makassar';
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
        -- Section 23: late cancellation forfeits the credit.
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

-- ---------------------------------------------------------------------------
-- approve_reschedule: Section 26 — same booking, new slot, no extra credit
-- ---------------------------------------------------------------------------
create or replace function approve_reschedule(p_booking_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
  v_new_slot session_slots%rowtype;
  v_participants int;
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

  insert into booking_slot_history (booking_id, from_slot_id, to_slot_id, actor_id, reason)
  values (p_booking_id, v_booking.slot_id, v_new_slot.id, p_actor_id, 'reschedule approved');

  -- Credit reservation is untouched: the same reservation follows the booking.
  update bookings set slot_id = v_new_slot.id, requested_slot_id = null,
         status = 'CONFIRMED', updated_at = now()
   where id = p_booking_id;
  insert into booking_status_history (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, 'RESCHEDULE_REQUESTED', 'CONFIRMED', p_actor_id);
end $$;

-- ---------------------------------------------------------------------------
-- resolve_attendance: Sections 24,25
-- p_status: 'ATTENDED' | 'NO_SHOW'; p_credit_action: 'CONSUMED' | 'RETURNED'
-- ---------------------------------------------------------------------------
create or replace function resolve_attendance(
  p_participant_id uuid, p_status attendance_status, p_credit_action text,
  p_reason text, p_actor_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  p record;
  v_booking bookings%rowtype;
begin
  select bp.*, b.id as bid into p
  from booking_participants bp join bookings b on b.id = bp.booking_id
  where bp.id = p_participant_id for update;
  if not found then perform raise_domain_error('PARTICIPANT_NOT_FOUND'); end if;

  select * into v_booking from bookings where id = p.bid for update;
  if v_booking.status <> 'CONFIRMED' then perform raise_domain_error('INVALID_BOOKING_STATUS'); end if;

  if p.participant_type = 'MEMBER' then
    perform 1 from memberships where id = p.membership_id for update;
    if p_status = 'ATTENDED' then
      insert into membership_credit_ledger
        (membership_id, member_id, booking_id, participant_id, txn_type,
         delta_reserved, delta_consumed, reason, actor_id)
      values (p.membership_id, p.member_id, p.bid, p.id, 'SESSION_COMPLETED', -1, 1, p_reason, p_actor_id);
    elsif p_credit_action = 'CONSUMED' then
      insert into membership_credit_ledger
        (membership_id, member_id, booking_id, participant_id, txn_type,
         delta_reserved, delta_consumed, reason, actor_id)
      values (p.membership_id, p.member_id, p.bid, p.id, 'NO_SHOW_DEDUCT', -1, 1, p_reason, p_actor_id);
    else
      insert into membership_credit_ledger
        (membership_id, member_id, booking_id, participant_id, txn_type,
         delta_reserved, reason, actor_id)
      values (p.membership_id, p.member_id, p.bid, p.id, 'NO_SHOW_RETURN', -1, p_reason, p_actor_id);
    end if;
  end if;

  insert into attendance_records
    (booking_id, participant_id, status, credit_action, reason, resolved_by)
  values (p.bid, p.id, p_status,
          case when p.participant_type = 'CASUAL' then 'NOT_APPLICABLE' else p_credit_action end,
          p_reason, p_actor_id);

  -- The booking closes once every participant has been resolved.
  if not exists (
    select 1 from booking_participants bp
    left join attendance_records ar on ar.participant_id = bp.id
    where bp.booking_id = p.bid and ar.id is null
  ) then
    update bookings set status =
      case when exists (select 1 from attendance_records
                        where booking_id = p.bid and status = 'ATTENDED')
           then 'COMPLETED' else 'NO_SHOW' end,
      updated_at = now()
    where id = p.bid;
    insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
    select p.bid, 'CONFIRMED', status, p_actor_id, 'attendance resolved'
    from bookings where id = p.bid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- generate_session_slots: idempotent (Section 41 / 64.20)
-- ---------------------------------------------------------------------------
create or replace function generate_session_slots(p_from date, p_to date)
returns int language plpgsql security definer set search_path = public as $$
declare
  d date; s operating_schedules%rowtype; t time; v_created int := 0;
  v_override schedule_overrides%rowtype;
begin
  d := p_from;
  while d <= p_to loop
    for s in select * from operating_schedules
             where day_of_week = extract(dow from d) and is_active loop
      select * into v_override from schedule_overrides
       where override_date = d and (block = s.block or block is null) limit 1;
      if not (found and v_override.is_closed) then
        t := s.start_time;
        -- A slot only exists if the whole session fits inside the block.
        while (t + (s.session_duration_minutes || ' minutes')::interval) <= s.end_time loop
          insert into session_slots
            (slot_date, start_time, end_time, block, capacity, source_schedule_id)
          values (d, t, t + (s.session_duration_minutes || ' minutes')::interval, s.block,
                  coalesce(v_override.capacity_override, s.default_capacity), s.id)
          on conflict (slot_date, start_time) do nothing;
          if found then v_created := v_created + 1; end if;
          t := t + (s.slot_interval_minutes || ' minutes')::interval;
        end loop;
      end if;
    end loop;
    d := d + 1;
  end loop;
  return v_created;
end $$;

-- ---------------------------------------------------------------------------
-- expire_pending_bookings: Section 19, idempotent
-- ---------------------------------------------------------------------------
create or replace function expire_pending_bookings() returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with expired as (
    update bookings set status = 'EXPIRED', updated_at = now()
     where status = 'PENDING' and pending_expires_at is not null
       and pending_expires_at < now()
    returning id, status
  )
  insert into booking_status_history (booking_id, from_status, to_status, reason)
  select id, 'PENDING', 'EXPIRED', 'pending timeout' from expired;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- expire_memberships: Section 7, idempotent
-- ---------------------------------------------------------------------------
create or replace function expire_memberships() returns int
language plpgsql security definer set search_path = public as $$
declare m record; v_available int; v_count int := 0;
begin
  for m in select * from memberships
           where status = 'ACTIVE' and end_date < current_date for update loop
    select available into v_available from membership_credit_state(m.id);
    if v_available > 0 then
      insert into membership_credit_ledger
        (membership_id, member_id, txn_type, delta_allocated, reason)
      values (m.id, m.member_id, 'EXPIRATION', -v_available, 'membership expired');
    end if;
    update memberships set status = 'EXPIRED', updated_at = now() where id = m.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- request_reschedule: member-initiated (Section 26). Validates the target slot
-- but does not move the booking until an admin approves.
-- ---------------------------------------------------------------------------
create or replace function request_reschedule(
  p_booking_id uuid, p_new_slot_id uuid, p_member_id uuid, p_actor_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_booking bookings%rowtype;
  v_slot    session_slots%rowtype;
  v_window_days int := setting_int('booking_window_days', 7);
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;
  if v_booking.status <> 'CONFIRMED' then perform raise_domain_error('INVALID_BOOKING_STATUS'); end if;
  if not exists (select 1 from booking_participants
                 where booking_id = p_booking_id and member_id = p_member_id) then
    perform raise_domain_error('FORBIDDEN');
  end if;

  select * into v_slot from session_slots where id = p_new_slot_id;
  if not found or not v_slot.is_open then perform raise_domain_error('SLOT_CLOSED'); end if;
  if v_slot.slot_date > current_date + (v_window_days || ' days')::interval then
    perform raise_domain_error('BOOKING_WINDOW_EXCEEDED');
  end if;
  if slot_occupancy(p_new_slot_id) >= v_slot.capacity then perform raise_domain_error('SLOT_FULL'); end if;

  update bookings set status = 'RESCHEDULE_REQUESTED', requested_slot_id = p_new_slot_id,
         updated_at = now() where id = p_booking_id;
  insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  values (p_booking_id, 'CONFIRMED', 'RESCHEDULE_REQUESTED', p_actor_id, 'member reschedule request');
end $$;
