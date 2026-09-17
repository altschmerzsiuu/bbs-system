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
