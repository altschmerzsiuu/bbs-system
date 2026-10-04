--
-- PostgreSQL database dump
--

\restrict B4tHfAfuxOedAV64p3Nx5Qrnk6VpOMbJFIqaKcR4Qw5Nr5Rlw2dW7GxuP3RcQka

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.app_role AS ENUM (
    'MEMBER',
    'ADMIN',
    'GROOMER'
);


ALTER TYPE public.app_role OWNER TO postgres;

--
-- Name: attendance_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.attendance_status AS ENUM (
    'ATTENDED',
    'NO_SHOW',
    'CANCELLED'
);


ALTER TYPE public.attendance_status OWNER TO postgres;

--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.booking_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'REJECTED',
    'EXPIRED',
    'COMPLETED',
    'MEMBER_CANCELLED',
    'BBS_CANCELLED',
    'RESCHEDULE_REQUESTED',
    'NO_SHOW'
);


ALTER TYPE public.booking_status OWNER TO postgres;

--
-- Name: credit_txn_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.credit_txn_type AS ENUM (
    'MEMBERSHIP_ALLOCATION',
    'SESSION_RESERVED',
    'SESSION_COMPLETED',
    'EARLY_CANCELLATION_RETURN',
    'LATE_CANCELLATION',
    'BBS_CANCELLATION_RETURN',
    'NO_SHOW_DEDUCT',
    'NO_SHOW_RETURN',
    'ADMIN_ADJUSTMENT',
    'EXPIRATION'
);


ALTER TYPE public.credit_txn_type OWNER TO postgres;

--
-- Name: horse_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.horse_status AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public.horse_status OWNER TO postgres;

--
-- Name: membership_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.membership_status AS ENUM (
    'PENDING_PAYMENT',
    'ACTIVE',
    'EXPIRED',
    'CANCELLED',
    'PENDING_ACTIVATION'
);


ALTER TYPE public.membership_status OWNER TO postgres;

--
-- Name: notification_channel; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notification_channel AS ENUM (
    'FCM',
    'EMAIL',
    'WHATSAPP'
);


ALTER TYPE public.notification_channel OWNER TO postgres;

--
-- Name: notification_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notification_status AS ENUM (
    'PENDING',
    'SENT',
    'FAILED'
);


ALTER TYPE public.notification_status OWNER TO postgres;

--
-- Name: operating_block; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.operating_block AS ENUM (
    'MORNING',
    'AFTERNOON'
);


ALTER TYPE public.operating_block OWNER TO postgres;

--
-- Name: participant_booking_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.participant_booking_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'NO_SHOW',
    'COMPLETED',
    'RESCHEDULE_REQUESTED'
);


ALTER TYPE public.participant_booking_status OWNER TO postgres;

--
-- Name: participant_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.participant_type AS ENUM (
    'MEMBER',
    'CASUAL'
);


ALTER TYPE public.participant_type OWNER TO postgres;

--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payment_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'FAILED',
    'REFUNDED',
    'CANCELLED'
);


ALTER TYPE public.payment_status OWNER TO postgres;

--
-- Name: riding_request_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.riding_request_status AS ENUM (
    'UNDER_REVIEW',
    'CONFIRMED',
    'REJECTED'
);


ALTER TYPE public.riding_request_status OWNER TO postgres;

--
-- Name: riding_request_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.riding_request_type AS ENUM (
    'CASUAL_RIDE',
    'JOY_RIDE'
);


ALTER TYPE public.riding_request_type OWNER TO postgres;

--
-- Name: sync_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.sync_status AS ENUM (
    'QUEUED',
    'RUNNING',
    'SUCCEEDED',
    'FAILED',
    'DEAD'
);


ALTER TYPE public.sync_status OWNER TO postgres;

--
-- Name: activate_membership(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.activate_membership(p_application_id uuid, p_admin_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_app record;
  v_plan record;
  v_current_membership record;
  v_new_membership_id uuid;
  v_start_date date;
  v_end_date date;
  v_status membership_status;
  v_user_id uuid;
  v_has_active boolean;
begin
  -- 1. Lock the application
  select * into v_app
  from membership_applications
  where id = p_application_id
  for update;

  if v_app is null then
    raise exception 'APPLICATION_NOT_FOUND';
  end if;

  if v_app.status != 'PAYMENT_CONFIRMED' then
    raise exception 'INVALID_APPLICATION_STATUS';
  end if;

  -- Resolve user_id early for notification
  select user_id into v_user_id from members where id = v_app.member_id;

  -- 2. Get plan details
  select * into v_plan
  from membership_plans
  where id = v_app.requested_plan_id;

  -- 3. Check member's current active membership
  select * into v_current_membership
  from memberships
  where member_id = v_app.member_id and status = 'ACTIVE'
  for update;
  
  v_has_active := FOUND;

  if v_has_active then
    -- Early Renewal (Scenario B)
    v_status := 'PENDING_ACTIVATION';
    if v_current_membership.end_date >= current_date then
      v_start_date := v_current_membership.end_date + interval '1 day';
    else
      v_start_date := current_date;
    end if;
  else
    -- Expired / No Active Membership (Scenario A)
    v_status := 'ACTIVE';
    v_start_date := current_date;
  end if;

  v_end_date := v_start_date + (v_plan.duration_months || ' months')::interval;

  -- 4. Insert membership
  insert into memberships (
    member_id, plan_id, status, start_date, end_date,
    allocated_credits, price_paid_idr, previous_membership_id,
    activated_by, activated_at
  ) values (
    v_app.member_id, v_app.requested_plan_id, v_status, v_start_date, v_end_date,
    v_plan.credits, v_app.final_price_idr, v_app.previous_membership_id,
    p_admin_id, now()
  ) returning id into v_new_membership_id;

  -- 5. Create Ledger Entry for allocation
  insert into membership_credit_ledger (
    membership_id, member_id, txn_type, delta_allocated, reason, actor_id
  ) values (
    v_new_membership_id, v_app.member_id, 'MEMBERSHIP_ALLOCATION', v_plan.credits, 'Membership Activation', p_admin_id
  );

  -- 6. Update Application
  update membership_applications
  set status = 'ACTIVATED',
      new_membership_id = v_new_membership_id,
      updated_at = now()
  where id = p_application_id;

  -- NOTIFICATION INSTRUMENTATION
  if v_status = 'ACTIVE' then
    insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
    values ('MEMBERSHIP_ACTIVATED', 'membership', v_new_membership_id, v_user_id, 'FCM', jsonb_build_object(
      'membership_id', v_new_membership_id,
      'plan_name', v_plan.name,
      'start_date', v_start_date,
      'end_date', v_end_date
    )) on conflict do nothing;
  end if;

end;
$$;


ALTER FUNCTION public.activate_membership(p_application_id uuid, p_admin_id uuid) OWNER TO postgres;

--
-- Name: activate_pending_memberships(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.activate_pending_memberships() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  m record; 
  v_activated int := 0;
  v_skipped int := 0;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_plan record;
  v_user_id uuid;
begin
  for m in select * from memberships
           where status = 'PENDING_ACTIVATION'
             and start_date <= v_today
           for update loop
    
    -- Invariant: Must NOT activate if an ACTIVE membership already exists for this member
    if not exists (
      select 1 from memberships
      where member_id = m.member_id and status = 'ACTIVE'
    ) then
      update memberships set status = 'ACTIVE', updated_at = now() where id = m.id;
      
      -- NOTIFICATION INSTRUMENTATION
      select user_id into v_user_id from members where id = m.member_id;
      select * into v_plan from membership_plans where id = m.plan_id;
      
      insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
      values ('MEMBERSHIP_ACTIVATED', 'membership', m.id, v_user_id, 'FCM', jsonb_build_object(
        'membership_id', m.id,
        'plan_name', v_plan.name,
        'start_date', m.start_date,
        'end_date', m.end_date
      )) on conflict do nothing;

      v_activated := v_activated + 1;
    else
      -- Do NOT mutate the pending membership, just skip it and report the conflict
      v_skipped := v_skipped + 1;
    end if;
  end loop;
  
  return jsonb_build_object(
    'activated', v_activated,
    'skipped_due_to_conflict', v_skipped
  );
end $$;


ALTER FUNCTION public.activate_pending_memberships() OWNER TO postgres;

--
-- Name: approve_booking(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.approve_booking(p_booking_id uuid, p_actor_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_booking bookings%rowtype;
  v_slot    session_slots%rowtype;
  p         record;
  v_available int;
  v_history_id uuid;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;
  if v_booking.status <> 'PENDING' then perform raise_domain_error('INVALID_BOOKING_STATUS'); end if;

  select * into v_slot from session_slots where id = v_booking.slot_id for update;
  if not v_slot.is_open then perform raise_domain_error('SLOT_CLOSED'); end if;
  if slot_occupancy(v_slot.id) > v_slot.capacity then perform raise_domain_error('SLOT_FULL'); end if;

  -- Revalidate and reserve one credit per MEMBER participant, independently.
  for p in
    select bp.*, m.end_date, m.status as ms_status
    from booking_participants bp
    join memberships m on m.id = bp.membership_id
    where bp.booking_id = p_booking_id and bp.participant_type = 'MEMBER'
    order by bp.membership_id
  loop
    perform 1 from memberships where id = p.membership_id for update;
    if p.ms_status <> 'ACTIVE' or v_slot.slot_date > p.end_date then
      perform raise_domain_error('MEMBERSHIP_EXPIRED');
    end if;
    select available into v_available from membership_credit_state(p.membership_id);
    if v_available <= 0 then perform raise_domain_error('INSUFFICIENT_CREDITS'); end if;

    insert into membership_credit_ledger
      (membership_id, member_id, booking_id, participant_id, txn_type, delta_reserved, reason, actor_id)
    values (p.membership_id, p.member_id, p_booking_id, p.id, 'SESSION_RESERVED', 1,
            'booking approved', p_actor_id);
  end loop;

  update bookings set status = 'CONFIRMED', pending_expires_at = null, updated_at = now()
   where id = p_booking_id;
  
  insert into booking_status_history (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, 'PENDING', 'CONFIRMED', p_actor_id)
  returning id into v_history_id;

  -- NOTIFICATION INSTRUMENTATION
  -- Notify Owner
  insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
  values ('BOOKING_CONFIRMED', 'booking', p_booking_id, v_booking.created_by, 'FCM', jsonb_build_object(
    'booking_id', p_booking_id,
    'slot_date', v_slot.slot_date,
    'start_time', v_slot.start_time
  )) on conflict do nothing;

  -- Notify Member Participants (excluding owner to avoid duplicates)
  insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
  select 'BOOKING_CONFIRMED', 'booking', p_booking_id, m.user_id, 'FCM', jsonb_build_object(
    'booking_id', p_booking_id,
    'slot_date', v_slot.slot_date,
    'start_time', v_slot.start_time
  )
  from booking_participants bp
  join members m on m.id = bp.member_id
  where bp.booking_id = p_booking_id and bp.participant_type = 'MEMBER'
    and m.user_id != v_booking.created_by
  on conflict do nothing;

end $$;


ALTER FUNCTION public.approve_booking(p_booking_id uuid, p_actor_id uuid) OWNER TO postgres;

--
-- Name: approve_reschedule(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.approve_reschedule(p_booking_id uuid, p_actor_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_booking bookings%rowtype;
  v_new_slot session_slots%rowtype;
  v_old_slot session_slots%rowtype;
  v_participants int;
  v_history_id uuid;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if v_booking.status <> 'RESCHEDULE_REQUESTED' then
    perform raise_domain_error('INVALID_RESCHEDULE');
  end if;
  if v_booking.requested_slot_id is null then perform raise_domain_error('INVALID_RESCHEDULE'); end if;

  select * into v_new_slot from session_slots where id = v_booking.requested_slot_id for update;
  if not found or not v_new_slot.is_open then perform raise_domain_error('SLOT_CLOSED'); end if;
  select count(*) into v_participants from booking_participants where booking_id = p_booking_id;
  if slot_occupancy(v_new_slot.id) + v_participants > v_new_slot.capacity then
    perform raise_domain_error('SLOT_FULL');
  end if;
  
  select * into v_old_slot from session_slots where id = v_booking.slot_id;

  insert into booking_slot_history (booking_id, from_slot_id, to_slot_id, actor_id, reason)
  values (p_booking_id, v_booking.slot_id, v_new_slot.id, p_actor_id, 'reschedule approved');

  -- Credit reservation is untouched: the same reservation follows the booking.
  update bookings set slot_id = v_new_slot.id, requested_slot_id = null,
         status = 'CONFIRMED', updated_at = now()
   where id = p_booking_id;
   
  insert into booking_status_history (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, 'RESCHEDULE_REQUESTED', 'CONFIRMED', p_actor_id)
  returning id into v_history_id;

  -- NOTIFICATION INSTRUMENTATION
  -- Notify Owner
  insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
  values ('RESCHEDULE_APPROVED', 'booking', p_booking_id, v_booking.created_by, 'FCM', jsonb_build_object(
    'booking_id', p_booking_id,
    'old_slot_date', v_old_slot.slot_date,
    'old_start_time', v_old_slot.start_time,
    'new_slot_date', v_new_slot.slot_date,
    'new_start_time', v_new_slot.start_time
  )) on conflict do nothing;

  -- Notify Member Participants
  insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
  select 'RESCHEDULE_APPROVED', 'booking', p_booking_id, m.user_id, 'FCM', jsonb_build_object(
    'booking_id', p_booking_id,
    'old_slot_date', v_old_slot.slot_date,
    'old_start_time', v_old_slot.start_time,
    'new_slot_date', v_new_slot.slot_date,
    'new_start_time', v_new_slot.start_time
  )
  from booking_participants bp
  join members m on m.id = bp.member_id
  where bp.booking_id = p_booking_id and bp.participant_type = 'MEMBER'
    and m.user_id != v_booking.created_by
  on conflict do nothing;

end $$;


ALTER FUNCTION public.approve_reschedule(p_booking_id uuid, p_actor_id uuid) OWNER TO postgres;

--
-- Name: approve_riding_request(uuid, date, time without time zone, integer, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.approve_riding_request(p_request_id uuid, p_date date, p_time time without time zone, p_capacity integer, p_actor_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_member_id uuid;
    v_status text;
    v_slot_id uuid;
    v_booking_id uuid;
    v_is_casual boolean;
BEGIN
    -- 1. Get request
    SELECT member_id, status INTO v_member_id, v_status
    FROM riding_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'REQUEST_NOT_FOUND';
    END IF;

    IF v_status <> 'UNDER_REVIEW' THEN
        RAISE EXCEPTION 'REQUEST_NOT_UNDER_REVIEW';
    END IF;

    -- 2. Find or create session_slot
    SELECT id INTO v_slot_id
    FROM session_slots
    WHERE slot_date = p_date AND start_time = p_time;

    IF NOT FOUND THEN
        INSERT INTO session_slots (slot_date, start_time, end_time, block, capacity, is_open)
        VALUES (
            p_date,
            p_time,
            p_time + interval '1 hour',
            CASE
                WHEN extract(hour from p_time) < 12 THEN 'MORNING'
                ELSE 'AFTERNOON'
            END,
            p_capacity,
            true
        ) RETURNING id INTO v_slot_id;
    END IF;

    -- 3. Create booking
    INSERT INTO bookings (slot_id, status, is_casual, created_by)
    VALUES (v_slot_id, 'CONFIRMED', true, p_actor_id)
    RETURNING id INTO v_booking_id;

    -- 4. Create participant
    INSERT INTO booking_participants (
        booking_id, participant_type, member_id,
        participant_status, attendance_status
    ) VALUES (
        v_booking_id, 'MEMBER', v_member_id,
        'CONFIRMED', 'NOT_CHECKED_IN'
    );

    -- 5. Update request status
    -- FIXED: Use CONFIRMED instead of APPROVED because of riding_request_status enum
    UPDATE riding_requests
    SET status = 'CONFIRMED', updated_at = now()
    WHERE id = p_request_id;

    RETURN v_booking_id;
END;
$$;


ALTER FUNCTION public.approve_riding_request(p_request_id uuid, p_date date, p_time time without time zone, p_capacity integer, p_actor_id uuid) OWNER TO postgres;

--
-- Name: assign_horse(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.assign_horse(p_participant_id uuid, p_horse_id uuid, p_actor_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_participant booking_participants%rowtype;
  v_booking bookings%rowtype;
  v_horse horses%rowtype;
  v_conflict boolean;
  v_slot_id uuid;
  v_booking_id uuid;
begin
  -- Authorize (Must be ADMIN or GROOMER)
  if not exists (
    select 1 from users where id = p_actor_id and role in ('ADMIN', 'GROOMER')
  ) then
    perform raise_domain_error('FORBIDDEN');
  end if;

  -- Read IDs without locking to establish the correct lock order
  select b.slot_id, b.id into v_slot_id, v_booking_id
  from booking_participants bp
  join bookings b on b.id = bp.booking_id
  where bp.id = p_participant_id;

  if not found then perform raise_domain_error('PARTICIPANT_NOT_FOUND'); end if;

  -- LOCK ORDER 1: session_slots
  -- This entirely serializes assignments for the same slot, preventing horse collision races
  perform 1 from session_slots where id = v_slot_id for update;

  -- LOCK ORDER 2: bookings
  select * into v_booking from bookings where id = v_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;

  -- Prevent race if the booking was rescheduled (slot changed) while waiting for lock
  if v_booking.status = 'RESCHEDULE_REQUESTED' then
    -- Disallow assignment if they requested a reschedule that hasn't been approved yet
    perform raise_domain_error('INVALID_BOOKING_STATUS');
  end if;

  if v_booking.slot_id != v_slot_id then
    perform raise_domain_error('INVALID_BOOKING_STATUS');
  end if;

  -- LOCK ORDER 3: booking_participants
  select * into v_participant from booking_participants where id = p_participant_id for update;
  if not found then perform raise_domain_error('PARTICIPANT_NOT_FOUND'); end if;

  -- Verify operationally valid booking for grooming/assignment
  if v_booking.status not in ('PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW') then
    perform raise_domain_error('INVALID_BOOKING_STATUS');
  end if;

  -- Verify horse if one is provided (allow un-assign by sending null)
  if p_horse_id is not null then
    -- 'for share' is safe here since horses is independent of the slot->booking lock order
    select * into v_horse from horses where id = p_horse_id for share;
    if not found then perform raise_domain_error('HORSE_NOT_FOUND'); end if;
    if v_horse.status != 'ACTIVE' then perform raise_domain_error('HORSE_INACTIVE'); end if;

    -- Enforce collision rule: no other participant in the same slot_id can have this horse
    -- Because we hold the session_slots lock, this read is absolutely serialized and race-free.
    select exists (
      select 1
      from booking_participants bp
      join bookings b on b.id = bp.booking_id
      where b.slot_id = v_booking.slot_id
        and b.status in ('PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'RESCHEDULE_REQUESTED')
        and bp.horse_id = p_horse_id
        and bp.id != p_participant_id
    ) into v_conflict;

    if v_conflict then
      perform raise_domain_error('HORSE_ALREADY_ASSIGNED_IN_SLOT');
    end if;
  end if;

  -- Apply
  update booking_participants
  set horse_id = p_horse_id
  where id = p_participant_id;

end;
$$;


ALTER FUNCTION public.assign_horse(p_participant_id uuid, p_horse_id uuid, p_actor_id uuid) OWNER TO postgres;

--
-- Name: authz_groomer_can_access_booking(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.authz_groomer_can_access_booking(p_booking_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  return current_app_role() = 'GROOMER' and exists (
    select 1 from bookings b
    join session_slots s on s.id = b.slot_id
    where b.id = p_booking_id
      and s.slot_date between current_date - 1 and current_date + 7
  );
end $$;


ALTER FUNCTION public.authz_groomer_can_access_booking(p_booking_id uuid) OWNER TO postgres;

--
-- Name: authz_groomer_can_access_member(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.authz_groomer_can_access_member(p_member_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  return current_app_role() = 'GROOMER' and exists (
    select 1 from booking_participants bp
    join bookings b on b.id = bp.booking_id
    join session_slots s on s.id = b.slot_id
    where bp.member_id = p_member_id and s.slot_date = current_date
  );
end $$;


ALTER FUNCTION public.authz_groomer_can_access_member(p_member_id uuid) OWNER TO postgres;

--
-- Name: authz_is_booking_participant(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.authz_is_booking_participant(p_booking_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  return exists (
    select 1 from booking_participants bp 
    where bp.booking_id = p_booking_id and bp.member_id = current_member_id()
  );
end $$;


ALTER FUNCTION public.authz_is_booking_participant(p_booking_id uuid) OWNER TO postgres;

--
-- Name: cancel_booking(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cancel_booking(p_booking_id uuid, p_actor_id uuid, p_source text, p_reason text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_booking bookings%rowtype;
  v_slot    session_slots%rowtype;
  v_deadline_hours int := setting_int('cancellation_deadline_hours', 6);
  v_starts_at timestamptz;
  v_late boolean;
  v_new_status booking_status;
  p record;
  v_is_participant boolean;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;

  -- AUTHORIZATION: Member can cancel if they created it OR if they are a participant (for basic members approved by admin)
  if p_source = 'MEMBER' then
    select exists (
      select 1 from booking_participants bp
      join members m on m.id = bp.member_id
      where bp.booking_id = p_booking_id and m.user_id = p_actor_id
    ) into v_is_participant;

    if v_booking.created_by != p_actor_id and not v_is_participant then
      perform raise_domain_error('FORBIDDEN');
    end if;
  end if;

  if v_booking.status not in ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED') then
    perform raise_domain_error('INVALID_BOOKING_STATUS');
  end if;

  select * into v_slot from session_slots where id = v_booking.slot_id;
  v_starts_at := (v_slot.slot_date + v_slot.start_time) at time zone 'Asia/Jakarta';
  v_late := (p_source = 'MEMBER')
            and now() > v_starts_at - (v_deadline_hours || ' hours')::interval;
  v_new_status := case when p_source = 'BBS' then 'BBS_CANCELLED' else 'MEMBER_CANCELLED' end;

  for p in
    select bp.* from booking_participants bp
    where bp.booking_id = p_booking_id and bp.participant_type = 'MEMBER'
    order by bp.membership_id
  loop
    -- Only settle participants that actually hold a reservation.
    if exists (select 1 from membership_credit_ledger
               where participant_id = p.id and txn_type = 'SESSION_RESERVED') then
      if v_late then
        insert into membership_credit_ledger
          (membership_id, member_id, booking_id, participant_id, txn_type,
           delta_reserved, delta_consumed, reason, actor_id)
        values (p.membership_id, p.member_id, p_booking_id, p.id, 'LATE_CANCELLATION',
                -1, 1, p_reason, p_actor_id);
      else
        insert into membership_credit_ledger
          (membership_id, member_id, booking_id, participant_id, txn_type,
           delta_reserved, reason, actor_id)
        values (p.membership_id, p.member_id, p_booking_id, p.id,
                case when p_source = 'BBS' then 'BBS_CANCELLATION_RETURN'
                     else 'EARLY_CANCELLATION_RETURN' end,
                -1, p_reason, p_actor_id);
      end if;
    end if;
  end loop;

  update bookings
     set status = v_new_status, cancellation_reason = p_reason,
         cancelled_by = p_actor_id, cancelled_at = now(), updated_at = now()
   where id = p_booking_id;
  insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  values (p_booking_id, v_booking.status, v_new_status, p_actor_id, p_reason);

  return case when v_late then 'LATE' else 'EARLY' end;
end $$;


ALTER FUNCTION public.cancel_booking(p_booking_id uuid, p_actor_id uuid, p_source text, p_reason text) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: notification_outbox; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    recipient_user_id uuid NOT NULL,
    channel public.notification_channel NOT NULL,
    payload jsonb NOT NULL,
    status public.notification_status DEFAULT 'PENDING'::public.notification_status NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notification_outbox OWNER TO postgres;

--
-- Name: claim_pending_notifications(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.claim_pending_notifications(p_batch_size integer) RETURNS SETOF public.notification_outbox
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  return query
  with claimed as (
    select id
    from notification_outbox
    where status = 'PENDING'
      and available_at <= now()
    order by created_at asc
    limit p_batch_size
    for update skip locked
  )
  update notification_outbox n
  set attempts = n.attempts + 1,
      -- 5-minute lease. If the worker crashes, the row becomes available again.
      available_at = now() + interval '5 minutes'
  from claimed c
  where n.id = c.id
  returning n.*;
end;
$$;


ALTER FUNCTION public.claim_pending_notifications(p_batch_size integer) OWNER TO postgres;

--
-- Name: create_member_booking(uuid, uuid, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_member_booking(p_booking_owner_id uuid, p_slot_id uuid, p_participants jsonb, p_actor_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_slot session_slots%rowtype;
  v_available int;
  v_booking_id uuid;
  v_window_days int := setting_int('booking_window_days', 7);
  v_max_active int := setting_int('max_active_future_bookings', 2);
  v_timeout_min int := setting_int('pending_timeout_minutes', 1440);
  v_max_weekly_sessions int := 2; -- Domain Rule: max 2 sessions per calendar week
  v_active_count int;
  v_weekly_count int;
  v_num_participants int;
  v_participant jsonb;
  v_member_id uuid;
  v_membership memberships%rowtype;
  v_casual_id uuid;
  v_slot_week_start date;
  v_slot_week_end date;
  v_admin_user_id uuid;
  v_has_premium boolean;
begin
  v_num_participants := jsonb_array_length(p_participants);
  if v_num_participants = 0 then
    perform raise_domain_error('NO_PARTICIPANTS');
  end if;

  -- 0. Concurrency Lock
  perform 1 from users where id = p_actor_id for update;

  -- 1. Lock the slot: capacity decisions serialise here.
  select * into v_slot from session_slots where id = p_slot_id for update;
  if not found then perform raise_domain_error('SLOT_NOT_FOUND'); end if;
  if not v_slot.is_open then perform raise_domain_error('SLOT_CLOSED'); end if;

  -- 2. Booking window
  if v_slot.slot_date < current_date then perform raise_domain_error('SLOT_IN_PAST'); end if;
  if v_slot.slot_date > current_date + (v_window_days || ' days')::interval then
    perform raise_domain_error('BOOKING_WINDOW_EXCEEDED');
  end if;

  -- 3A. Constraint A: Active future booking limit (Applies only to the booking owner)
  select count(*) into v_active_count
  from bookings b
  where b.created_by = p_actor_id
    and b.status in ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED')
    and exists (
      select 1 from session_slots s where s.id = b.slot_id and (s.slot_date + s.start_time) > now()
    );

  -- Premium members have no limits
  select exists (
    select 1 from memberships ms
    join membership_plans mp on mp.id = ms.plan_id
    join members m on m.id = ms.member_id
    where m.user_id = p_actor_id
      and ms.status = 'ACTIVE'
      and mp.name ilike any (array['%SILVER%', '%GOLD%'])
  ) into v_has_premium;

  if v_has_premium then
    v_max_active := 999;
    v_max_weekly_sessions := 999;
  end if;

  if v_active_count >= v_max_active then
    perform raise_domain_error('ACTIVE_BOOKING_LIMIT_REACHED');
  end if;

  -- 3B. Constraint B: Weekly frequency limit (Applies only to the booking owner)
  v_slot_week_start := date_trunc('week', v_slot.slot_date::timestamp)::date;
  v_slot_week_end := v_slot_week_start + interval '6 days';

  select count(distinct b.id) into v_weekly_count
  from bookings b
  join session_slots s on s.id = b.slot_id
  where b.created_by = p_actor_id
    and b.status in ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED','COMPLETED')
    and s.slot_date between v_slot_week_start and v_slot_week_end;

  if v_weekly_count >= v_max_weekly_sessions then
    perform raise_domain_error('WEEKLY_BOOKING_LIMIT_REACHED');
  end if;

  -- 4. Capacity (occupancy includes PENDING and CONFIRMED)
  if slot_occupancy(p_slot_id) + v_num_participants > v_slot.capacity then
    perform raise_domain_error('SLOT_FULL');
  end if;

  -- 5. Insert Booking (PENDING)
  insert into bookings (slot_id, status, created_by, is_casual, pending_expires_at)
  values (p_slot_id, 'PENDING', p_actor_id, false, now() + (v_timeout_min || ' minutes')::interval)
  returning id into v_booking_id;

  -- 6. Process Participants
  for v_participant in select * from jsonb_array_elements(p_participants)
  loop
    if v_participant->>'type' = 'MEMBER' then
      v_member_id := (v_participant->>'member_id')::uuid;

      -- Check for DOUBLE BOOKING for the same slot
      if exists (
        select 1
        from booking_participants bp
        join bookings b on b.id = bp.booking_id
        where bp.member_id = v_member_id
          and b.slot_id = p_slot_id
          and b.status in ('PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED')
      ) then
        perform raise_domain_error('ALREADY_BOOKED_FOR_SLOT');
      end if;

      -- Validate member exists and has an ACTIVE membership covering the date
      select * into v_membership from memberships
      where member_id = v_member_id and status = 'ACTIVE' for update;

      if not found or v_slot.slot_date > v_membership.end_date then
        perform raise_domain_error('MEMBERSHIP_EXPIRED');
      end if;

      -- Validate credit availability (does NOT reserve yet)
      select available into v_available from membership_credit_state(v_membership.id);
      if v_available <= 0 then
        perform raise_domain_error('INSUFFICIENT_CREDITS');
      end if;

      insert into booking_participants (booking_id, participant_type, member_id, membership_id)
      values (v_booking_id, 'MEMBER', v_member_id, v_membership.id);

    elsif v_participant->>'type' = 'CASUAL' then
      insert into casual_customers (full_name, phone)
      values (v_participant->>'full_name', v_participant->>'phone')
      returning id into v_casual_id;

      insert into booking_participants (booking_id, participant_type, casual_customer_id)
      values (v_booking_id, 'CASUAL', v_casual_id);
    else
      perform raise_domain_error('INVALID_PARTICIPANT_TYPE');
    end if;
  end loop;

  insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  values (v_booking_id, null, 'PENDING', p_actor_id, 'member submission');

  -- 7. NOTIFY ADMINS
  for v_admin_user_id in select id from users where role = 'ADMIN' loop
    insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
    values (
      'NEW_BOOKING_REQUEST',
      'BOOKING',
      v_booking_id,
      v_admin_user_id,
      'PWA_PUSH',
      jsonb_build_object(
        'booking_id', v_booking_id,
        'slot_date', v_slot.slot_date,
        'start_time', v_slot.start_time
      )
    ) on conflict do nothing;
  end loop;

  return v_booking_id;
end $$;


ALTER FUNCTION public.create_member_booking(p_booking_owner_id uuid, p_slot_id uuid, p_participants jsonb, p_actor_id uuid) OWNER TO postgres;

--
-- Name: current_app_role(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_app_role() RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select role from users where id = auth.uid()
$$;


ALTER FUNCTION public.current_app_role() OWNER TO postgres;

--
-- Name: current_member_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_member_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select m.id from members m where m.user_id = auth.uid()
$$;


ALTER FUNCTION public.current_member_id() OWNER TO postgres;

--
-- Name: daily_maintenance(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.daily_maintenance() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_expired int;
  v_activation_result jsonb;
begin
  -- Expiration MUST happen before activation
  v_expired := expire_memberships();
  v_activation_result := activate_pending_memberships();
  
  return jsonb_build_object(
    'memberships_expired', v_expired,
    'memberships_activated', (v_activation_result->>'activated')::int,
    'memberships_skipped', (v_activation_result->>'skipped_due_to_conflict')::int,
    'executed_at', now()
  );
end $$;


ALTER FUNCTION public.daily_maintenance() OWNER TO postgres;

--
-- Name: expire_memberships(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.expire_memberships() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare 
  m record; 
  v_available int; 
  v_count int := 0;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  for m in select * from memberships
           where status = 'ACTIVE' and end_date < v_today for update loop
    select available into v_available from membership_credit_state(m.id);
    if v_available > 0 then
      insert into membership_credit_ledger
        (membership_id, member_id, txn_type, delta_allocated, reason)
      values (m.id, m.member_id, 'EXPIRATION', -v_available, 'membership expired');
    end if;
    update memberships set status = 'EXPIRED', updated_at = now() where id = m.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;


ALTER FUNCTION public.expire_memberships() OWNER TO postgres;

--
-- Name: expire_pending_bookings(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.expire_pending_bookings() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_count int;
begin
  with expired as (
    update bookings set status = 'EXPIRED', updated_at = now()
     where status = 'PENDING' and pending_expires_at is not null
       and pending_expires_at < now()
    returning id, status
  )
  insert into booking_status_history (booking_id, from_status, to_status, reason)
  select id, 'PENDING', 'EXPIRED', 'pending timeout' from expired;
  get diagnostics v_count = row_count;
  return v_count;
end $$;


ALTER FUNCTION public.expire_pending_bookings() OWNER TO postgres;

--
-- Name: generate_session_slots(date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_session_slots(p_from date, p_to date) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  d date; s operating_schedules%rowtype; t time; v_created int := 0;
  v_override schedule_overrides%rowtype;
begin
  d := p_from;
  while d <= p_to loop
    for s in select * from operating_schedules
             where day_of_week = extract(dow from d) and is_active loop
      select * into v_override from schedule_overrides
       where override_date = d and (block = s.block or block is null) limit 1;
      if not (found and v_override.is_closed) then
        t := s.start_time;
        -- A slot only exists if the whole session fits inside the block.
        while (t + (s.session_duration_minutes || ' minutes')::interval) <= s.end_time loop
          insert into session_slots
            (slot_date, start_time, end_time, block, capacity, source_schedule_id)
          values (d, t, t + (s.session_duration_minutes || ' minutes')::interval, s.block,
                  coalesce(v_override.capacity_override, s.default_capacity), s.id)
          on conflict (slot_date, start_time) do nothing;
          if found then v_created := v_created + 1; end if;
          t := t + (s.slot_interval_minutes || ' minutes')::interval;
        end loop;
      end if;
    end loop;
    d := d + 1;
  end loop;
  return v_created;
end $$;


ALTER FUNCTION public.generate_session_slots(p_from date, p_to date) OWNER TO postgres;

--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(current_app_role() = 'ADMIN', false)
$$;


ALTER FUNCTION public.is_admin() OWNER TO postgres;

--
-- Name: mark_notification_failed(uuid, integer, text, boolean, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.mark_notification_failed(p_id uuid, p_attempts integer, p_error text, p_is_permanent boolean, p_max_attempts integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_rows_affected int;
begin
  if p_is_permanent or p_attempts >= p_max_attempts then
    update notification_outbox
    set status = 'FAILED', last_error = p_error
    where id = p_id and status = 'PENDING' and attempts = p_attempts;
  else
    update notification_outbox
    set status = 'PENDING',
        last_error = p_error,
        -- Exponential backoff: 2^attempts minutes.
        available_at = now() + (power(2, p_attempts) || ' minutes')::interval
    where id = p_id and status = 'PENDING' and attempts = p_attempts;
  end if;

  get diagnostics v_rows_affected = row_count;
  return v_rows_affected > 0;
end;
$$;


ALTER FUNCTION public.mark_notification_failed(p_id uuid, p_attempts integer, p_error text, p_is_permanent boolean, p_max_attempts integer) OWNER TO postgres;

--
-- Name: mark_notification_sent(uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.mark_notification_sent(p_id uuid, p_attempts integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_rows_affected int;
begin
  update notification_outbox
  set status = 'SENT', sent_at = now()
  where id = p_id and status = 'PENDING' and attempts = p_attempts;
  
  get diagnostics v_rows_affected = row_count;
  return v_rows_affected > 0;
end;
$$;


ALTER FUNCTION public.mark_notification_sent(p_id uuid, p_attempts integer) OWNER TO postgres;

--
-- Name: membership_credit_state(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.membership_credit_state(p_membership_id uuid) RETURNS TABLE(allocated integer, reserved integer, consumed integer, available integer)
    LANGUAGE sql STABLE
    AS $$
  select
    coalesce(sum(delta_allocated),0)::int,
    coalesce(sum(delta_reserved),0)::int,
    coalesce(sum(delta_consumed),0)::int,
    (coalesce(sum(delta_allocated),0) - coalesce(sum(delta_reserved),0)
     - coalesce(sum(delta_consumed),0))::int
  from membership_credit_ledger where membership_id = p_membership_id
$$;


ALTER FUNCTION public.membership_credit_state(p_membership_id uuid) OWNER TO postgres;

--
-- Name: raise_domain_error(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.raise_domain_error(p_code text) RETURNS void
    LANGUAGE plpgsql
    AS $$ begin raise exception '%', p_code using errcode = 'P0001'; end $$;


ALTER FUNCTION public.raise_domain_error(p_code text) OWNER TO postgres;

--
-- Name: reject_booking(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reject_booking(p_booking_id uuid, p_actor_id uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_booking bookings%rowtype;
  v_slot    session_slots%rowtype;
  v_history_id uuid;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;
  if v_booking.status <> 'PENDING' then perform raise_domain_error('INVALID_BOOKING_STATUS'); end if;

  select * into v_slot from session_slots where id = v_booking.slot_id;

  update bookings 
  set status = 'REJECTED', 
      pending_expires_at = null,
      cancellation_reason = p_reason,
      cancelled_by = p_actor_id,
      cancelled_at = now(),
      updated_at = now()
  where id = p_booking_id;

  insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  values (p_booking_id, 'PENDING', 'REJECTED', p_actor_id, coalesce(p_reason, 'admin rejection'))
  returning id into v_history_id;

  -- NOTIFICATION INSTRUMENTATION (Owner ONLY)
  insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
  values ('BOOKING_REJECTED', 'booking', p_booking_id, v_booking.created_by, 'FCM', jsonb_build_object(
    'booking_id', p_booking_id,
    'slot_date', v_slot.slot_date,
    'start_time', v_slot.start_time,
    'reason', p_reason
  )) on conflict do nothing;

end $$;


ALTER FUNCTION public.reject_booking(p_booking_id uuid, p_actor_id uuid, p_reason text) OWNER TO postgres;

--
-- Name: reject_reschedule(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reject_reschedule(p_booking_id uuid, p_actor_id uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_booking bookings%rowtype;
  v_requested_slot session_slots%rowtype;
  v_history_id uuid;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;
  if v_booking.status <> 'RESCHEDULE_REQUESTED' then perform raise_domain_error('INVALID_BOOKING_STATUS'); end if;

  select * into v_requested_slot from session_slots where id = v_booking.requested_slot_id;

  update bookings 
  set status = 'CONFIRMED', 
      requested_slot_id = null,
      updated_at = now()
  where id = p_booking_id;

  insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  values (p_booking_id, 'RESCHEDULE_REQUESTED', 'CONFIRMED', p_actor_id, coalesce(p_reason, 'reschedule rejected'))
  returning id into v_history_id;

  -- NOTIFICATION INSTRUMENTATION
  insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
  values ('RESCHEDULE_REJECTED', 'booking', p_booking_id, v_booking.created_by, 'FCM', jsonb_build_object(
    'booking_id', p_booking_id,
    'requested_slot_date', v_requested_slot.slot_date,
    'requested_start_time', v_requested_slot.start_time,
    'reason', p_reason
  )) on conflict do nothing;

end $$;


ALTER FUNCTION public.reject_reschedule(p_booking_id uuid, p_actor_id uuid, p_reason text) OWNER TO postgres;

--
-- Name: request_reschedule(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.request_reschedule(p_booking_id uuid, p_new_slot_id uuid, p_member_id uuid, p_actor_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_booking bookings%rowtype;
  v_slot    session_slots%rowtype;
  v_old_slot session_slots%rowtype;
  v_participants int;
  v_window_days int := setting_int('booking_window_days', 7);
  v_deadline_hours int := setting_int('reschedule_hours', 24);
  v_starts_at timestamptz;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then perform raise_domain_error('BOOKING_NOT_FOUND'); end if;
  if v_booking.status <> 'CONFIRMED' then perform raise_domain_error('INVALID_BOOKING_STATUS'); end if;
  
  -- AUTHORIZATION: Only the booking creator can request a reschedule
  if v_booking.created_by != p_actor_id then
    perform raise_domain_error('FORBIDDEN');
  end if;

  -- ORIGINAL SLOT VALIDATION: Enforce cancellation deadline on the original slot
  select * into v_old_slot from session_slots where id = v_booking.slot_id;
  v_starts_at := (v_old_slot.slot_date + v_old_slot.start_time) at time zone 'Asia/Jakarta';
  if now() > v_starts_at - (v_deadline_hours || ' hours')::interval then
    perform raise_domain_error('CANCELLATION_DEADLINE_PASSED');
  end if;

  -- TARGET SLOT VALIDATION
  select * into v_slot from session_slots where id = p_new_slot_id;
  if not found or not v_slot.is_open then perform raise_domain_error('SLOT_CLOSED'); end if;
  if v_slot.slot_date > current_date + (v_window_days || ' days')::interval then
    perform raise_domain_error('BOOKING_WINDOW_EXCEEDED');
  end if;
  
  select count(*) into v_participants from booking_participants where booking_id = p_booking_id;
  if slot_occupancy(p_new_slot_id) + v_participants > v_slot.capacity then 
    perform raise_domain_error('SLOT_FULL'); 
  end if;

  update bookings set status = 'RESCHEDULE_REQUESTED', requested_slot_id = p_new_slot_id,
         updated_at = now() where id = p_booking_id;
  insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
  values (p_booking_id, 'CONFIRMED', 'RESCHEDULE_REQUESTED', p_actor_id, 'member reschedule request');
end $$;


ALTER FUNCTION public.request_reschedule(p_booking_id uuid, p_new_slot_id uuid, p_member_id uuid, p_actor_id uuid) OWNER TO postgres;

--
-- Name: resolve_attendance(uuid, public.attendance_status, text, text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.resolve_attendance(p_participant_id uuid, p_status public.attendance_status, p_credit_action text, p_reason text, p_actor_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  p record;
  v_booking bookings%rowtype;
begin
  select bp.*, b.id as bid into p
  from booking_participants bp join bookings b on b.id = bp.booking_id
  where bp.id = p_participant_id for update;
  if not found then perform raise_domain_error('PARTICIPANT_NOT_FOUND'); end if;

  select * into v_booking from bookings where id = p.bid for update;
  if v_booking.status <> 'CONFIRMED' then perform raise_domain_error('INVALID_BOOKING_STATUS'); end if;

  if p.participant_type = 'MEMBER' then
    perform 1 from memberships where id = p.membership_id for update;
    if p_status = 'ATTENDED' then
      insert into membership_credit_ledger
        (membership_id, member_id, booking_id, participant_id, txn_type,
         delta_reserved, delta_consumed, reason, actor_id)
      values (p.membership_id, p.member_id, p.bid, p.id, 'SESSION_COMPLETED', -1, 1, p_reason, p_actor_id);
    elsif p_credit_action = 'CONSUMED' then
      insert into membership_credit_ledger
        (membership_id, member_id, booking_id, participant_id, txn_type,
         delta_reserved, delta_consumed, reason, actor_id)
      values (p.membership_id, p.member_id, p.bid, p.id, 'NO_SHOW_DEDUCT', -1, 1, p_reason, p_actor_id);
    else
      insert into membership_credit_ledger
        (membership_id, member_id, booking_id, participant_id, txn_type,
         delta_reserved, reason, actor_id)
      values (p.membership_id, p.member_id, p.bid, p.id, 'NO_SHOW_RETURN', -1, p_reason, p_actor_id);
    end if;
  end if;

  insert into attendance_records
    (booking_id, participant_id, status, credit_action, reason, resolved_by)
  values (p.bid, p.id, p_status,
          case when p.participant_type = 'CASUAL' then 'NOT_APPLICABLE' else p_credit_action end,
          p_reason, p_actor_id);

  -- The booking closes once every participant has been resolved.
  if not exists (
    select 1 from booking_participants bp
    left join attendance_records ar on ar.participant_id = bp.id
    where bp.booking_id = p.bid and ar.id is null
  ) then
    update bookings set status =
      (case when exists (select 1 from attendance_records
                        where booking_id = p.bid and status = 'ATTENDED')
           then 'COMPLETED' else 'NO_SHOW' end)::booking_status,
      updated_at = now()
    where id = p.bid;
    insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
    select p.bid, 'CONFIRMED', status, p_actor_id, 'attendance resolved'
    from bookings where id = p.bid;
  end if;
end $$;


ALTER FUNCTION public.resolve_attendance(p_participant_id uuid, p_status public.attendance_status, p_credit_action text, p_reason text, p_actor_id uuid) OWNER TO postgres;

--
-- Name: setting_int(text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.setting_int(p_key text, p_default integer) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
  select coalesce((select (value #>> '{}')::int from system_settings where key = p_key), p_default)
$$;


ALTER FUNCTION public.setting_int(p_key text, p_default integer) OWNER TO postgres;

--
-- Name: slot_occupancy(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.slot_occupancy(p_slot_id uuid) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
  select coalesce(count(bp.id),0)::int
  from bookings b
  join booking_participants bp on bp.booking_id = b.id
  where b.slot_id = p_slot_id
    and b.status in ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED','COMPLETED','NO_SHOW')
$$;


ALTER FUNCTION public.slot_occupancy(p_slot_id uuid) OWNER TO postgres;

--
-- Name: trg_membership_application_notifications(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_membership_application_notifications() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_event_type text;
begin
  -- Only fire if status actually changed
  if TG_OP = 'UPDATE' and OLD.status = NEW.status then
    return NEW;
  end if;

  if TG_OP = 'UPDATE' and NEW.status in ('APPROVED', 'PAYMENT_CONFIRMED', 'REJECTED') then
    select user_id into v_user_id from members where id = NEW.member_id;

    v_event_type := 'MEMBERSHIP_APPLICATION_' || NEW.status;

    insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)
    values (v_event_type, 'membership_application', NEW.id, v_user_id, 'FCM', jsonb_build_object(
      'application_id', NEW.id,
      'plan_id', NEW.requested_plan_id
    )) on conflict do nothing;
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION public.trg_membership_application_notifications() OWNER TO postgres;

--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    status public.attendance_status NOT NULL,
    credit_action text,
    reason text,
    resolved_by uuid,
    resolved_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendance_records_credit_action_check CHECK ((credit_action = ANY (ARRAY['CONSUMED'::text, 'RETURNED'::text, 'NOT_APPLICABLE'::text])))
);


ALTER TABLE public.attendance_records OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    actor_role public.app_role,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    old_data jsonb,
    new_data jsonb,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: booking_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.booking_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    participant_type public.participant_type NOT NULL,
    member_id uuid,
    membership_id uuid,
    casual_customer_id uuid,
    price_idr numeric(12,0),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    horse_id uuid,
    participant_status public.participant_booking_status DEFAULT 'PENDING'::public.participant_booking_status NOT NULL,
    CONSTRAINT participant_identity_valid CHECK ((((participant_type = 'MEMBER'::public.participant_type) AND (member_id IS NOT NULL) AND (casual_customer_id IS NULL)) OR ((participant_type = 'CASUAL'::public.participant_type) AND (casual_customer_id IS NOT NULL) AND (member_id IS NULL) AND (membership_id IS NULL))))
);


ALTER TABLE public.booking_participants OWNER TO postgres;

--
-- Name: booking_slot_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.booking_slot_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    from_slot_id uuid,
    to_slot_id uuid NOT NULL,
    actor_id uuid,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.booking_slot_history OWNER TO postgres;

--
-- Name: booking_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.booking_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    from_status public.booking_status,
    to_status public.booking_status NOT NULL,
    actor_id uuid,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.booking_status_history OWNER TO postgres;

--
-- Name: bookings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slot_id uuid NOT NULL,
    status public.booking_status DEFAULT 'PENDING'::public.booking_status NOT NULL,
    created_by uuid,
    is_casual boolean DEFAULT false NOT NULL,
    pending_expires_at timestamp with time zone,
    requested_slot_id uuid,
    cancellation_reason text,
    cancelled_by uuid,
    cancelled_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bookings OWNER TO postgres;

--
-- Name: casual_customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.casual_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    phone text NOT NULL,
    email text,
    notes text,
    linked_member_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.casual_customers OWNER TO postgres;

--
-- Name: fcm_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fcm_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    device_info jsonb,
    last_active timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.fcm_tokens OWNER TO postgres;

--
-- Name: horses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.horses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    status public.horse_status DEFAULT 'ACTIVE'::public.horse_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.horses OWNER TO postgres;

--
-- Name: integration_sync_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.integration_sync_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    target text DEFAULT 'GOOGLE_SHEETS'::text NOT NULL,
    operation text NOT NULL,
    status public.sync_status DEFAULT 'QUEUED'::public.sync_status NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    next_retry_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT integration_sync_jobs_operation_check CHECK ((operation = ANY (ARRAY['UPSERT'::text, 'DELETE'::text])))
);


ALTER TABLE public.integration_sync_jobs OWNER TO postgres;

--
-- Name: members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text NOT NULL,
    phone text NOT NULL,
    date_of_birth date,
    emergency_contact_name text,
    emergency_contact_phone text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    domicile text,
    height_cm numeric(5,2),
    weight_kg numeric(5,2),
    shoe_size numeric(4,1)
);


ALTER TABLE public.members OWNER TO postgres;

--
-- Name: membership_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.membership_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    previous_membership_id uuid,
    requested_plan_id uuid NOT NULL,
    base_price_idr numeric(12,0) NOT NULL,
    discount_idr numeric(12,0) DEFAULT 0 NOT NULL,
    final_price_idr numeric(12,0) NOT NULL,
    payment_order_id uuid,
    status text DEFAULT 'PENDING'::text NOT NULL,
    new_membership_id uuid,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    application_type text DEFAULT 'NEW'::text NOT NULL,
    human_id text NOT NULL,
    CONSTRAINT membership_applications_application_type_check CHECK ((application_type = ANY (ARRAY['NEW'::text, 'RENEWAL'::text]))),
    CONSTRAINT membership_applications_status_check CHECK ((status = ANY (ARRAY['PENDING_REVIEW'::text, 'APPROVED'::text, 'PAYMENT_CONFIRMED'::text, 'ACTIVATED'::text, 'REJECTED'::text, 'CANCELLED'::text])))
);


ALTER TABLE public.membership_applications OWNER TO postgres;

--
-- Name: membership_credit_ledger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.membership_credit_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    membership_id uuid NOT NULL,
    member_id uuid NOT NULL,
    booking_id uuid,
    participant_id uuid,
    txn_type public.credit_txn_type NOT NULL,
    delta_reserved integer DEFAULT 0 NOT NULL,
    delta_consumed integer DEFAULT 0 NOT NULL,
    delta_allocated integer DEFAULT 0 NOT NULL,
    reason text,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.membership_credit_ledger OWNER TO postgres;

--
-- Name: membership_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.membership_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    price_idr numeric(12,0) NOT NULL,
    extension_discount_idr numeric(12,0) DEFAULT 0 NOT NULL,
    credits integer NOT NULL,
    duration_months integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT membership_plans_credits_check CHECK ((credits > 0)),
    CONSTRAINT membership_plans_duration_months_check CHECK ((duration_months > 0)),
    CONSTRAINT membership_plans_extension_discount_idr_check CHECK ((extension_discount_idr >= (0)::numeric)),
    CONSTRAINT membership_plans_price_idr_check CHECK ((price_idr >= (0)::numeric))
);


ALTER TABLE public.membership_plans OWNER TO postgres;

--
-- Name: memberships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    status public.membership_status DEFAULT 'PENDING_PAYMENT'::public.membership_status NOT NULL,
    start_date date,
    end_date date,
    allocated_credits integer NOT NULL,
    price_paid_idr numeric(12,0),
    previous_membership_id uuid,
    activated_by uuid,
    activated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT membership_dates_valid CHECK ((((status = 'PENDING_PAYMENT'::public.membership_status) AND (start_date IS NULL)) OR ((start_date IS NOT NULL) AND (end_date IS NOT NULL) AND (end_date > start_date)))),
    CONSTRAINT memberships_allocated_credits_check CHECK ((allocated_credits >= 0))
);


ALTER TABLE public.memberships OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    event_type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    read_at timestamp with time zone,
    delivery_status text DEFAULT 'QUEUED'::text NOT NULL,
    delivery_error text,
    dedupe_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['QUEUED'::text, 'SENT'::text, 'FAILED'::text, 'SKIPPED'::text])))
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: operating_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.operating_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    day_of_week smallint NOT NULL,
    block public.operating_block NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    session_duration_minutes integer DEFAULT 45 NOT NULL,
    slot_interval_minutes integer DEFAULT 60 NOT NULL,
    default_capacity integer DEFAULT 2 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT operating_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT operating_schedules_default_capacity_check CHECK ((default_capacity > 0)),
    CONSTRAINT operating_schedules_session_duration_minutes_check CHECK ((session_duration_minutes > 0)),
    CONSTRAINT operating_schedules_slot_interval_minutes_check CHECK ((slot_interval_minutes > 0)),
    CONSTRAINT schedule_block_valid CHECK ((end_time > start_time)),
    CONSTRAINT schedule_start_on_hour CHECK ((date_part('minute'::text, start_time) = (0)::double precision))
);


ALTER TABLE public.operating_schedules OWNER TO postgres;

--
-- Name: payment_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text DEFAULT 'MANUAL_WHATSAPP'::text NOT NULL,
    provider_ref text,
    member_id uuid,
    membership_id uuid,
    amount_idr numeric(12,0) NOT NULL,
    status public.payment_status DEFAULT 'PENDING'::public.payment_status NOT NULL,
    idempotency_key text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_orders_amount_idr_check CHECK ((amount_idr >= (0)::numeric))
);


ALTER TABLE public.payment_orders OWNER TO postgres;

--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_order_id uuid NOT NULL,
    provider_event_id text,
    status public.payment_status NOT NULL,
    amount_idr numeric(12,0) NOT NULL,
    raw_payload jsonb,
    confirmed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payment_transactions OWNER TO postgres;

--
-- Name: riding_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.riding_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    human_id text NOT NULL,
    member_id uuid,
    casual_customer_id uuid,
    request_type public.riding_request_type NOT NULL,
    preferred_date date NOT NULL,
    preferred_time_start time without time zone NOT NULL,
    height_cm numeric(5,2) NOT NULL,
    weight_kg numeric(5,2) NOT NULL,
    shoe_size integer,
    status public.riding_request_status DEFAULT 'UNDER_REVIEW'::public.riding_request_status NOT NULL,
    booking_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT has_owner CHECK (((member_id IS NOT NULL) OR (casual_customer_id IS NOT NULL)))
);


ALTER TABLE public.riding_requests OWNER TO postgres;

--
-- Name: schedule_overrides; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schedule_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    override_date date NOT NULL,
    block public.operating_block,
    is_closed boolean DEFAULT false NOT NULL,
    capacity_override integer,
    reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schedule_overrides_capacity_override_check CHECK ((capacity_override > 0))
);


ALTER TABLE public.schedule_overrides OWNER TO postgres;

--
-- Name: session_slots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slot_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    block public.operating_block NOT NULL,
    capacity integer NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    closed_reason text,
    source_schedule_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_slots_capacity_check CHECK ((capacity > 0)),
    CONSTRAINT slot_start_on_hour CHECK ((date_part('minute'::text, start_time) = (0)::double precision)),
    CONSTRAINT slot_times_valid CHECK ((end_time > start_time))
);


ALTER TABLE public.session_slots OWNER TO postgres;

--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_settings (
    id integer DEFAULT 1 NOT NULL,
    reschedule_hours integer DEFAULT 24 NOT NULL,
    admin_whatsapp text DEFAULT '8123194014'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT site_settings_id_check CHECK ((id = 1))
);


ALTER TABLE public.site_settings OWNER TO postgres;

--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    value_type text NOT NULL,
    description text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT system_settings_value_type_check CHECK ((value_type = ANY (ARRAY['int'::text, 'decimal'::text, 'bool'::text, 'string'::text, 'json'::text])))
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: user_devices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_token text NOT NULL,
    platform text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_seen_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_devices_platform_check CHECK ((platform = ANY (ARRAY['WEB'::text, 'ANDROID'::text, 'IOS'::text])))
);


ALTER TABLE public.user_devices OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    role public.app_role DEFAULT 'MEMBER'::public.app_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: attendance_records attendance_records_participant_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_participant_id_key UNIQUE (participant_id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: booking_participants booking_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_participants
    ADD CONSTRAINT booking_participants_pkey PRIMARY KEY (id);


--
-- Name: booking_slot_history booking_slot_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_slot_history
    ADD CONSTRAINT booking_slot_history_pkey PRIMARY KEY (id);


--
-- Name: booking_status_history booking_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_status_history
    ADD CONSTRAINT booking_status_history_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: casual_customers casual_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.casual_customers
    ADD CONSTRAINT casual_customers_pkey PRIMARY KEY (id);


--
-- Name: fcm_tokens fcm_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_pkey PRIMARY KEY (id);


--
-- Name: fcm_tokens fcm_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_token_key UNIQUE (token);


--
-- Name: horses horses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horses
    ADD CONSTRAINT horses_pkey PRIMARY KEY (id);


--
-- Name: integration_sync_jobs integration_sync_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integration_sync_jobs
    ADD CONSTRAINT integration_sync_jobs_pkey PRIMARY KEY (id);


--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (id);


--
-- Name: members members_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_user_id_key UNIQUE (user_id);


--
-- Name: membership_applications membership_applications_human_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_applications
    ADD CONSTRAINT membership_applications_human_id_key UNIQUE (human_id);


--
-- Name: membership_applications membership_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_applications
    ADD CONSTRAINT membership_applications_pkey PRIMARY KEY (id);


--
-- Name: membership_credit_ledger membership_credit_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_credit_ledger
    ADD CONSTRAINT membership_credit_ledger_pkey PRIMARY KEY (id);


--
-- Name: membership_plans membership_plans_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_plans
    ADD CONSTRAINT membership_plans_code_key UNIQUE (code);


--
-- Name: membership_plans membership_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_plans
    ADD CONSTRAINT membership_plans_pkey PRIMARY KEY (id);


--
-- Name: memberships memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (id);


--
-- Name: notification_outbox notification_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: operating_schedules operating_schedules_day_of_week_block_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operating_schedules
    ADD CONSTRAINT operating_schedules_day_of_week_block_key UNIQUE (day_of_week, block);


--
-- Name: operating_schedules operating_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operating_schedules
    ADD CONSTRAINT operating_schedules_pkey PRIMARY KEY (id);


--
-- Name: payment_orders payment_orders_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: payment_orders payment_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_payment_order_id_provider_event_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_payment_order_id_provider_event_id_key UNIQUE (payment_order_id, provider_event_id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: riding_requests riding_requests_human_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.riding_requests
    ADD CONSTRAINT riding_requests_human_id_key UNIQUE (human_id);


--
-- Name: riding_requests riding_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.riding_requests
    ADD CONSTRAINT riding_requests_pkey PRIMARY KEY (id);


--
-- Name: schedule_overrides schedule_overrides_override_date_block_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_overrides
    ADD CONSTRAINT schedule_overrides_override_date_block_key UNIQUE (override_date, block);


--
-- Name: schedule_overrides schedule_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_overrides
    ADD CONSTRAINT schedule_overrides_pkey PRIMARY KEY (id);


--
-- Name: session_slots session_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_slots
    ADD CONSTRAINT session_slots_pkey PRIMARY KEY (id);


--
-- Name: session_slots session_slots_slot_date_start_time_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_slots
    ADD CONSTRAINT session_slots_slot_date_start_time_key UNIQUE (slot_date, start_time);


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: user_devices user_devices_device_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_device_token_key UNIQUE (device_token);


--
-- Name: user_devices user_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_actor_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_actor_idx ON public.audit_logs USING btree (actor_id, created_at DESC);


--
-- Name: audit_logs_entity_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_entity_idx ON public.audit_logs USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: booking_participants_booking_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX booking_participants_booking_idx ON public.booking_participants USING btree (booking_id);


--
-- Name: booking_participants_horse_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX booking_participants_horse_idx ON public.booking_participants USING btree (horse_id);


--
-- Name: booking_participants_member_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX booking_participants_member_idx ON public.booking_participants USING btree (member_id);


--
-- Name: booking_participants_unique_member; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX booking_participants_unique_member ON public.booking_participants USING btree (booking_id, member_id) WHERE (member_id IS NOT NULL);


--
-- Name: booking_status_history_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX booking_status_history_idx ON public.booking_status_history USING btree (booking_id, created_at);


--
-- Name: bookings_pending_expiry_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bookings_pending_expiry_idx ON public.bookings USING btree (pending_expires_at) WHERE (status = 'PENDING'::public.booking_status);


--
-- Name: bookings_slot_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bookings_slot_idx ON public.bookings USING btree (slot_id, status);


--
-- Name: bookings_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bookings_status_idx ON public.bookings USING btree (status, created_at);


--
-- Name: casual_customers_phone_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX casual_customers_phone_idx ON public.casual_customers USING btree (phone);


--
-- Name: credit_ledger_booking_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX credit_ledger_booking_idx ON public.membership_credit_ledger USING btree (booking_id);


--
-- Name: credit_ledger_membership_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX credit_ledger_membership_idx ON public.membership_credit_ledger USING btree (membership_id, created_at);


--
-- Name: credit_ledger_one_reservation_per_participant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX credit_ledger_one_reservation_per_participant ON public.membership_credit_ledger USING btree (participant_id) WHERE ((txn_type = 'SESSION_RESERVED'::public.credit_txn_type) AND (participant_id IS NOT NULL));


--
-- Name: credit_ledger_one_settlement_per_participant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX credit_ledger_one_settlement_per_participant ON public.membership_credit_ledger USING btree (participant_id) WHERE ((participant_id IS NOT NULL) AND (txn_type = ANY (ARRAY['SESSION_COMPLETED'::public.credit_txn_type, 'EARLY_CANCELLATION_RETURN'::public.credit_txn_type, 'LATE_CANCELLATION'::public.credit_txn_type, 'BBS_CANCELLATION_RETURN'::public.credit_txn_type, 'NO_SHOW_DEDUCT'::public.credit_txn_type, 'NO_SHOW_RETURN'::public.credit_txn_type])));


--
-- Name: fcm_tokens_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fcm_tokens_user_idx ON public.fcm_tokens USING btree (user_id);


--
-- Name: members_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX members_user_idx ON public.members USING btree (user_id);


--
-- Name: membership_applications_human_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX membership_applications_human_idx ON public.membership_applications USING btree (human_id);


--
-- Name: membership_apps_one_active_per_member; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX membership_apps_one_active_per_member ON public.membership_applications USING btree (member_id) WHERE (status = ANY (ARRAY['PENDING_REVIEW'::text, 'APPROVED'::text, 'PAYMENT_CONFIRMED'::text]));


--
-- Name: memberships_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX memberships_active_idx ON public.memberships USING btree (status, end_date) WHERE (status = 'ACTIVE'::public.membership_status);


--
-- Name: memberships_member_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX memberships_member_idx ON public.memberships USING btree (member_id, status);


--
-- Name: memberships_one_active_per_member; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX memberships_one_active_per_member ON public.memberships USING btree (member_id) WHERE (status = 'ACTIVE'::public.membership_status);


--
-- Name: notification_outbox_aggregate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notification_outbox_aggregate_idx ON public.notification_outbox USING btree (aggregate_type, aggregate_id);


--
-- Name: notification_outbox_idempotency_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX notification_outbox_idempotency_idx ON public.notification_outbox USING btree (event_type, aggregate_id, recipient_user_id, channel);


--
-- Name: notification_outbox_recipient_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notification_outbox_recipient_idx ON public.notification_outbox USING btree (recipient_user_id, created_at DESC);


--
-- Name: notification_outbox_worker_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notification_outbox_worker_idx ON public.notification_outbox USING btree (status, available_at) WHERE (status = 'PENDING'::public.notification_status);


--
-- Name: notifications_dedupe_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX notifications_dedupe_idx ON public.notifications USING btree (dedupe_key) WHERE (dedupe_key IS NOT NULL);


--
-- Name: notifications_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: riding_requests_casual_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX riding_requests_casual_idx ON public.riding_requests USING btree (casual_customer_id);


--
-- Name: riding_requests_human_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX riding_requests_human_idx ON public.riding_requests USING btree (human_id);


--
-- Name: riding_requests_member_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX riding_requests_member_idx ON public.riding_requests USING btree (member_id);


--
-- Name: riding_requests_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX riding_requests_status_idx ON public.riding_requests USING btree (status);


--
-- Name: session_slots_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX session_slots_date_idx ON public.session_slots USING btree (slot_date, start_time);


--
-- Name: session_slots_open_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX session_slots_open_idx ON public.session_slots USING btree (slot_date) WHERE is_open;


--
-- Name: sync_jobs_pending_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX sync_jobs_pending_unique ON public.integration_sync_jobs USING btree (entity_type, entity_id, target) WHERE (status = ANY (ARRAY['QUEUED'::public.sync_status, 'RUNNING'::public.sync_status]));


--
-- Name: sync_jobs_retry_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sync_jobs_retry_idx ON public.integration_sync_jobs USING btree (status, next_retry_at);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_idx ON public.users USING btree (lower(email));


--
-- Name: membership_applications trg_membership_application_notifications; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_membership_application_notifications AFTER UPDATE ON public.membership_applications FOR EACH ROW EXECUTE FUNCTION public.trg_membership_application_notifications();


--
-- Name: attendance_records attendance_records_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE RESTRICT;


--
-- Name: attendance_records attendance_records_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.booking_participants(id) ON DELETE RESTRICT;


--
-- Name: attendance_records attendance_records_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: booking_participants booking_participants_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_participants
    ADD CONSTRAINT booking_participants_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_participants booking_participants_casual_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_participants
    ADD CONSTRAINT booking_participants_casual_customer_id_fkey FOREIGN KEY (casual_customer_id) REFERENCES public.casual_customers(id) ON DELETE RESTRICT;


--
-- Name: booking_participants booking_participants_horse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_participants
    ADD CONSTRAINT booking_participants_horse_id_fkey FOREIGN KEY (horse_id) REFERENCES public.horses(id) ON DELETE RESTRICT;


--
-- Name: booking_participants booking_participants_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_participants
    ADD CONSTRAINT booking_participants_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE RESTRICT;


--
-- Name: booking_participants booking_participants_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_participants
    ADD CONSTRAINT booking_participants_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.memberships(id) ON DELETE RESTRICT;


--
-- Name: booking_slot_history booking_slot_history_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_slot_history
    ADD CONSTRAINT booking_slot_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: booking_slot_history booking_slot_history_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_slot_history
    ADD CONSTRAINT booking_slot_history_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_slot_history booking_slot_history_from_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_slot_history
    ADD CONSTRAINT booking_slot_history_from_slot_id_fkey FOREIGN KEY (from_slot_id) REFERENCES public.session_slots(id);


--
-- Name: booking_slot_history booking_slot_history_to_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_slot_history
    ADD CONSTRAINT booking_slot_history_to_slot_id_fkey FOREIGN KEY (to_slot_id) REFERENCES public.session_slots(id);


--
-- Name: booking_status_history booking_status_history_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_status_history
    ADD CONSTRAINT booking_status_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: booking_status_history booking_status_history_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_status_history
    ADD CONSTRAINT booking_status_history_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(id);


--
-- Name: bookings bookings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bookings bookings_requested_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_requested_slot_id_fkey FOREIGN KEY (requested_slot_id) REFERENCES public.session_slots(id);


--
-- Name: bookings bookings_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.session_slots(id) ON DELETE RESTRICT;


--
-- Name: casual_customers casual_customers_linked_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.casual_customers
    ADD CONSTRAINT casual_customers_linked_member_id_fkey FOREIGN KEY (linked_member_id) REFERENCES public.members(id);


--
-- Name: membership_credit_ledger credit_ledger_booking_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_credit_ledger
    ADD CONSTRAINT credit_ledger_booking_fk FOREIGN KEY (booking_id) REFERENCES public.bookings(id);


--
-- Name: membership_credit_ledger credit_ledger_participant_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_credit_ledger
    ADD CONSTRAINT credit_ledger_participant_fk FOREIGN KEY (participant_id) REFERENCES public.booking_participants(id);


--
-- Name: fcm_tokens fcm_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: members members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: membership_credit_ledger membership_credit_ledger_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_credit_ledger
    ADD CONSTRAINT membership_credit_ledger_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: membership_credit_ledger membership_credit_ledger_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_credit_ledger
    ADD CONSTRAINT membership_credit_ledger_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE RESTRICT;


--
-- Name: membership_credit_ledger membership_credit_ledger_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_credit_ledger
    ADD CONSTRAINT membership_credit_ledger_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.memberships(id) ON DELETE RESTRICT;


--
-- Name: memberships memberships_activated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_activated_by_fkey FOREIGN KEY (activated_by) REFERENCES public.users(id);


--
-- Name: memberships memberships_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE RESTRICT;


--
-- Name: memberships memberships_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.membership_plans(id) ON DELETE RESTRICT;


--
-- Name: memberships memberships_previous_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_previous_membership_id_fkey FOREIGN KEY (previous_membership_id) REFERENCES public.memberships(id);


--
-- Name: notification_outbox notification_outbox_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payment_orders payment_orders_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id);


--
-- Name: payment_orders payment_orders_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.memberships(id);


--
-- Name: payment_transactions payment_transactions_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.users(id);


--
-- Name: payment_transactions payment_transactions_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_payment_order_id_fkey FOREIGN KEY (payment_order_id) REFERENCES public.payment_orders(id) ON DELETE RESTRICT;


--
-- Name: membership_applications renewal_requests_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_applications
    ADD CONSTRAINT renewal_requests_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id);


--
-- Name: membership_applications renewal_requests_new_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_applications
    ADD CONSTRAINT renewal_requests_new_membership_id_fkey FOREIGN KEY (new_membership_id) REFERENCES public.memberships(id);


--
-- Name: membership_applications renewal_requests_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_applications
    ADD CONSTRAINT renewal_requests_payment_order_id_fkey FOREIGN KEY (payment_order_id) REFERENCES public.payment_orders(id);


--
-- Name: membership_applications renewal_requests_previous_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_applications
    ADD CONSTRAINT renewal_requests_previous_membership_id_fkey FOREIGN KEY (previous_membership_id) REFERENCES public.memberships(id);


--
-- Name: membership_applications renewal_requests_requested_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_applications
    ADD CONSTRAINT renewal_requests_requested_plan_id_fkey FOREIGN KEY (requested_plan_id) REFERENCES public.membership_plans(id);


--
-- Name: riding_requests riding_requests_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.riding_requests
    ADD CONSTRAINT riding_requests_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: riding_requests riding_requests_casual_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.riding_requests
    ADD CONSTRAINT riding_requests_casual_customer_id_fkey FOREIGN KEY (casual_customer_id) REFERENCES public.casual_customers(id) ON DELETE CASCADE;


--
-- Name: riding_requests riding_requests_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.riding_requests
    ADD CONSTRAINT riding_requests_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: schedule_overrides schedule_overrides_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_overrides
    ADD CONSTRAINT schedule_overrides_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: session_slots session_slots_source_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_slots
    ADD CONSTRAINT session_slots_source_schedule_id_fkey FOREIGN KEY (source_schedule_id) REFERENCES public.operating_schedules(id);


--
-- Name: user_devices user_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: fcm_tokens Admins can view all FCM tokens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all FCM tokens" ON public.fcm_tokens FOR SELECT USING (public.is_admin());


--
-- Name: notification_outbox Admins can view all outbox records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all outbox records" ON public.notification_outbox FOR SELECT USING (public.is_admin());


--
-- Name: fcm_tokens Users can manage their own FCM tokens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage their own FCM tokens" ON public.fcm_tokens USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: notification_outbox Users can view their own outbox records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own outbox records" ON public.notification_outbox FOR SELECT USING ((recipient_user_id = auth.uid()));


--
-- Name: attendance_records attendance_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY attendance_admin ON public.attendance_records USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: attendance_records attendance_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY attendance_read ON public.attendance_records FOR SELECT USING ((public.is_admin() OR (public.current_app_role() = 'GROOMER'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.booking_participants bp
  WHERE ((bp.id = attendance_records.participant_id) AND (bp.member_id = public.current_member_id()))))));


--
-- Name: attendance_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY audit_admin ON public.audit_logs USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_participants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.booking_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_slot_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.booking_slot_history ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_status_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings bookings_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bookings_admin ON public.bookings USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: bookings bookings_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bookings_read ON public.bookings FOR SELECT USING (
CASE
    WHEN public.is_admin() THEN true
    WHEN public.authz_is_booking_participant(id) THEN true
    WHEN public.authz_groomer_can_access_booking(id) THEN true
    ELSE false
END);


--
-- Name: casual_customers casual_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY casual_admin ON public.casual_customers USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: casual_customers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.casual_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: user_devices devices_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY devices_owner ON public.user_devices USING (((user_id = auth.uid()) OR public.is_admin())) WITH CHECK (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: fcm_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: horses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.horses ENABLE ROW LEVEL SECURITY;

--
-- Name: horses horses_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY horses_all ON public.horses USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'ADMIN'::public.app_role)))));


--
-- Name: horses horses_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY horses_select ON public.horses FOR SELECT USING (true);


--
-- Name: integration_sync_jobs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.integration_sync_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: membership_credit_ledger ledger_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ledger_admin ON public.membership_credit_ledger USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: membership_credit_ledger ledger_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ledger_owner ON public.membership_credit_ledger FOR SELECT USING (((member_id = public.current_member_id()) OR public.is_admin()));


--
-- Name: members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

--
-- Name: members members_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY members_admin ON public.members USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: members members_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY members_self ON public.members FOR SELECT USING (
CASE
    WHEN (user_id = auth.uid()) THEN true
    WHEN public.is_admin() THEN true
    WHEN public.authz_groomer_can_access_member(id) THEN true
    ELSE false
END);


--
-- Name: membership_applications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.membership_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: membership_applications membership_applications_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY membership_applications_admin ON public.membership_applications USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: membership_applications membership_applications_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY membership_applications_insert ON public.membership_applications FOR INSERT WITH CHECK ((member_id = public.current_member_id()));


--
-- Name: membership_applications membership_applications_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY membership_applications_owner ON public.membership_applications FOR SELECT USING (((member_id = public.current_member_id()) OR public.is_admin()));


--
-- Name: membership_credit_ledger; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.membership_credit_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: membership_plans; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: memberships; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: memberships memberships_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY memberships_admin ON public.memberships USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: memberships memberships_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY memberships_owner ON public.memberships FOR SELECT USING (((member_id = public.current_member_id()) OR public.is_admin()));


--
-- Name: notification_outbox; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_mark_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notifications_mark_read ON public.notifications FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: notifications notifications_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notifications_owner ON public.notifications FOR SELECT USING (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: operating_schedules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.operating_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_overrides overrides_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY overrides_admin ON public.schedule_overrides USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: schedule_overrides overrides_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY overrides_read ON public.schedule_overrides FOR SELECT USING (true);


--
-- Name: booking_participants participants_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY participants_admin ON public.booking_participants USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: booking_participants participants_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY participants_read ON public.booking_participants FOR SELECT USING (
CASE
    WHEN public.is_admin() THEN true
    WHEN (member_id = public.current_member_id()) THEN true
    WHEN public.authz_groomer_can_access_booking(booking_id) THEN true
    ELSE false
END);


--
-- Name: payment_orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_orders payment_orders_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY payment_orders_admin ON public.payment_orders USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: payment_orders payment_orders_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY payment_orders_owner ON public.payment_orders FOR SELECT USING (((member_id = public.current_member_id()) OR public.is_admin()));


--
-- Name: payment_transactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_transactions payment_txn_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY payment_txn_admin ON public.payment_transactions USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: membership_plans plans_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY plans_admin ON public.membership_plans USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: membership_plans plans_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY plans_public_read ON public.membership_plans FOR SELECT USING ((is_active OR public.is_admin()));


--
-- Name: riding_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.riding_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: riding_requests riding_requests_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY riding_requests_admin ON public.riding_requests USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: riding_requests riding_requests_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY riding_requests_insert_own ON public.riding_requests FOR INSERT WITH CHECK (((member_id IS NOT NULL) AND (member_id = ( SELECT members.id
   FROM public.members
  WHERE (members.user_id = auth.uid())))));


--
-- Name: riding_requests riding_requests_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY riding_requests_select_own ON public.riding_requests FOR SELECT USING (((member_id IS NOT NULL) AND (member_id = ( SELECT members.id
   FROM public.members
  WHERE (members.user_id = auth.uid())))));


--
-- Name: schedule_overrides; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: operating_schedules schedules_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY schedules_admin ON public.operating_schedules USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: operating_schedules schedules_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY schedules_public_read ON public.operating_schedules FOR SELECT USING (true);


--
-- Name: session_slots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.session_slots ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings settings_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY settings_admin ON public.system_settings USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: system_settings settings_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY settings_read ON public.system_settings FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings site_settings_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY site_settings_select ON public.site_settings FOR SELECT USING (true);


--
-- Name: site_settings site_settings_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY site_settings_update ON public.site_settings FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'ADMIN'::public.app_role)))));


--
-- Name: booking_slot_history slot_history_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY slot_history_read ON public.booking_slot_history FOR SELECT USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.booking_participants bp
  WHERE ((bp.booking_id = booking_slot_history.booking_id) AND (bp.member_id = public.current_member_id()))))));


--
-- Name: session_slots slots_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY slots_admin ON public.session_slots USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: session_slots slots_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY slots_public_read ON public.session_slots FOR SELECT USING (true);


--
-- Name: booking_status_history status_history_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY status_history_read ON public.booking_status_history FOR SELECT USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.booking_participants bp
  WHERE ((bp.booking_id = booking_status_history.booking_id) AND (bp.member_id = public.current_member_id()))))));


--
-- Name: integration_sync_jobs sync_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sync_admin ON public.integration_sync_jobs USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_devices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_admin_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY users_admin_all ON public.users USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: users users_self_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY users_self_select ON public.users FOR SELECT USING (((id = auth.uid()) OR public.is_admin()));


--
-- Name: users users_self_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY users_self_update ON public.users FOR UPDATE USING ((id = auth.uid())) WITH CHECK (((id = auth.uid()) AND (role = ( SELECT u.role
   FROM public.users u
  WHERE (u.id = auth.uid())))));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION activate_membership(p_application_id uuid, p_admin_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.activate_membership(p_application_id uuid, p_admin_id uuid) TO anon;
GRANT ALL ON FUNCTION public.activate_membership(p_application_id uuid, p_admin_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.activate_membership(p_application_id uuid, p_admin_id uuid) TO service_role;


--
-- Name: FUNCTION activate_pending_memberships(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.activate_pending_memberships() TO anon;
GRANT ALL ON FUNCTION public.activate_pending_memberships() TO authenticated;
GRANT ALL ON FUNCTION public.activate_pending_memberships() TO service_role;


--
-- Name: FUNCTION approve_booking(p_booking_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.approve_booking(p_booking_id uuid, p_actor_id uuid) TO anon;
GRANT ALL ON FUNCTION public.approve_booking(p_booking_id uuid, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.approve_booking(p_booking_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION approve_reschedule(p_booking_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.approve_reschedule(p_booking_id uuid, p_actor_id uuid) TO anon;
GRANT ALL ON FUNCTION public.approve_reschedule(p_booking_id uuid, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.approve_reschedule(p_booking_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION approve_riding_request(p_request_id uuid, p_date date, p_time time without time zone, p_capacity integer, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.approve_riding_request(p_request_id uuid, p_date date, p_time time without time zone, p_capacity integer, p_actor_id uuid) TO anon;
GRANT ALL ON FUNCTION public.approve_riding_request(p_request_id uuid, p_date date, p_time time without time zone, p_capacity integer, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.approve_riding_request(p_request_id uuid, p_date date, p_time time without time zone, p_capacity integer, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION assign_horse(p_participant_id uuid, p_horse_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.assign_horse(p_participant_id uuid, p_horse_id uuid, p_actor_id uuid) TO anon;
GRANT ALL ON FUNCTION public.assign_horse(p_participant_id uuid, p_horse_id uuid, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.assign_horse(p_participant_id uuid, p_horse_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION authz_groomer_can_access_booking(p_booking_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.authz_groomer_can_access_booking(p_booking_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.authz_groomer_can_access_booking(p_booking_id uuid) TO anon;
GRANT ALL ON FUNCTION public.authz_groomer_can_access_booking(p_booking_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.authz_groomer_can_access_booking(p_booking_id uuid) TO service_role;


--
-- Name: FUNCTION authz_groomer_can_access_member(p_member_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.authz_groomer_can_access_member(p_member_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.authz_groomer_can_access_member(p_member_id uuid) TO anon;
GRANT ALL ON FUNCTION public.authz_groomer_can_access_member(p_member_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.authz_groomer_can_access_member(p_member_id uuid) TO service_role;


--
-- Name: FUNCTION authz_is_booking_participant(p_booking_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.authz_is_booking_participant(p_booking_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.authz_is_booking_participant(p_booking_id uuid) TO anon;
GRANT ALL ON FUNCTION public.authz_is_booking_participant(p_booking_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.authz_is_booking_participant(p_booking_id uuid) TO service_role;


--
-- Name: FUNCTION cancel_booking(p_booking_id uuid, p_actor_id uuid, p_source text, p_reason text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cancel_booking(p_booking_id uuid, p_actor_id uuid, p_source text, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.cancel_booking(p_booking_id uuid, p_actor_id uuid, p_source text, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_booking(p_booking_id uuid, p_actor_id uuid, p_source text, p_reason text) TO service_role;


--
-- Name: TABLE notification_outbox; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_outbox TO anon;
GRANT ALL ON TABLE public.notification_outbox TO authenticated;
GRANT ALL ON TABLE public.notification_outbox TO service_role;


--
-- Name: FUNCTION claim_pending_notifications(p_batch_size integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.claim_pending_notifications(p_batch_size integer) TO anon;
GRANT ALL ON FUNCTION public.claim_pending_notifications(p_batch_size integer) TO authenticated;
GRANT ALL ON FUNCTION public.claim_pending_notifications(p_batch_size integer) TO service_role;


--
-- Name: FUNCTION create_member_booking(p_booking_owner_id uuid, p_slot_id uuid, p_participants jsonb, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_member_booking(p_booking_owner_id uuid, p_slot_id uuid, p_participants jsonb, p_actor_id uuid) TO anon;
GRANT ALL ON FUNCTION public.create_member_booking(p_booking_owner_id uuid, p_slot_id uuid, p_participants jsonb, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_member_booking(p_booking_owner_id uuid, p_slot_id uuid, p_participants jsonb, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION current_app_role(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.current_app_role() TO anon;
GRANT ALL ON FUNCTION public.current_app_role() TO authenticated;
GRANT ALL ON FUNCTION public.current_app_role() TO service_role;


--
-- Name: FUNCTION current_member_id(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.current_member_id() TO anon;
GRANT ALL ON FUNCTION public.current_member_id() TO authenticated;
GRANT ALL ON FUNCTION public.current_member_id() TO service_role;


--
-- Name: FUNCTION daily_maintenance(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.daily_maintenance() TO anon;
GRANT ALL ON FUNCTION public.daily_maintenance() TO authenticated;
GRANT ALL ON FUNCTION public.daily_maintenance() TO service_role;


--
-- Name: FUNCTION expire_memberships(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.expire_memberships() TO anon;
GRANT ALL ON FUNCTION public.expire_memberships() TO authenticated;
GRANT ALL ON FUNCTION public.expire_memberships() TO service_role;


--
-- Name: FUNCTION expire_pending_bookings(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.expire_pending_bookings() TO anon;
GRANT ALL ON FUNCTION public.expire_pending_bookings() TO authenticated;
GRANT ALL ON FUNCTION public.expire_pending_bookings() TO service_role;


--
-- Name: FUNCTION generate_session_slots(p_from date, p_to date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_session_slots(p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.generate_session_slots(p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.generate_session_slots(p_from date, p_to date) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION mark_notification_failed(p_id uuid, p_attempts integer, p_error text, p_is_permanent boolean, p_max_attempts integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.mark_notification_failed(p_id uuid, p_attempts integer, p_error text, p_is_permanent boolean, p_max_attempts integer) TO anon;
GRANT ALL ON FUNCTION public.mark_notification_failed(p_id uuid, p_attempts integer, p_error text, p_is_permanent boolean, p_max_attempts integer) TO authenticated;
GRANT ALL ON FUNCTION public.mark_notification_failed(p_id uuid, p_attempts integer, p_error text, p_is_permanent boolean, p_max_attempts integer) TO service_role;


--
-- Name: FUNCTION mark_notification_sent(p_id uuid, p_attempts integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.mark_notification_sent(p_id uuid, p_attempts integer) TO anon;
GRANT ALL ON FUNCTION public.mark_notification_sent(p_id uuid, p_attempts integer) TO authenticated;
GRANT ALL ON FUNCTION public.mark_notification_sent(p_id uuid, p_attempts integer) TO service_role;


--
-- Name: FUNCTION membership_credit_state(p_membership_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.membership_credit_state(p_membership_id uuid) TO anon;
GRANT ALL ON FUNCTION public.membership_credit_state(p_membership_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.membership_credit_state(p_membership_id uuid) TO service_role;


--
-- Name: FUNCTION raise_domain_error(p_code text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.raise_domain_error(p_code text) TO anon;
GRANT ALL ON FUNCTION public.raise_domain_error(p_code text) TO authenticated;
GRANT ALL ON FUNCTION public.raise_domain_error(p_code text) TO service_role;


--
-- Name: FUNCTION reject_booking(p_booking_id uuid, p_actor_id uuid, p_reason text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.reject_booking(p_booking_id uuid, p_actor_id uuid, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.reject_booking(p_booking_id uuid, p_actor_id uuid, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.reject_booking(p_booking_id uuid, p_actor_id uuid, p_reason text) TO service_role;


--
-- Name: FUNCTION reject_reschedule(p_booking_id uuid, p_actor_id uuid, p_reason text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.reject_reschedule(p_booking_id uuid, p_actor_id uuid, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.reject_reschedule(p_booking_id uuid, p_actor_id uuid, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.reject_reschedule(p_booking_id uuid, p_actor_id uuid, p_reason text) TO service_role;


--
-- Name: FUNCTION request_reschedule(p_booking_id uuid, p_new_slot_id uuid, p_member_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.request_reschedule(p_booking_id uuid, p_new_slot_id uuid, p_member_id uuid, p_actor_id uuid) TO anon;
GRANT ALL ON FUNCTION public.request_reschedule(p_booking_id uuid, p_new_slot_id uuid, p_member_id uuid, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.request_reschedule(p_booking_id uuid, p_new_slot_id uuid, p_member_id uuid, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION resolve_attendance(p_participant_id uuid, p_status public.attendance_status, p_credit_action text, p_reason text, p_actor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.resolve_attendance(p_participant_id uuid, p_status public.attendance_status, p_credit_action text, p_reason text, p_actor_id uuid) TO anon;
GRANT ALL ON FUNCTION public.resolve_attendance(p_participant_id uuid, p_status public.attendance_status, p_credit_action text, p_reason text, p_actor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.resolve_attendance(p_participant_id uuid, p_status public.attendance_status, p_credit_action text, p_reason text, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION setting_int(p_key text, p_default integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.setting_int(p_key text, p_default integer) TO anon;
GRANT ALL ON FUNCTION public.setting_int(p_key text, p_default integer) TO authenticated;
GRANT ALL ON FUNCTION public.setting_int(p_key text, p_default integer) TO service_role;


--
-- Name: FUNCTION slot_occupancy(p_slot_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.slot_occupancy(p_slot_id uuid) TO anon;
GRANT ALL ON FUNCTION public.slot_occupancy(p_slot_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.slot_occupancy(p_slot_id uuid) TO service_role;


--
-- Name: FUNCTION trg_membership_application_notifications(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trg_membership_application_notifications() TO anon;
GRANT ALL ON FUNCTION public.trg_membership_application_notifications() TO authenticated;
GRANT ALL ON FUNCTION public.trg_membership_application_notifications() TO service_role;


--
-- Name: TABLE attendance_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.attendance_records TO anon;
GRANT ALL ON TABLE public.attendance_records TO authenticated;
GRANT ALL ON TABLE public.attendance_records TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


--
-- Name: TABLE booking_participants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.booking_participants TO anon;
GRANT ALL ON TABLE public.booking_participants TO authenticated;
GRANT ALL ON TABLE public.booking_participants TO service_role;


--
-- Name: TABLE booking_slot_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.booking_slot_history TO anon;
GRANT ALL ON TABLE public.booking_slot_history TO authenticated;
GRANT ALL ON TABLE public.booking_slot_history TO service_role;


--
-- Name: TABLE booking_status_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.booking_status_history TO anon;
GRANT ALL ON TABLE public.booking_status_history TO authenticated;
GRANT ALL ON TABLE public.booking_status_history TO service_role;


--
-- Name: TABLE bookings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bookings TO anon;
GRANT ALL ON TABLE public.bookings TO authenticated;
GRANT ALL ON TABLE public.bookings TO service_role;


--
-- Name: TABLE casual_customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.casual_customers TO anon;
GRANT ALL ON TABLE public.casual_customers TO authenticated;
GRANT ALL ON TABLE public.casual_customers TO service_role;


--
-- Name: TABLE fcm_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fcm_tokens TO anon;
GRANT ALL ON TABLE public.fcm_tokens TO authenticated;
GRANT ALL ON TABLE public.fcm_tokens TO service_role;


--
-- Name: TABLE horses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.horses TO anon;
GRANT ALL ON TABLE public.horses TO authenticated;
GRANT ALL ON TABLE public.horses TO service_role;


--
-- Name: TABLE integration_sync_jobs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.integration_sync_jobs TO anon;
GRANT ALL ON TABLE public.integration_sync_jobs TO authenticated;
GRANT ALL ON TABLE public.integration_sync_jobs TO service_role;


--
-- Name: TABLE members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.members TO anon;
GRANT ALL ON TABLE public.members TO authenticated;
GRANT ALL ON TABLE public.members TO service_role;


--
-- Name: TABLE membership_applications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.membership_applications TO anon;
GRANT ALL ON TABLE public.membership_applications TO authenticated;
GRANT ALL ON TABLE public.membership_applications TO service_role;


--
-- Name: TABLE membership_credit_ledger; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.membership_credit_ledger TO anon;
GRANT ALL ON TABLE public.membership_credit_ledger TO authenticated;
GRANT ALL ON TABLE public.membership_credit_ledger TO service_role;


--
-- Name: TABLE membership_plans; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.membership_plans TO anon;
GRANT ALL ON TABLE public.membership_plans TO authenticated;
GRANT ALL ON TABLE public.membership_plans TO service_role;


--
-- Name: TABLE memberships; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.memberships TO anon;
GRANT ALL ON TABLE public.memberships TO authenticated;
GRANT ALL ON TABLE public.memberships TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE operating_schedules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.operating_schedules TO anon;
GRANT ALL ON TABLE public.operating_schedules TO authenticated;
GRANT ALL ON TABLE public.operating_schedules TO service_role;


--
-- Name: TABLE payment_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payment_orders TO anon;
GRANT ALL ON TABLE public.payment_orders TO authenticated;
GRANT ALL ON TABLE public.payment_orders TO service_role;


--
-- Name: TABLE payment_transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payment_transactions TO anon;
GRANT ALL ON TABLE public.payment_transactions TO authenticated;
GRANT ALL ON TABLE public.payment_transactions TO service_role;


--
-- Name: TABLE riding_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.riding_requests TO anon;
GRANT ALL ON TABLE public.riding_requests TO authenticated;
GRANT ALL ON TABLE public.riding_requests TO service_role;


--
-- Name: TABLE schedule_overrides; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.schedule_overrides TO anon;
GRANT ALL ON TABLE public.schedule_overrides TO authenticated;
GRANT ALL ON TABLE public.schedule_overrides TO service_role;


--
-- Name: TABLE session_slots; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.session_slots TO anon;
GRANT ALL ON TABLE public.session_slots TO authenticated;
GRANT ALL ON TABLE public.session_slots TO service_role;


--
-- Name: TABLE site_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.site_settings TO anon;
GRANT ALL ON TABLE public.site_settings TO authenticated;
GRANT ALL ON TABLE public.site_settings TO service_role;


--
-- Name: TABLE system_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.system_settings TO anon;
GRANT ALL ON TABLE public.system_settings TO authenticated;
GRANT ALL ON TABLE public.system_settings TO service_role;


--
-- Name: TABLE user_devices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_devices TO anon;
GRANT ALL ON TABLE public.user_devices TO authenticated;
GRANT ALL ON TABLE public.user_devices TO service_role;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict B4tHfAfuxOedAV64p3Nx5Qrnk6VpOMbJFIqaKcR4Qw5Nr5Rlw2dW7GxuP3RcQka

