-- 0021_member_onboarding_fields.sql

-- 1. Add Operational fields to Members table
-- Note: age is derived dynamically from date_of_birth
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS domicile text,
ADD COLUMN IF NOT EXISTS height_cm numeric(5,2),
ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2),
ADD COLUMN IF NOT EXISTS shoe_size numeric(4,1);

-- 2. Ensure real Membership Plans exist
-- Using UPSERT so it safely runs even if they exist
INSERT INTO membership_plans (code, name, price_idr, extension_discount_idr, credits, duration_months, is_active)
VALUES 
  ('GOLD', 'Gold Package', 1600000, 100000, 10, 3, true),
  ('SILVER', 'Silver Package', 850000, 100000, 5, 3, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price_idr = EXCLUDED.price_idr,
  extension_discount_idr = EXCLUDED.extension_discount_idr,
  credits = EXCLUDED.credits,
  duration_months = EXCLUDED.duration_months,
  is_active = EXCLUDED.is_active;
