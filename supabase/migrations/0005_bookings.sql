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
