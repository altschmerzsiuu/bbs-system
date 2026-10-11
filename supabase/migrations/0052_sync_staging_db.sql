-- ==============================================================================
-- 0052_sync_staging_db.sql
-- Synchronize Staging Supabase DB (rvovstdskzbszckpetfb) with Production Schema
-- Safe to run multiple times (IDEMPOTENT)
-- ==============================================================================

-- 1. ENUMS & EXTENSIONS
-- ------------------------------------------------------------------------------
ALTER TYPE notification_channel ADD VALUE IF NOT EXISTS 'FCM';

DO $$ BEGIN
  CREATE TYPE riding_request_type AS ENUM ('CASUAL_RIDE', 'JOY_RIDE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE riding_request_status AS ENUM ('UNDER_REVIEW', 'CONFIRMED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE attendance_method AS ENUM ('MEMBER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 2. CREATE MISSING TABLES
-- ------------------------------------------------------------------------------

-- site_settings
CREATE TABLE IF NOT EXISTS public.site_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  reschedule_hours integer NOT NULL DEFAULT 24,
  admin_whatsapp text NOT NULL DEFAULT '8123194014',
  updated_at timestamptz NOT NULL DEFAULT now(),
  max_weekly_bookings integer DEFAULT 2,
  cancellation_hours integer DEFAULT 8,
  photographer_enabled boolean DEFAULT true
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_settings_select" ON public.site_settings;
CREATE POLICY "site_settings_select" ON public.site_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "site_settings_update" ON public.site_settings;
CREATE POLICY "site_settings_update" ON public.site_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
);

INSERT INTO public.site_settings (id, reschedule_hours, admin_whatsapp, max_weekly_bookings, cancellation_hours, photographer_enabled)
VALUES (1, 24, '8123194014', 2, 8, true)
ON CONFLICT (id) DO UPDATE SET
  max_weekly_bookings = COALESCE(public.site_settings.max_weekly_bookings, EXCLUDED.max_weekly_bookings),
  cancellation_hours = COALESCE(public.site_settings.cancellation_hours, EXCLUDED.cancellation_hours),
  photographer_enabled = COALESCE(public.site_settings.photographer_enabled, EXCLUDED.photographer_enabled);


-- riding_requests
CREATE TABLE IF NOT EXISTS public.riding_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  human_id text NOT NULL UNIQUE,
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  casual_customer_id uuid REFERENCES public.casual_customers(id) ON DELETE CASCADE,
  request_type riding_request_type NOT NULL,
  preferred_date date NOT NULL,
  preferred_time_start time NOT NULL,
  height_cm numeric(5,2) NOT NULL,
  weight_kg numeric(5,2) NOT NULL,
  shoe_size integer,
  status riding_request_status NOT NULL DEFAULT 'UNDER_REVIEW',
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT has_owner CHECK (member_id IS NOT NULL OR casual_customer_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS riding_requests_human_idx ON public.riding_requests(human_id);
CREATE INDEX IF NOT EXISTS riding_requests_member_idx ON public.riding_requests(member_id);
CREATE INDEX IF NOT EXISTS riding_requests_casual_idx ON public.riding_requests(casual_customer_id);
CREATE INDEX IF NOT EXISTS riding_requests_status_idx ON public.riding_requests(status);

ALTER TABLE public.riding_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS riding_requests_admin ON public.riding_requests;
CREATE POLICY riding_requests_admin ON public.riding_requests FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- 3. ADD MISSING COLUMNS TO EXISTING TABLES
-- ------------------------------------------------------------------------------

-- members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS domicile text,
  ADD COLUMN IF NOT EXISTS height_cm numeric(5,2),
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2),
  ADD COLUMN IF NOT EXISTS shoe_size numeric(4,1);

-- membership_applications
ALTER TABLE public.membership_applications
  ADD COLUMN IF NOT EXISTS human_id text,
  ADD COLUMN IF NOT EXISTS receipt_path text,
  ADD COLUMN IF NOT EXISTS receipt_filename text,
  ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Ensure membership_applications status constraint includes payment flow
ALTER TABLE public.membership_applications DROP CONSTRAINT IF EXISTS membership_applications_status_check;
ALTER TABLE public.membership_applications ADD CONSTRAINT membership_applications_status_check CHECK (
  status IN ('PENDING_REVIEW', 'APPROVED', 'PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED', 'ACTIVATED', 'REJECTED', 'CANCELLED')
);

-- booking_participants
ALTER TABLE public.booking_participants
  ADD COLUMN IF NOT EXISTS participant_status booking_status DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS requested_slot_id uuid REFERENCES public.session_slots(id),
  ADD COLUMN IF NOT EXISTS attendance_status attendance_status DEFAULT 'ATTENDED',
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_in_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS check_in_method attendance_method;


-- 4. STORAGE BUCKET: payment_proofs
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment_proofs', 
  'payment_proofs', 
  false, 
  5242880, 
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment_proofs');

DROP POLICY IF EXISTS "Users can read own payment proofs or admin can read all" ON storage.objects;
CREATE POLICY "Users can read own payment proofs or admin can read all"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment_proofs' AND (
    auth.uid() = owner OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  )
);


-- 5. REALTIME REPLICA IDENTITY
-- ------------------------------------------------------------------------------
ALTER TABLE public.session_slots REPLICA IDENTITY FULL;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.booking_participants REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.session_slots, public.bookings, public.booking_participants;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;


-- 6. CORE DOMAIN FUNCTIONS / RPCs
-- ------------------------------------------------------------------------------

-- approve_riding_request
CREATE OR REPLACE FUNCTION public.approve_riding_request(
  p_request_id uuid,
  p_slot_id uuid,
  p_horse_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req riding_requests%ROWTYPE;
  v_slot session_slots%ROWTYPE;
  v_booking_id uuid;
  v_participant_id uuid;
  v_available int;
  v_member members%ROWTYPE;
  v_user_id uuid;
BEGIN
  SELECT * INTO v_req FROM riding_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM raise_domain_error('REQUEST_NOT_FOUND'); END IF;
  IF v_req.status != 'UNDER_REVIEW' THEN PERFORM raise_domain_error('INVALID_REQUEST_STATUS'); END IF;

  SELECT * INTO v_slot FROM session_slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM raise_domain_error('SLOT_NOT_FOUND'); END IF;
  IF NOT v_slot.is_open THEN PERFORM raise_domain_error('SLOT_CLOSED'); END IF;

  v_available := v_slot.capacity - slot_occupancy(p_slot_id);
  IF v_available < 1 THEN PERFORM raise_domain_error('SLOT_FULL'); END IF;

  IF v_req.member_id IS NOT NULL THEN
    SELECT * INTO v_member FROM members WHERE id = v_req.member_id;
    v_user_id := v_member.user_id;
  ELSE
    SELECT id INTO v_user_id FROM users WHERE role = 'ADMIN' LIMIT 1;
  END IF;

  INSERT INTO bookings (
    slot_id, created_by, status, is_casual, notes
  ) VALUES (
    p_slot_id, v_user_id, 'CONFIRMED', (v_req.member_id IS NULL), 'Created from request ' || v_req.human_id
  ) RETURNING id INTO v_booking_id;

  INSERT INTO booking_participants (
    booking_id, participant_type, member_id, casual_customer_id, horse_id, participant_status
  ) VALUES (
    v_booking_id,
    CASE WHEN v_req.member_id IS NOT NULL THEN 'MEMBER'::participant_type ELSE 'CASUAL'::participant_type END,
    v_req.member_id,
    v_req.casual_customer_id,
    p_horse_id,
    'CONFIRMED'
  ) RETURNING id INTO v_participant_id;

  UPDATE riding_requests
  SET status = 'CONFIRMED',
      booking_id = v_booking_id,
      updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  VALUES (v_booking_id, NULL, 'CONFIRMED', auth.uid(), 'Approved by admin from riding request');

  RETURN v_booking_id;
END;
$$;


-- cancel_booking (Dynamic cancellation_hours + Enum casting)
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id uuid, 
  p_actor_id uuid, 
  p_source text, 
  p_reason text
) RETURNS text
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_slot    session_slots%ROWTYPE;
  v_deadline_hours int := 8;
  v_starts_at timestamptz;
  v_late boolean;
  v_new_status booking_status;
  p RECORD;
  v_is_participant boolean;
BEGIN
  SELECT coalesce(cancellation_hours, 8) INTO v_deadline_hours FROM site_settings WHERE id = 1;
  IF v_deadline_hours IS NULL THEN
    v_deadline_hours := 8;
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM raise_domain_error('BOOKING_NOT_FOUND'); END IF;

  IF p_source = 'MEMBER' THEN
    SELECT EXISTS (
      SELECT 1 FROM booking_participants bp
      JOIN members m ON m.id = bp.member_id
      WHERE bp.booking_id = p_booking_id AND m.user_id = p_actor_id
    ) INTO v_is_participant;

    IF v_booking.created_by != p_actor_id AND NOT v_is_participant THEN
      PERFORM raise_domain_error('FORBIDDEN');
    END IF;
  END IF;

  IF v_booking.status NOT IN ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED') THEN
    PERFORM raise_domain_error('INVALID_BOOKING_STATUS');
  END IF;

  SELECT * INTO v_slot FROM session_slots WHERE id = v_booking.slot_id;
  v_starts_at := (v_slot.slot_date + v_slot.start_time) AT TIME ZONE 'Asia/Jakarta';
  v_late := (p_source = 'MEMBER')
            AND now() > v_starts_at - (v_deadline_hours || ' hours')::interval;
  v_new_status := CASE WHEN p_source = 'BBS' THEN 'BBS_CANCELLED' ELSE 'MEMBER_CANCELLED' END;

  FOR p IN
    SELECT bp.* FROM booking_participants bp
    WHERE bp.booking_id = p_booking_id AND bp.participant_type = 'MEMBER'
    ORDER BY bp.membership_id
  LOOP
    IF EXISTS (SELECT 1 FROM membership_credit_ledger
               WHERE participant_id = p.id AND txn_type = 'SESSION_RESERVED'::credit_txn_type) THEN
      IF v_late THEN
        INSERT INTO membership_credit_ledger
          (membership_id, member_id, booking_id, participant_id, txn_type,
           delta_reserved, delta_consumed, reason, actor_id)
        VALUES (p.membership_id, p.member_id, p_booking_id, p.id, 'LATE_CANCELLATION'::credit_txn_type,
                -1, 1, p_reason, p_actor_id);
      ELSE
        INSERT INTO membership_credit_ledger
          (membership_id, member_id, booking_id, participant_id, txn_type,
           delta_reserved, reason, actor_id)
        VALUES (p.membership_id, p.member_id, p_booking_id, p.id,
                (CASE WHEN p_source = 'BBS' THEN 'BBS_CANCELLATION_RETURN'
                     ELSE 'EARLY_CANCELLATION_RETURN' END)::credit_txn_type,
                -1, p_reason, p_actor_id);
      END IF;
    END IF;
  END LOOP;

  UPDATE bookings
     SET status = v_new_status, cancellation_reason = p_reason,
         cancelled_by = p_actor_id, cancelled_at = now(), updated_at = now()
   WHERE id = p_booking_id;
  INSERT INTO booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  VALUES (p_booking_id, v_booking.status, v_new_status, p_actor_id, p_reason);

  RETURN CASE WHEN v_late THEN 'LATE' ELSE 'EARLY' END;
END $$;


-- create_member_booking (Strict dynamic weekly limit & FCM admin notification)
CREATE OR REPLACE FUNCTION public.create_member_booking(
  p_booking_owner_id uuid,
  p_slot_id uuid,
  p_participants jsonb,
  p_actor_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_slot session_slots%ROWTYPE;
  v_available int;
  v_booking_id uuid;
  v_window_days int := setting_int('booking_window_days', 7);
  v_max_active int := setting_int('max_active_future_bookings', 2);
  v_timeout_min int := setting_int('pending_timeout_minutes', 1440);
  v_max_weekly_sessions int := 4;
  v_active_count int;
  v_weekly_count int;
  v_num_participants int;
  v_participant jsonb;
  v_member_id uuid;
  v_membership memberships%ROWTYPE;
  v_casual_id uuid;
  v_slot_week_start date;
  v_slot_week_end date;
  v_admin_user_id uuid;
BEGIN
  v_num_participants := jsonb_array_length(p_participants);
  IF v_num_participants = 0 THEN
    PERFORM raise_domain_error('NO_PARTICIPANTS');
  END IF;

  -- Concurrency Lock
  PERFORM 1 FROM users WHERE id = p_actor_id FOR UPDATE;

  -- 1. Slot check
  SELECT * INTO v_slot FROM session_slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM raise_domain_error('SLOT_NOT_FOUND'); END IF;
  IF NOT v_slot.is_open THEN PERFORM raise_domain_error('SLOT_CLOSED'); END IF;

  -- 2. Booking window
  IF v_slot.slot_date < current_date THEN PERFORM raise_domain_error('SLOT_IN_PAST'); END IF;
  IF v_slot.slot_date > current_date + (v_window_days || ' days')::interval THEN
    PERFORM raise_domain_error('BOOKING_WINDOW_EXCEEDED');
  END IF;

  -- 3. Dynamic weekly booking limit from site_settings
  SELECT coalesce(max_weekly_bookings, 4) INTO v_max_weekly_sessions FROM site_settings WHERE id = 1;
  IF v_max_weekly_sessions IS NULL THEN
    v_max_weekly_sessions := 4;
  END IF;

  IF v_max_weekly_sessions < 999 THEN
    v_max_active := greatest(v_max_active, v_max_weekly_sessions);

    -- 3A. Active future booking limit
    SELECT count(*) INTO v_active_count
    FROM bookings b
    WHERE b.created_by = p_actor_id
      AND b.status IN ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED')
      AND EXISTS (
        SELECT 1 FROM session_slots s WHERE s.id = b.slot_id AND (s.slot_date + s.start_time) > now()
      );

    IF v_active_count >= v_max_active THEN
      PERFORM raise_domain_error('ACTIVE_BOOKING_LIMIT_REACHED');
    END IF;

    -- 3B. Weekly frequency limit (Monday to Sunday)
    v_slot_week_start := date_trunc('week', v_slot.slot_date::timestamp)::date;
    v_slot_week_end := v_slot_week_start + interval '6 days';

    SELECT count(DISTINCT b.id) INTO v_weekly_count
    FROM bookings b
    JOIN session_slots s ON s.id = b.slot_id
    WHERE (b.created_by = p_actor_id OR EXISTS (
      SELECT 1 FROM booking_participants bp
      WHERE bp.booking_id = b.id AND bp.member_id = p_booking_owner_id
    ))
      AND b.status IN ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED','COMPLETED')
      AND s.slot_date BETWEEN v_slot_week_start AND v_slot_week_end;

    IF v_weekly_count >= v_max_weekly_sessions THEN
      PERFORM raise_domain_error('WEEKLY_BOOKING_LIMIT_REACHED');
    END IF;
  END IF;

  -- 4. Capacity check
  IF slot_occupancy(p_slot_id) + v_num_participants > v_slot.capacity THEN
    PERFORM raise_domain_error('SLOT_FULL');
  END IF;

  -- 5. Insert Booking (PENDING)
  INSERT INTO bookings (
    slot_id,
    created_by,
    status,
    is_casual,
    pending_expires_at,
    notes
  ) VALUES (
    p_slot_id,
    p_actor_id,
    'PENDING',
    false,
    now() + (v_timeout_min || ' minutes')::interval,
    'Submitted by member'
  ) RETURNING id INTO v_booking_id;

  -- 6. Insert Participants
  FOR v_participant IN SELECT * FROM jsonb_array_elements(p_participants) LOOP
    IF v_participant->>'type' = 'MEMBER' THEN
      v_member_id := (v_participant->>'member_id')::uuid;

      -- Double booking check
      IF EXISTS (
        SELECT 1 FROM booking_participants bp
        JOIN bookings b ON b.id = bp.booking_id
        WHERE bp.member_id = v_member_id
          AND b.slot_id = p_slot_id
          AND b.status IN ('PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED')
      ) THEN
        PERFORM raise_domain_error('ALREADY_BOOKED_FOR_SLOT');
      END IF;

      SELECT * INTO v_membership FROM memberships
      WHERE member_id = v_member_id AND status = 'ACTIVE' FOR UPDATE;

      IF NOT FOUND OR v_slot.slot_date > v_membership.end_date THEN
        PERFORM raise_domain_error('MEMBERSHIP_EXPIRED');
      END IF;

      SELECT available INTO v_available FROM membership_credit_state(v_membership.id);
      IF v_available <= 0 THEN
        PERFORM raise_domain_error('INSUFFICIENT_CREDITS');
      END IF;

      INSERT INTO booking_participants (booking_id, participant_type, member_id, membership_id, participant_status)
      VALUES (v_booking_id, 'MEMBER', v_member_id, v_membership.id, 'PENDING');

    ELSIF v_participant->>'type' = 'CASUAL' THEN
      INSERT INTO casual_customers (full_name, phone)
      VALUES (v_participant->>'full_name', v_participant->>'phone')
      RETURNING id INTO v_casual_id;

      INSERT INTO booking_participants (booking_id, participant_type, casual_customer_id, participant_status)
      VALUES (v_booking_id, 'CASUAL', v_casual_id, 'PENDING');
    ELSE
      PERFORM raise_domain_error('INVALID_PARTICIPANT_TYPE');
    END IF;
  END LOOP;

  INSERT INTO booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  VALUES (v_booking_id, NULL, 'PENDING', p_actor_id, 'member submission');

  -- 7. Notify admins via FCM channel in notification_outbox
  FOR v_admin_user_id IN SELECT id FROM users WHERE role = 'ADMIN' LOOP
    INSERT INTO notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
    VALUES (
      'NEW_BOOKING_REQUEST',
      'BOOKING',
      v_booking_id,
      v_admin_user_id,
      'FCM'::notification_channel,
      jsonb_build_object(
        'booking_id', v_booking_id,
        'slot_date', v_slot.slot_date,
        'start_time', v_slot.start_time
      )
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN v_booking_id;
END;
$function$;
