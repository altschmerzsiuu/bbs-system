-- 0004_schedule.sql
-- Sections 10,11,12,41: slots are generated from configuration, never hardcoded.
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

create table schedule_overrides (
  id            uuid primary key default gen_random_uuid(),
  override_date date not null,
  block         operating_block,
  is_closed     boolean not null default false,
  capacity_override integer check (capacity_override > 0),
  reason        text,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  unique (override_date, block)
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
create index session_slots_date_idx on session_slots (slot_date, start_time);
create index session_slots_open_idx on session_slots (slot_date) where is_open;
