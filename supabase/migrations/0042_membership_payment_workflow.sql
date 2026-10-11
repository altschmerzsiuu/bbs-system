-- 0042_membership_payment_workflow.sql

-- 1. Alter membership_applications table to add payment fields
ALTER TABLE membership_applications
ADD COLUMN IF NOT EXISTS receipt_path text,
ADD COLUMN IF NOT EXISTS receipt_filename text,
ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 2. Alter status constraint to include PAYMENT_SUBMITTED
ALTER TABLE membership_applications DROP CONSTRAINT IF EXISTS membership_applications_status_check;
ALTER TABLE membership_applications ADD CONSTRAINT membership_applications_status_check CHECK (
  status IN ('PENDING_REVIEW', 'APPROVED', 'PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED', 'ACTIVATED', 'REJECTED', 'CANCELLED')
);

-- 3. Recreate the unique index to prevent duplicate renewals, including PAYMENT_SUBMITTED
DROP INDEX IF EXISTS membership_apps_one_active_per_member;
CREATE UNIQUE INDEX membership_apps_one_active_per_member 
ON membership_applications (member_id) 
WHERE status IN ('PENDING_REVIEW', 'APPROVED', 'PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED');

-- 4. Seed system settings for payment config
INSERT INTO system_settings (key, value, value_type, description) VALUES
  ('payment_bank_name', '"BCA"', 'string', 'Bank name for membership payment transfer'),
  ('payment_account_number', '"1490011867027"', 'string', 'Bank account number for membership payments'),
  ('payment_account_name', '"Borneo Berkuda Stable"', 'string', 'Bank account holder name'),
  ('qris_enabled', 'false', 'bool', 'Whether QRIS payment is enabled')
ON CONFLICT (key) DO NOTHING;

-- 5. Storage Bucket & RLS: 'payment_proofs'
-- ==============================================================================

-- Create bucket safely without mutating existing configs on prod
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment_proofs', 
  'payment_proofs', 
  false, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage.objects is already enabled by Supabase by default

-- Policy 1: Admin can access everything
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can access all payment proofs' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Admin can access all payment proofs" ON storage.objects
    FOR ALL USING (
      bucket_id = 'payment_proofs' AND is_admin()
    );
  END IF;
END $$;

-- Policy 2: Members can only INSERT to their own folder based on current_member_id()
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can upload their own proofs' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Members can upload their own proofs" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'payment_proofs' 
      AND auth.uid() IS NOT NULL
      AND (storage.foldername(name))[1] = current_member_id()::text
    );
  END IF;
END $$;

-- 6. Atomic RPC for Confirming Payment and Activating Membership
-- ==============================================================================
CREATE OR REPLACE FUNCTION confirm_and_activate_membership(
  p_application_id uuid,
  p_admin_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_app record;
  v_user_id uuid;
BEGIN
  -- Lock application FOR UPDATE
  SELECT * INTO v_app
  FROM membership_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF v_app IS NULL THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND';
  END IF;

  -- Strictly require PAYMENT_SUBMITTED
  IF v_app.status != 'PAYMENT_SUBMITTED' THEN
    RAISE EXCEPTION 'Application is not in PAYMENT_SUBMITTED state (current: %)', v_app.status;
  END IF;

  -- Ensure caller is an admin and matches the provided p_admin_id
  IF NOT is_admin() OR p_admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Update to PAYMENT_CONFIRMED first so activate_membership does not fail
  UPDATE membership_applications
  SET status = 'PAYMENT_CONFIRMED',
      updated_at = now()
  WHERE id = p_application_id;

  -- Call the existing activate_membership logic
  PERFORM activate_membership(p_application_id, p_admin_id);

  -- Fetch the actual user_id for the member to avoid PL/pgSQL variable conflicts
  SELECT m.user_id INTO v_user_id 
  FROM members m 
  WHERE m.id = v_app.member_id;

  -- Insert Member Notification (Atomic within this same transaction)
  INSERT INTO notification_outbox (
    event_type, 
    aggregate_type, 
    aggregate_id, 
    recipient_user_id, 
    channel, 
    payload
  ) VALUES (
    'MEMBERSHIP_ACTIVATED', 
    'membership_application', 
    p_application_id, 
    v_user_id, 
    'FCM', 
    '{}'::jsonb
  );

END;
$$;
