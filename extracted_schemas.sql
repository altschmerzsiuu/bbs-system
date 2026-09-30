create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  avatar_url    text,
  role          app_role not null default 'MEMBER',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table members (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references users(id) on delete restrict,
  full_name      text not null,
  phone          text not null,
  date_of_birth  date,
  emergency_contact_name  text,
  emergency_contact_phone text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table operating_schedules (
  id               uuid primary key default gen_random_uuid(),
  day_of_week      smallint not null check (day_of_week between 0 and 6), -- 0=Sunday
  block            operating_block not null,
  start_time       time not null,
  end_time         time not null,
  session_duration_minutes integer not null default 45 check (session_duration_minutes > 0),
  slot_interval_minutes    integer not null default 60 check (slot_interval_minutes > 0),
  default_capacity integer not null default 2 check (default_capacity > 0),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint schedule_block_valid check (end_time > start_time),
  -- Section 9: hourly starts only.
  constraint schedule_start_on_hour check (date_part('minute', start_time) = 0),
  unique (day_of_week, block)
);

create table session_slots (
  id            uuid primary key default gen_random_uuid(),
  slot_date     date not null,
  start_time    time not null,
  end_time      time not null,
  block         operating_block not null,
  capacity      integer not null check (capacity > 0),
  is_open       boolean not null default true,
  closed_reason text,
  source_schedule_id uuid references operating_schedules(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint slot_start_on_hour check (date_part('minute', start_time) = 0),
  constraint slot_times_valid check (end_time > start_time),
  -- Section 41/64.20: idempotent generation.
  unique (slot_date, start_time)
);

create table casual_customers (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  phone        text not null,
  email        text,
  notes        text,
  linked_member_id uuid references members(id),  -- Section 22: casual -> member link
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table bookings (
  id             uuid primary key default gen_random_uuid(),
  slot_id        uuid not null references session_slots(id) on delete restrict,
  status         booking_status not null default 'PENDING',
  created_by     uuid references users(id),
  is_casual      boolean not null default false,
  pending_expires_at timestamptz,
  requested_slot_id uuid references session_slots(id), -- pending reschedule target
  cancellation_reason text,
  cancelled_by   uuid references users(id),
  cancelled_at   timestamptz,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table booking_participants (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references bookings(id) on delete cascade,
  participant_type participant_type not null,
  member_id      uuid references members(id) on delete restrict,
  membership_id  uuid references memberships(id) on delete restrict,
  casual_customer_id uuid references casual_customers(id) on delete restrict,
  price_idr      numeric(12,0),           -- casual only
  created_at     timestamptz not null default now(),
  -- Section 32: identity combination must be valid at the database level.
  constraint participant_identity_valid check (
    (participant_type = 'MEMBER'
      and member_id is not null and membership_id is not null and casual_customer_id is null)
    or
    (participant_type = 'CASUAL'
      and casual_customer_id is not null and member_id is null and membership_id is null)
  )
);
