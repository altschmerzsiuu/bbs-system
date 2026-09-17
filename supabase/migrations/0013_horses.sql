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
