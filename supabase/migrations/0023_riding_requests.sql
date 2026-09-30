-- 0023_riding_requests.sql
-- Replace casual_submissions with a unified riding_requests abstraction

drop table if exists casual_submissions cascade;

create type riding_request_type as enum ('CASUAL_RIDE', 'JOY_RIDE');
create type riding_request_status as enum ('UNDER_REVIEW', 'CONFIRMED', 'REJECTED');

create table riding_requests (
  id uuid primary key default gen_random_uuid(),
  human_id text not null unique,
  member_id uuid references members(id) on delete cascade,
  casual_customer_id uuid references casual_customers(id) on delete cascade,
  
  request_type riding_request_type not null,
  
  -- Schedulling preference
  preferred_date date not null,
  preferred_time_start time not null,
  
  -- Registration snapshot (physical data required for riding)
  height_cm numeric(5,2) not null,
  weight_kg numeric(5,2) not null,
  shoe_size integer,
  
  -- Status
  status riding_request_status not null default 'UNDER_REVIEW',
  
  -- Link to booking when admin operationally confirms it
  booking_id uuid references bookings(id) on delete set null,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Constraint: Must have an owner
  constraint has_owner check (member_id is not null or casual_customer_id is not null)
);

create index riding_requests_human_idx on riding_requests(human_id);
create index riding_requests_member_idx on riding_requests(member_id);
create index riding_requests_casual_idx on riding_requests(casual_customer_id);
create index riding_requests_status_idx on riding_requests(status);

-- RLS
alter table riding_requests enable row level security;

-- Admin full access
create policy riding_requests_admin on riding_requests 
  for all using (is_admin()) with check (is_admin());

-- User can view their own requests
create policy riding_requests_select_own on riding_requests
  for select using (
    (member_id is not null and member_id = (select id from members where user_id = auth.uid()))
  );

-- User can insert their own requests
create policy riding_requests_insert_own on riding_requests
  for insert with check (
    (member_id is not null and member_id = (select id from members where user_id = auth.uid()))
  );

-- Update membership_applications to have human_id
alter table membership_applications add column human_id text unique;

-- Backfill membership_applications human_id
update membership_applications set human_id = 'BBS-MEM-' || to_char(created_at, 'DDMMYY') || '-' || substring(id::text from 1 for 4) where human_id is null;

alter table membership_applications alter column human_id set not null;
create index membership_applications_human_idx on membership_applications(human_id);
