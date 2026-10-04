-- ============================================================
-- Canonical migration 0013
-- Consolidated from:
--   0013_approve_riding_request.sql
--   0013_horses.sql
-- ============================================================

-- ===== ORIGINAL: 0013_approve_riding_request.sql =====
-- Migration to approve a riding request and assign to a slot

CREATE OR REPLACE FUNCTION approve_riding_request(
    p_request_id uuid,
    p_date date,
    p_time time,
    p_capacity integer,
    p_actor_id uuid
) RETURNS uuid AS $$
DECLARE
    v_member_id uuid;
    v_status text;
    v_slot_id uuid;
    v_booking_id uuid;
    v_is_casual boolean;
BEGIN
    -- 1. Get request
    SELECT member_id, status INTO v_member_id, v_status
    FROM riding_requests
    WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'REQUEST_NOT_FOUND';
    END IF;
    
    IF v_status <> 'PENDING' THEN
        RAISE EXCEPTION 'REQUEST_NOT_PENDING';
    END IF;

    -- 2. Find or create session_slot
    SELECT id INTO v_slot_id
    FROM session_slots
    WHERE slot_date = p_date AND start_time = p_time;
    
    IF NOT FOUND THEN
        INSERT INTO session_slots (slot_date, start_time, end_time, block, capacity, is_open)
        VALUES (
            p_date, 
            p_time, 
            p_time + interval '1 hour', 
            CASE 
                WHEN extract(hour from p_time) < 12 THEN 'MORNING'
                ELSE 'AFTERNOON'
            END,
            p_capacity, 
            true
        ) RETURNING id INTO v_slot_id;
    END IF;

    -- 3. Create booking
    -- Note: We set is_casual to true for all riding requests for now, since it's casual/joy ride
    INSERT INTO bookings (slot_id, status, is_casual, created_by)
    VALUES (v_slot_id, 'CONFIRMED', true, p_actor_id)
    RETURNING id INTO v_booking_id;

    -- 4. Create participant
    INSERT INTO booking_participants (
        booking_id, participant_type, member_id, 
        participant_status, attendance_status
    ) VALUES (
        v_booking_id, 'MEMBER', v_member_id,
        'CONFIRMED', 'NOT_CHECKED_IN'
    );

    -- 5. Update request status
    UPDATE riding_requests
    SET status = 'APPROVED', updated_at = now()
    WHERE id = p_request_id;

    RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== ORIGINAL: 0013_horses.sql =====
-- 0013_horses.sql

create type horse_status as enum ('ACTIVE', 'INACTIVE');

create table horses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status horse_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS for horses
alter table horses enable row level security;

-- All authenticated users (including MEMBER, GROOMER, ADMIN) can read horses
create policy "horses_select" on horses for select using (true);

-- Only ADMIN can mutate (insert/update/delete) horses
create policy "horses_all" on horses for all using (
  exists (select 1 from users where id = auth.uid() and role = 'ADMIN')
);

-- assignment is persistent historical operational data
alter table booking_participants
  add column horse_id uuid references horses(id) on delete restrict;

create index booking_participants_horse_idx on booking_participants(horse_id);

-- assign_horse operation
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
  if v_booking.slot_id != v_slot_id then 
    perform raise_domain_error('INVALID_BOOKING_STATUS'); 
  end if;

  -- LOCK ORDER 3: booking_participants
  select * into v_participant from booking_participants where id = p_participant_id for update;
  if not found then perform raise_domain_error('PARTICIPANT_NOT_FOUND'); end if;

  -- Verify operationally valid booking for grooming/assignment
  if v_booking.status not in ('CONFIRMED', 'COMPLETED', 'NO_SHOW') then
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

  -- Update assignment (modifies ONLY the horse assignment)
  update booking_participants
  set horse_id = p_horse_id
  where id = p_participant_id;

end;
$$;
