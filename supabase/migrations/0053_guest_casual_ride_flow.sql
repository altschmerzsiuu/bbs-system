-- ==============================================================================
-- 0053_guest_casual_ride_flow.sql
-- Public Guest Flow (Non-Member Casual Ride / Joy Ride without Login)
-- Note: Do NOT add any anon RLS policies. All public guest operations go through
-- server actions using the service role client.
-- ==============================================================================

-- 0. Ensure attendance_status enum has NOT_CHECKED_IN (missing in 0052_sync_staging_db)
-- ------------------------------------------------------------------------------
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'NOT_CHECKED_IN';

-- 1. Extend casual_customers for guest profile & normalized phone uniqueness
-- ------------------------------------------------------------------------------
ALTER TABLE public.casual_customers
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS domicile text,
  ADD COLUMN IF NOT EXISTS height_cm numeric(5,2),
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2),
  ADD COLUMN IF NOT EXISTS shoe_size integer;

-- Deduplicate any existing duplicate phone numbers before creating unique index
DO $$
DECLARE
  r RECORD;
  v_keep_id uuid;
BEGIN
  FOR r IN
    SELECT phone
    FROM public.casual_customers
    GROUP BY phone
    HAVING count(*) > 1
  LOOP
    SELECT id INTO v_keep_id
    FROM public.casual_customers
    WHERE phone = r.phone
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1;

    UPDATE public.booking_participants
    SET casual_customer_id = v_keep_id
    WHERE casual_customer_id IN (
      SELECT id FROM public.casual_customers WHERE phone = r.phone AND id <> v_keep_id
    );

    UPDATE public.riding_requests
    SET casual_customer_id = v_keep_id
    WHERE casual_customer_id IN (
      SELECT id FROM public.casual_customers WHERE phone = r.phone AND id <> v_keep_id
    );

    DELETE FROM public.casual_customers
    WHERE phone = r.phone AND id <> v_keep_id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS casual_customers_phone_unique_idx
  ON public.casual_customers (phone);

-- Allow GROOMER (authenticated staff) to read casual_customers for active sessions
CREATE OR REPLACE FUNCTION public.authz_groomer_can_access_casual(p_casual_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN current_app_role() = 'GROOMER' AND EXISTS (
    SELECT 1
    FROM public.booking_participants bp
    JOIN public.bookings b ON b.id = bp.booking_id
    JOIN public.session_slots s ON s.id = b.slot_id
    WHERE bp.casual_customer_id = p_casual_id
      AND s.slot_date BETWEEN current_date - 1 AND current_date + 7
  );
END $$;

REVOKE ALL ON FUNCTION public.authz_groomer_can_access_casual(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.authz_groomer_can_access_casual(uuid) TO authenticated;

DROP POLICY IF EXISTS casual_groomer_select ON public.casual_customers;
CREATE POLICY casual_groomer_select ON public.casual_customers
  FOR SELECT TO authenticated
  USING (is_admin() OR authz_groomer_can_access_casual(id));


-- 2. Extend riding_requests for guest token, waiver, and guardian info
-- ------------------------------------------------------------------------------
ALTER TABLE public.riding_requests
  ADD COLUMN IF NOT EXISTS public_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS waiver_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS guardian_name text,
  ADD COLUMN IF NOT EXISTS guardian_phone text;

CREATE INDEX IF NOT EXISTS riding_requests_public_token_idx
  ON public.riding_requests (public_token);


-- 3. Create ride_products table for Casual / Joy Ride pricing
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ride_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  price_idr numeric(12,0) NOT NULL CHECK (price_idr >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ride_products ENABLE ROW LEVEL SECURITY;

-- Admin full access, authenticated users can read active products (NO anon policy)
DROP POLICY IF EXISTS ride_products_admin ON public.ride_products;
CREATE POLICY ride_products_admin ON public.ride_products
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS ride_products_authenticated_read ON public.ride_products;
CREATE POLICY ride_products_authenticated_read ON public.ride_products
  FOR SELECT TO authenticated
  USING (is_active OR is_admin());

INSERT INTO public.ride_products (code, name, description, price_idr, is_active)
VALUES
  ('CASUAL_RIDE', 'Casual / Fun Ride', 'Sesi berkuda sekali jalan (60 menit) didampingi instruktur profesional.', 250000, true),
  ('JOY_RIDE', 'Joy Ride', 'Pengenalan berkuda santai mengelilingi area stable & sesi foto bersama kuda.', 150000, true)
ON CONFLICT (code) DO NOTHING;


-- 4. Fix approve_riding_request to support both CASUAL and MEMBER participants,
--    re-check slot capacity under lock, and record price_idr + booking_id
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.approve_riding_request(uuid, date, time, integer, uuid);

CREATE OR REPLACE FUNCTION public.approve_riding_request(
  p_request_id uuid,
  p_date date,
  p_time time,
  p_capacity integer,
  p_actor_id uuid,
  p_price_idr numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.riding_requests%ROWTYPE;
  v_slot public.session_slots%ROWTYPE;
  v_slot_id uuid;
  v_booking_id uuid;
  v_price_idr numeric(12,0);
BEGIN
  -- 1. Lock and validate riding_requests row
  SELECT * INTO v_req
  FROM public.riding_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  IF v_req.status <> 'UNDER_REVIEW' THEN
    RAISE EXCEPTION 'REQUEST_NOT_UNDER_REVIEW';
  END IF;

  -- 2. Find or create session_slot, then lock the slot row
  SELECT id INTO v_slot_id
  FROM public.session_slots
  WHERE slot_date = p_date AND start_time = p_time;

  IF NOT FOUND THEN
    INSERT INTO public.session_slots (slot_date, start_time, end_time, block, capacity, is_open)
    VALUES (
      p_date,
      p_time,
      p_time + interval '1 hour',
      CASE
        WHEN extract(hour FROM p_time) < 12 THEN 'MORNING'::session_block
        ELSE 'AFTERNOON'::session_block
      END,
      COALESCE(NULLIF(p_capacity, 0), 2),
      true
    )
    RETURNING id INTO v_slot_id;
  END IF;

  SELECT * INTO v_slot
  FROM public.session_slots
  WHERE id = v_slot_id
  FOR UPDATE;

  IF NOT v_slot.is_open THEN
    RAISE EXCEPTION 'SLOT_CLOSED';
  END IF;

  -- 3. Re-check slot capacity via slot_occupancy under lock
  IF public.slot_occupancy(v_slot_id) + 1 > v_slot.capacity THEN
    RAISE EXCEPTION 'SLOT_FULL';
  END IF;

  -- 4. Resolve price_idr (admin override or ride_products default)
  IF p_price_idr IS NOT NULL THEN
    v_price_idr := p_price_idr;
  ELSE
    SELECT price_idr INTO v_price_idr
    FROM public.ride_products
    WHERE code = v_req.request_type::text AND is_active = true
    LIMIT 1;
  END IF;

  -- 5. Create confirmed casual booking
  INSERT INTO public.bookings (slot_id, status, is_casual, created_by, notes)
  VALUES (
    v_slot_id,
    'CONFIRMED',
    true,
    p_actor_id,
    'Created from riding request ' || v_req.human_id
  )
  RETURNING id INTO v_booking_id;

  -- 6. Create participant (CASUAL branch vs MEMBER branch)
  IF v_req.casual_customer_id IS NOT NULL THEN
    INSERT INTO public.booking_participants (
      booking_id,
      participant_type,
      casual_customer_id,
      price_idr,
      participant_status,
      attendance_status
    ) VALUES (
      v_booking_id,
      'CASUAL',
      v_req.casual_customer_id,
      v_price_idr,
      'CONFIRMED',
      'NOT_CHECKED_IN'
    );
  ELSIF v_req.member_id IS NOT NULL THEN
    INSERT INTO public.booking_participants (
      booking_id,
      participant_type,
      member_id,
      price_idr,
      participant_status,
      attendance_status
    ) VALUES (
      v_booking_id,
      'MEMBER',
      v_req.member_id,
      v_price_idr,
      'CONFIRMED',
      'NOT_CHECKED_IN'
    );
  ELSE
    RAISE EXCEPTION 'INVALID_REQUEST_OWNER';
  END IF;

  -- 7. Update request status and link booking_id
  UPDATE public.riding_requests
  SET status = 'CONFIRMED',
      booking_id = v_booking_id,
      updated_at = now()
  WHERE id = p_request_id;

  -- 8. Record booking status history
  INSERT INTO public.booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  VALUES (v_booking_id, NULL, 'CONFIRMED', p_actor_id, 'Approved riding request ' || v_req.human_id);

  RETURN v_booking_id;
END;
$$;

-- Also keep the slot_id-based overload in sync with p_price_idr
DROP FUNCTION IF EXISTS public.approve_riding_request(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.approve_riding_request(
  p_request_id uuid,
  p_slot_id uuid,
  p_horse_id uuid DEFAULT NULL,
  p_price_idr numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.riding_requests%ROWTYPE;
  v_slot public.session_slots%ROWTYPE;
  v_booking_id uuid;
  v_participant_id uuid;
  v_available int;
  v_member public.members%ROWTYPE;
  v_user_id uuid;
  v_price_idr numeric(12,0);
BEGIN
  SELECT * INTO v_req FROM public.riding_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM raise_domain_error('REQUEST_NOT_FOUND'); END IF;
  IF v_req.status != 'UNDER_REVIEW' THEN PERFORM raise_domain_error('INVALID_REQUEST_STATUS'); END IF;

  SELECT * INTO v_slot FROM public.session_slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM raise_domain_error('SLOT_NOT_FOUND'); END IF;
  IF NOT v_slot.is_open THEN PERFORM raise_domain_error('SLOT_CLOSED'); END IF;

  v_available := v_slot.capacity - public.slot_occupancy(p_slot_id);
  IF v_available < 1 THEN PERFORM raise_domain_error('SLOT_FULL'); END IF;

  IF p_price_idr IS NOT NULL THEN
    v_price_idr := p_price_idr;
  ELSE
    SELECT price_idr INTO v_price_idr
    FROM public.ride_products
    WHERE code = v_req.request_type::text AND is_active = true
    LIMIT 1;
  END IF;

  IF v_req.member_id IS NOT NULL THEN
    SELECT * INTO v_member FROM public.members WHERE id = v_req.member_id;
    v_user_id := v_member.user_id;
  ELSE
    SELECT id INTO v_user_id FROM public.users WHERE role = 'ADMIN' LIMIT 1;
  END IF;

  INSERT INTO public.bookings (
    slot_id, created_by, status, is_casual, notes
  ) VALUES (
    p_slot_id, v_user_id, 'CONFIRMED', true, 'Created from request ' || v_req.human_id
  ) RETURNING id INTO v_booking_id;

  IF v_req.casual_customer_id IS NOT NULL THEN
    INSERT INTO public.booking_participants (
      booking_id, participant_type, casual_customer_id, horse_id, price_idr, participant_status, attendance_status
    ) VALUES (
      v_booking_id, 'CASUAL', v_req.casual_customer_id, p_horse_id, v_price_idr, 'CONFIRMED', 'NOT_CHECKED_IN'
    ) RETURNING id INTO v_participant_id;
  ELSE
    INSERT INTO public.booking_participants (
      booking_id, participant_type, member_id, horse_id, price_idr, participant_status, attendance_status
    ) VALUES (
      v_booking_id, 'MEMBER', v_req.member_id, p_horse_id, v_price_idr, 'CONFIRMED', 'NOT_CHECKED_IN'
    ) RETURNING id INTO v_participant_id;
  END IF;

  UPDATE public.riding_requests
  SET status = 'CONFIRMED',
      booking_id = v_booking_id,
      updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  VALUES (v_booking_id, NULL, 'CONFIRMED', auth.uid(), 'Approved by admin from riding request');

  RETURN v_booking_id;
END;
$$;
