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
