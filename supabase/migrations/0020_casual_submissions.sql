-- 0020_casual_submissions.sql
-- (Renamed from 0020_casual_customer_fields.sql since we are creating submissions, not just fields)
-- Separation of Casual Customer (Identity) vs Casual Submission (Event)

create type casual_activity_type as enum ('DAILY_RIDING', 'JOY_RIDE');
create type casual_status as enum ('FORM_SUBMITTED', 'CONFIRMED');

-- Note: casual_customers already exists and tracks identity (id, full_name, phone, etc).
-- We DO NOT add volatile/registration-specific fields like height/weight to the customer profile.
-- We add them to the submission.

create table casual_submissions (
  id uuid primary key default gen_random_uuid(),
  casual_customer_id uuid not null references casual_customers(id) on delete cascade,
  
  -- Registration snapshot
  age integer not null,
  height_cm numeric(5,2) not null,
  weight_kg numeric(5,2) not null,
  activity_type casual_activity_type not null,
  
  -- Status
  status casual_status not null default 'FORM_SUBMITTED',
  
  -- Eventual booking linkage (nullable, populated when admin confirms and creates booking)
  booking_id uuid references bookings(id) on delete set null,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index casual_submissions_customer_idx on casual_submissions(casual_customer_id);
create index casual_submissions_status_idx on casual_submissions(status);
create index casual_submissions_booking_idx on casual_submissions(booking_id);

-- RLS
alter table casual_submissions enable row level security;

-- Public can insert new customers (if they don't exist) safely.
-- To prevent abuse, we only allow insert with check (true) but they cannot update.
create policy casual_customers_public_insert on casual_customers 
  for insert with check (true);

-- Public can insert submissions, but they MUST have status = 'FORM_SUBMITTED'.
create policy casual_submissions_public_insert on casual_submissions 
  for insert with check (status = 'FORM_SUBMITTED');

-- Admin full access
create policy casual_submissions_admin on casual_submissions 
  for all using (is_admin()) with check (is_admin());
