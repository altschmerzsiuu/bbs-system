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
