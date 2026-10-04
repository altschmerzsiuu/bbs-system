-- Fix approve_riding_request function to expect UNDER_REVIEW and update to CONFIRMED instead of APPROVED

CREATE OR REPLACE FUNCTION approve_riding_request(
    p_request_id uuid,
    p_date date,
    p_time time,
    p_capacity integer,
    p_actor_id uuid
) RETURNS uuid AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
