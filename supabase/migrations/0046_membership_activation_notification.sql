-- 0046_membership_activation_notification.sql
-- Adds the persistent in-app inbox notification (public.notifications) to
-- confirm_and_activate_membership(), atomically alongside the notification_outbox (FCM)
-- insert, and fixes the FCM payload so the adapter can render the message.
-- 0042 is already applied in Production and is intentionally left untouched; this
-- redefines the function only. Depends on 0045 (activate_membership sets
-- membership_applications.new_membership_id).
--
-- notifications.delivery_status CHECK (0006) allows: QUEUED, SENT, FAILED, SKIPPED.
-- 'SENT' is valid: an in-app row needs no delivery worker (readable immediately).
--
-- FCM adapter (MEMBERSHIP_ACTIVATED) reads payload.plan_name and, for the data
-- payload, payload.membership_id. Sources:
--   plan_name     = membership_plans.name via membership_applications.requested_plan_id
--   membership_id = membership_applications.new_membership_id (the NEW membership created
--                   by activate_membership(), re-read after activation)

CREATE OR REPLACE FUNCTION confirm_and_activate_membership(
  p_application_id uuid,
  p_admin_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app record;
  v_user_id uuid;
  v_plan_name text;
  v_new_membership_id uuid;
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

  -- Newly created membership (v_app is stale: it was read before activation)
  SELECT ma.new_membership_id INTO v_new_membership_id
  FROM membership_applications ma
  WHERE ma.id = p_application_id;

  SELECT mp.name INTO v_plan_name
  FROM membership_plans mp
  WHERE mp.id = v_app.requested_plan_id;

  -- Member notification: FCM push via outbox
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
    jsonb_build_object(
      'plan_name', v_plan_name,
      'membership_id', v_new_membership_id
    )
  );

  -- Member notification: persistent in-app inbox (read by home activation popup)
  INSERT INTO notifications (
    user_id,
    event_type,
    title,
    body,
    data,
    delivery_status,
    dedupe_key
  ) VALUES (
    v_user_id,
    'MEMBERSHIP_ACTIVATED',
    'Membership Activated',
    CASE
      WHEN v_plan_name IS NOT NULL THEN 'Your ' || v_plan_name || ' membership is now active.'
      ELSE 'Your membership is now active.'
    END,
    jsonb_build_object(
      'application_id', p_application_id,
      'membership_id', v_new_membership_id
    ),
    'SENT',
    'MEMBERSHIP_ACTIVATED:' || p_application_id::text
  );

END;
$$;
