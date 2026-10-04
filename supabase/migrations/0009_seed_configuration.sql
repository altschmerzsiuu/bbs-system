-- 0009_seed_configuration.sql — configuration, not sample data.
-- Locked business values (Section 61) enter the system here as configuration.
insert into system_settings (key, value, value_type, description) values
  ('booking_window_days',            '7',      'int',    'Section 17: max days ahead a member may book'),
  ('max_active_future_bookings',     '2',      'int',    'Section 17'),
  ('cancellation_deadline_hours',    '6',      'int',    'Section 23'),
  ('default_session_capacity',       '2',      'int',    'Section 12'),
  ('pending_timeout_minutes',        '1440',   'int',    'Section 19'),
  ('slot_interval_minutes',          '60',     'int',    'Section 11'),
  ('session_duration_minutes',       '60',     'int',    'Section 9'),
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
