-- 0016_notifications.sql
-- Notification Architecture Database Foundation (O4.5A)

create type notification_channel as enum ('FCM', 'EMAIL', 'WHATSAPP');
create type notification_status as enum ('PENDING', 'SENT', 'FAILED');

-- ---------------------------------------------------------------------------
-- FCM Tokens
-- Stores user device registration tokens for push notifications.
-- A single user can have multiple devices/tokens.
-- ---------------------------------------------------------------------------
create table fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null,
  device_info jsonb,
  last_active timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fcm_tokens_token_key unique (token)
);

create index fcm_tokens_user_idx on fcm_tokens (user_id);

alter table fcm_tokens enable row level security;

-- Members can manage their own tokens (e.g., register a new browser session)
create policy "Users can manage their own FCM tokens"
  on fcm_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admins can view all tokens for operational debugging
create policy "Admins can view all FCM tokens"
  on fcm_tokens for select
  using (is_admin());


-- ---------------------------------------------------------------------------
-- Notification Outbox
-- The transactional delivery queue. Inserted atomically with domain events.
-- ---------------------------------------------------------------------------
create table notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,          -- e.g., 'BOOKING_CONFIRMED'
  aggregate_type text not null,      -- e.g., 'booking'
  aggregate_id uuid not null,        -- e.g., booking_id
  recipient_user_id uuid not null references users(id) on delete cascade,
  channel notification_channel not null,
  payload jsonb not null,            -- Contains safe display values (e.g. slot_time, horse_name), no secrets
  status notification_status not null default 'PENDING',
  attempts int not null default 0,
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

-- Idempotency Constraint
-- Prevents the same logical notification (same event on same aggregate for same user on same channel)
-- from being inserted multiple times (e.g. if a cron job retries an RPC).
create unique index notification_outbox_idempotency_idx
  on notification_outbox (event_type, aggregate_id, recipient_user_id, channel);

-- Worker Index
-- Highly optimized index for the background delivery worker to quickly find pending jobs.
create index notification_outbox_worker_idx
  on notification_outbox (status, available_at)
  where status = 'PENDING';

-- Recipient Index
-- Useful for admins looking up notification history, or potential future in-app read models.
create index notification_outbox_recipient_idx
  on notification_outbox (recipient_user_id, created_at desc);

-- Aggregate Index
-- Useful to quickly see all notifications emitted for a specific booking/membership.
create index notification_outbox_aggregate_idx
  on notification_outbox (aggregate_type, aggregate_id);

alter table notification_outbox enable row level security;

-- Outbox is an internal operational queue.
-- Members can only READ their own outbox (e.g., if we ever expose delivery status to them).
-- They CANNOT insert, update, or delete. Server inserts via Service Role or Security Definer.
create policy "Users can view their own outbox records"
  on notification_outbox for select
  using (recipient_user_id = auth.uid());

create policy "Admins can view all outbox records"
  on notification_outbox for select
  using (is_admin());
