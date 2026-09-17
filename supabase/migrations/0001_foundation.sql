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
