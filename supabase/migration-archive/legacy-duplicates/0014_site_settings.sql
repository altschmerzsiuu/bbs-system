-- 0014_site_settings.sql

create table site_settings (
  id integer primary key default 1 check (id = 1), -- Ensure only one row exists
  reschedule_hours integer not null default 24,
  package_validity_months integer not null default 6,
  basic_price_idr numeric not null default 250000,
  gold_price_idr numeric not null default 3500000,
  admin_whatsapp text not null default '8123194014',
  updated_at timestamptz not null default now()
);

-- RLS
alter table site_settings enable row level security;

-- Semua orang bisa membaca settings
create policy "site_settings_select" on site_settings for select using (true);

-- Hanya ADMIN yang bisa update
create policy "site_settings_update" on site_settings for update using (
  exists (select 1 from users where id = auth.uid() and role = 'ADMIN')
);

-- Insert row default
insert into site_settings (id) values (1) on conflict (id) do nothing;
