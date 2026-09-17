-- Combined Migrations for BBS (0001 - 0009)

-- ==========================================
-- Migration: 0001_foundation.sql
-- ==========================================

-- 0001_foundation.sql
-- Extensions, enums, system settings, audit log.
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

create type app_role as enum ('MEMBER','ADMIN','GROOMER');
create type membership_status as enum ('PENDING_PAYMENT','ACTIVE','EXPIRED','CANCELLED');
create type booking_status as enum (
  'PENDING','CONFIRMED','REJECTED','EXPIRED','COMPLETED',
  'MEMBER_CANCELLED','BBS_CANCELLED','RESCHEDULE_REQUESTED','NO_SHOW'
);
create type participant_type as enum ('MEMBER','CASUAL');
create type credit_txn_type as enum (
  'MEMBERSHIP_ALLOCATION','SESSION_RESERVED','SESSION_COMPLETED',
  'EARLY_CANCELLATION_RETURN','LATE_CANCELLATION','BBS_CANCELLATION_RETURN',
  'NO_SHOW_DEDUCT','NO_SHOW_RETURN','ADMIN_ADJUSTMENT','EXPIRATION'
);
create type attendance_status as enum ('ATTENDED','NO_SHOW','CANCELLED');
create type operating_block as enum ('MORNING','AFTERNOON');
create type payment_status as enum ('PENDING','CONFIRMED','FAILED','REFUNDED','CANCELLED');
create type sync_status as enum ('QUEUED','RUNNING','SUCCEEDED','FAILED','DEAD');

-- Section 35: nothing operational is hardcoded.
create table system_settings (
  key            text primary key,
  value          jsonb not null,
  value_type     text not null check (value_type in ('int','decimal','bool','string','json')),
  description    text,
  updated_by     uuid,
  updated_at     timestamptz not null default now()
);

-- Section 34: audit trail for administrative actions.
create table audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid,
  actor_role   app_role,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  old_data     jsonb,
  new_data     jsonb,
  reason       text,
  created_at   timestamptz not null default now()
);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx  on audit_logs (actor_id, created_at desc);


-- ==========================================
-- Migration: 0002_users_members.sql
-- ==========================================

-- 0002_users_members.sql
-- Section 5: account identity is stable and independent of membership status.
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
create unique index users_email_idx on users (lower(email));

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
create index members_user_idx on members (user_id);

-- Helper used by every RLS policy. SECURITY DEFINER so policies can read the
-- role without recursing through users' own RLS.
create or replace function current_app_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from users where id = auth.uid()
$$;

create or replace function current_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select m.id from members m where m.user_id = auth.uid()
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_app_role() = 'ADMIN', false)
$$;


-- ==========================================
-- Migration: 0003_membership.sql
-- ==========================================

-- 0003_membership.sql
-- Sections 6,7,15,33: plans are data, memberships are immutable history,
-- credits live in an append-only ledger.
create table membership_plans (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,           -- GOLD | SILVER
  name              text not null,
  price_idr         numeric(12,0) not null check (price_idr >= 0),
  extension_discount_idr numeric(12,0) not null default 0 check (extension_discount_idr >= 0),
  credits           integer not null check (credits > 0),
  duration_months   integer not null check (duration_months > 0),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table memberships (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references members(id) on delete restrict,
  plan_id        uuid not null references membership_plans(id) on delete restrict,
  status         membership_status not null default 'PENDING_PAYMENT',
  start_date     date,
  end_date       date,
  allocated_credits integer not null check (allocated_credits >= 0),
  price_paid_idr numeric(12,0),
  previous_membership_id uuid references memberships(id),
  activated_by   uuid references users(id),
  activated_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint membership_dates_valid check (
    (status = 'PENDING_PAYMENT' and start_date is null)
    or (start_date is not null and end_date is not null and end_date > start_date)
  )
);
create index memberships_member_idx on memberships (member_id, status);
create index memberships_active_idx on memberships (status, end_date) where status = 'ACTIVE';

-- Only one ACTIVE membership per member at a time.
create unique index memberships_one_active_per_member
  on memberships (member_id) where status = 'ACTIVE';

-- Append-only credit ledger. Balance is derived, never overwritten.
-- delta_reserved / delta_consumed are signed so that:
--   available = allocated - reserved - consumed - forfeited
create table membership_credit_ledger (
  id              uuid primary key default gen_random_uuid(),
  membership_id   uuid not null references memberships(id) on delete restrict,
  member_id       uuid not null references members(id) on delete restrict,
  booking_id      uuid,
  participant_id  uuid,
  txn_type        credit_txn_type not null,
  delta_reserved  integer not null default 0,
  delta_consumed  integer not null default 0,
  delta_allocated integer not null default 0,
  reason          text,
  actor_id        uuid references users(id),
  created_at      timestamptz not null default now()
);
create index credit_ledger_membership_idx on membership_credit_ledger (membership_id, created_at);
create index credit_ledger_booking_idx on membership_credit_ledger (booking_id);

-- Guard rails (Section 16): a participant can never be reserved or consumed twice.
create unique index credit_ledger_one_reservation_per_participant
  on membership_credit_ledger (participant_id)
  where txn_type = 'SESSION_RESERVED' and participant_id is not null;
create unique index credit_ledger_one_settlement_per_participant
  on membership_credit_ledger (participant_id)
  where participant_id is not null and txn_type in (
    'SESSION_COMPLETED','EARLY_CANCELLATION_RETURN','LATE_CANCELLATION',
    'BBS_CANCELLATION_RETURN','NO_SHOW_DEDUCT','NO_SHOW_RETURN'
  );

create or replace function membership_credit_state(p_membership_id uuid)
returns table (allocated int, reserved int, consumed int, available int)
language sql stable as $$
  select
    coalesce(sum(delta_allocated),0)::int,
    coalesce(sum(delta_reserved),0)::int,
    coalesce(sum(delta_consumed),0)::int,
    (coalesce(sum(delta_allocated),0) - coalesce(sum(delta_reserved),0)
     - coalesce(sum(delta_consumed),0))::int
  from membership_credit_ledger where membership_id = p_membership_id
$$;


-- ==========================================
-- Migration: 0004_schedule.sql
-- ==========================================

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


-- ==========================================
-- Migration: 0005_bookings.sql
-- ==========================================

-- 0005_bookings.sql
-- Sections 14,17,18,32: a booking holds many independent participants.
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
create index casual_customers_phone_idx on casual_customers (phone);

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
create index bookings_slot_idx on bookings (slot_id, status);
create index bookings_status_idx on bookings (status, created_at);
create index bookings_pending_expiry_idx on bookings (pending_expires_at) where status = 'PENDING';

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
create index booking_participants_booking_idx on booking_participants (booking_id);
create index booking_participants_member_idx on booking_participants (member_id);
-- A member cannot appear twice in the same booking.
create unique index booking_participants_unique_member
  on booking_participants (booking_id, member_id) where member_id is not null;

create table booking_status_history (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  from_status booking_status,
  to_status   booking_status not null,
  actor_id    uuid references users(id),
  reason      text,
  created_at  timestamptz not null default now()
);
create index booking_status_history_idx on booking_status_history (booking_id, created_at);

create table booking_slot_history (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references bookings(id) on delete cascade,
  from_slot_id uuid references session_slots(id),
  to_slot_id   uuid not null references session_slots(id),
  actor_id     uuid references users(id),
  reason       text,
  created_at   timestamptz not null default now()
);

create table attendance_records (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references bookings(id) on delete restrict,
  participant_id uuid not null references booking_participants(id) on delete restrict,
  status        attendance_status not null,
  credit_action text check (credit_action in ('CONSUMED','RETURNED','NOT_APPLICABLE')),
  reason        text,
  resolved_by   uuid references users(id),
  resolved_at   timestamptz not null default now(),
  unique (participant_id)
);

alter table membership_credit_ledger
  add constraint credit_ledger_booking_fk foreign key (booking_id) references bookings(id),
  add constraint credit_ledger_participant_fk foreign key (participant_id) references booking_participants(id);


-- ==========================================
-- Migration: 0006_renewal_payment_notifications.sql
-- ==========================================

-- 0006_renewal_payment_notifications.sql
-- Sections 27,28,29,30,37.
create table payment_orders (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null default 'MANUAL_WHATSAPP',
  provider_ref    text,
  member_id       uuid references members(id),
  membership_id   uuid references memberships(id),
  amount_idr      numeric(12,0) not null check (amount_idr >= 0),
  status          payment_status not null default 'PENDING',
  idempotency_key text unique,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table payment_transactions (
  id               uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references payment_orders(id) on delete restrict,
  provider_event_id text,
  status           payment_status not null,
  amount_idr       numeric(12,0) not null,
  raw_payload      jsonb,
  confirmed_by     uuid references users(id),
  created_at       timestamptz not null default now(),
  unique (payment_order_id, provider_event_id)
);

create table renewal_requests (
  id                     uuid primary key default gen_random_uuid(),
  member_id              uuid not null references members(id),
  previous_membership_id uuid references memberships(id),
  requested_plan_id      uuid not null references membership_plans(id),
  base_price_idr         numeric(12,0) not null,
  discount_idr           numeric(12,0) not null default 0,
  final_price_idr        numeric(12,0) not null,
  payment_order_id       uuid references payment_orders(id),
  status                 text not null default 'PENDING'
                         check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  new_membership_id      uuid references memberships(id),
  admin_notes            text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  event_type  text not null,
  title       text not null,
  body        text not null,
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  delivery_status text not null default 'QUEUED'
                  check (delivery_status in ('QUEUED','SENT','FAILED','SKIPPED')),
  delivery_error text,
  dedupe_key  text,
  created_at  timestamptz not null default now()
);
-- Section 64.20: repeated dispatch must not duplicate records.
create unique index notifications_dedupe_idx on notifications (dedupe_key) where dedupe_key is not null;
create index notifications_user_idx on notifications (user_id, created_at desc);

create table user_devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  device_token text not null,
  platform     text not null check (platform in ('WEB','ANDROID','IOS')),
  is_active    boolean not null default true,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (device_token)
);

create table integration_sync_jobs (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,
  entity_id    uuid not null,
  target       text not null default 'GOOGLE_SHEETS',
  operation    text not null check (operation in ('UPSERT','DELETE')),
  status       sync_status not null default 'QUEUED',
  attempts     integer not null default 0,
  last_error   text,
  next_retry_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- Section 37: one queued job per entity/target keeps retries from duplicating rows.
create unique index sync_jobs_pending_unique
  on integration_sync_jobs (entity_type, entity_id, target)
  where status in ('QUEUED','RUNNING');
create index sync_jobs_retry_idx on integration_sync_jobs (status, next_retry_at);


-- ==========================================
-- Migration: 0007_domain_functions.sql
-- ==========================================

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


-- ==========================================
-- Migration: 0008_rls.sql
-- ==========================================

-- 0008_rls.sql — Section 45. Deny by default; every mutation goes through a
-- server-side SECURITY DEFINER function, never a direct client write.
alter table users                      enable row level security;
alter table members                    enable row level security;
alter table membership_plans           enable row level security;
alter table memberships                enable row level security;
alter table membership_credit_ledger   enable row level security;
alter table operating_schedules        enable row level security;
alter table schedule_overrides         enable row level security;
alter table session_slots              enable row level security;
alter table bookings                   enable row level security;
alter table booking_participants       enable row level security;
alter table booking_status_history     enable row level security;
alter table booking_slot_history       enable row level security;
alter table attendance_records         enable row level security;
alter table casual_customers           enable row level security;
alter table renewal_requests           enable row level security;
alter table payment_orders             enable row level security;
alter table payment_transactions       enable row level security;
alter table notifications              enable row level security;
alter table user_devices               enable row level security;
alter table system_settings            enable row level security;
alter table audit_logs                 enable row level security;
alter table integration_sync_jobs      enable row level security;

-- users -----------------------------------------------------------------
create policy users_self_select on users for select using (id = auth.uid() or is_admin());
create policy users_self_update on users for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from users u where u.id = auth.uid()));
create policy users_admin_all on users for all using (is_admin()) with check (is_admin());

-- members ---------------------------------------------------------------
create policy members_self on members for select
  using (user_id = auth.uid() or is_admin()
         or (current_app_role() = 'GROOMER' and exists (
              select 1 from booking_participants bp
              join bookings b on b.id = bp.booking_id
              join session_slots s on s.id = b.slot_id
              where bp.member_id = members.id and s.slot_date = current_date)));
create policy members_admin on members for all using (is_admin()) with check (is_admin());

-- plans & slots are public read (Section 4: guests may browse) -----------
create policy plans_public_read on membership_plans for select using (is_active or is_admin());
create policy plans_admin on membership_plans for all using (is_admin()) with check (is_admin());
create policy slots_public_read on session_slots for select using (true);
create policy slots_admin on session_slots for all using (is_admin()) with check (is_admin());
create policy schedules_public_read on operating_schedules for select using (true);
create policy schedules_admin on operating_schedules for all using (is_admin()) with check (is_admin());
create policy overrides_read on schedule_overrides for select using (true);
create policy overrides_admin on schedule_overrides for all using (is_admin()) with check (is_admin());

-- memberships & credits: strictly owner or admin (groomer excluded) ------
create policy memberships_owner on memberships for select
  using (member_id = current_member_id() or is_admin());
create policy memberships_admin on memberships for all using (is_admin()) with check (is_admin());
create policy ledger_owner on membership_credit_ledger for select
  using (member_id = current_member_id() or is_admin());
create policy ledger_admin on membership_credit_ledger for all using (is_admin()) with check (is_admin());

-- bookings --------------------------------------------------------------
create policy bookings_read on bookings for select using (
  is_admin()
  or exists (select 1 from booking_participants bp
             where bp.booking_id = bookings.id and bp.member_id = current_member_id())
  or (current_app_role() = 'GROOMER' and exists (
        select 1 from session_slots s where s.id = bookings.slot_id
          and s.slot_date between current_date - 1 and current_date + 7))
);
create policy bookings_admin on bookings for all using (is_admin()) with check (is_admin());

create policy participants_read on booking_participants for select using (
  is_admin() or member_id = current_member_id()
  or (current_app_role() = 'GROOMER' and exists (
        select 1 from bookings b join session_slots s on s.id = b.slot_id
        where b.id = booking_participants.booking_id
          and s.slot_date between current_date - 1 and current_date + 7))
);
create policy participants_admin on booking_participants for all using (is_admin()) with check (is_admin());

create policy status_history_read on booking_status_history for select using (
  is_admin() or exists (select 1 from booking_participants bp
    where bp.booking_id = booking_status_history.booking_id and bp.member_id = current_member_id()));
create policy slot_history_read on booking_slot_history for select using (
  is_admin() or exists (select 1 from booking_participants bp
    where bp.booking_id = booking_slot_history.booking_id and bp.member_id = current_member_id()));
create policy attendance_read on attendance_records for select using (
  is_admin() or current_app_role() = 'GROOMER'
  or exists (select 1 from booking_participants bp
    where bp.id = attendance_records.participant_id and bp.member_id = current_member_id()));
create policy attendance_admin on attendance_records for all using (is_admin()) with check (is_admin());

-- casual customers: admin only (contains contact details) ----------------
create policy casual_admin on casual_customers for all using (is_admin()) with check (is_admin());

-- renewals & payments: owner read, admin write --------------------------
create policy renewals_owner on renewal_requests for select
  using (member_id = current_member_id() or is_admin());
create policy renewals_admin on renewal_requests for all using (is_admin()) with check (is_admin());
create policy payment_orders_owner on payment_orders for select
  using (member_id = current_member_id() or is_admin());
create policy payment_orders_admin on payment_orders for all using (is_admin()) with check (is_admin());
create policy payment_txn_admin on payment_transactions for all using (is_admin()) with check (is_admin());

-- notifications & devices ------------------------------------------------
create policy notifications_owner on notifications for select using (user_id = auth.uid() or is_admin());
create policy notifications_mark_read on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy devices_owner on user_devices for all
  using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());

-- settings / audit / sync: admin only ------------------------------------
create policy settings_read on system_settings for select using (auth.uid() is not null);
create policy settings_admin on system_settings for all using (is_admin()) with check (is_admin());
create policy audit_admin on audit_logs for all using (is_admin()) with check (is_admin());
create policy sync_admin on integration_sync_jobs for all using (is_admin()) with check (is_admin());


-- ==========================================
-- Migration: 0009_seed_configuration.sql
-- ==========================================

-- 0009_seed_configuration.sql — configuration, not sample data.
-- Locked business values (Section 61) enter the system here as configuration.
insert into system_settings (key, value, value_type, description) values
  ('booking_window_days',            '7',      'int',    'Section 17: max days ahead a member may book'),
  ('max_active_future_bookings',     '2',      'int',    'Section 17'),
  ('cancellation_deadline_hours',    '6',      'int',    'Section 23'),
  ('default_session_capacity',       '2',      'int',    'Section 12'),
  ('pending_timeout_minutes',        '1440',   'int',    'Section 19'),
  ('slot_interval_minutes',          '60',     'int',    'Section 11'),
  ('session_duration_minutes',       '45',     'int',    'Section 9'),
  ('casual_price_idr',               '200000', 'int',    'Section 6'),
  ('slot_generation_horizon_days',   '30',     'int',    'Section 48'),
  ('timezone',                       '"Asia/Makassar"', 'string', 'Balikpapan / WITA'),
  ('sync_max_attempts',              '5',      'int',    'Section 37')
on conflict (key) do nothing;

insert into membership_plans (code, name, price_idr, extension_discount_idr, credits, duration_months) values
  ('GOLD',   'Gold',   1600000, 100000, 10, 3),
  ('SILVER', 'Silver',  850000, 100000,  5, 3)
on conflict (code) do nothing;

-- Section 10: operating blocks. Slots are derived, never listed by hand.
-- Morning block 07:00-11:00 -> 07,08,09,10 (10:45 end fits, 11:45 does not).
-- Afternoon block 13:00-18:00 -> 13,14,15,16,17.
insert into operating_schedules (day_of_week, block, start_time, end_time) 
select d, 'MORNING'::operating_block, '07:00', '11:00' from generate_series(0,6) d
on conflict do nothing;
insert into operating_schedules (day_of_week, block, start_time, end_time)
select d, 'AFTERNOON'::operating_block, '13:00', '18:00' from generate_series(0,6) d
on conflict do nothing;


