-- weekly-booking-limit.test.sql
-- This script tests the domain rules for the weekly booking limit.
-- It is designed to be run in a transaction that will be rolled back.

BEGIN;

DO $$
declare
  test_user_id uuid := gen_random_uuid();
  test_member_id uuid := gen_random_uuid();
  test_membership_id uuid := gen_random_uuid();
  test_plan_id uuid := gen_random_uuid();
  
  -- Slots across different days in the same calendar week (Mon-Sun)
  -- Assuming '2023-10-09' is a Monday.
  slot_mon_id uuid := gen_random_uuid();
  slot_tue_id uuid := gen_random_uuid();
  slot_wed_id uuid := gen_random_uuid();
  
  -- Slot in the next calendar week
  slot_next_mon_id uuid := gen_random_uuid();

  b1_id uuid;
  b2_id uuid;
  b3_id uuid;
  
  err_msg text;
begin
  -- 1. Setup Test Data
  insert into users (id, email, full_name, role) values (test_user_id, 'testlimit@example.com', 'Test Limit', 'MEMBER');
  insert into members (id, user_id, full_name, status) values (test_member_id, test_user_id, 'Test Limit', 'ACTIVE');
  insert into membership_plans (id, name, duration_months, credits, price_idr, is_active) values (test_plan_id, 'Test Gold', 1, 10, 100, true);
  insert into memberships (id, member_id, plan_id, status, start_date, end_date, allocated_credits) 
  values (test_membership_id, test_member_id, test_plan_id, 'ACTIVE', '2023-10-01', '2023-11-01', 10);

  -- Create Slots
  insert into session_slots (id, slot_date, start_time, end_time, capacity, booked_count, status, is_open) 
  values (slot_mon_id, '2023-10-09', '08:00', '08:45', 5, 0, 'OPEN', true); -- Mon
  insert into session_slots (id, slot_date, start_time, end_time, capacity, booked_count, status, is_open) 
  values (slot_tue_id, '2023-10-10', '08:00', '08:45', 5, 0, 'OPEN', true); -- Tue
  insert into session_slots (id, slot_date, start_time, end_time, capacity, booked_count, status, is_open) 
  values (slot_wed_id, '2023-10-11', '08:00', '08:45', 5, 0, 'OPEN', true); -- Wed
  
  insert into session_slots (id, slot_date, start_time, end_time, capacity, booked_count, status, is_open) 
  values (slot_next_mon_id, '2023-10-16', '08:00', '08:45', 5, 0, 'OPEN', true); -- Next Mon

  -- We need to mock 'current_date' or adjust the booking window check if needed.
  -- For testing purposes, assuming booking window is loose or we temporarily bypass it in test env.
  -- To ensure slot dates pass `v_slot.slot_date < current_date`, we update slots to future dates.
  
  update session_slots set slot_date = date_trunc('week', current_date)::date + interval '1 day' where id = slot_mon_id; -- Tuesday this week
  update session_slots set slot_date = date_trunc('week', current_date)::date + interval '2 days' where id = slot_tue_id; -- Wednesday this week
  update session_slots set slot_date = date_trunc('week', current_date)::date + interval '3 days' where id = slot_wed_id; -- Thursday this week
  update session_slots set slot_date = date_trunc('week', current_date)::date + interval '8 days' where id = slot_next_mon_id; -- Tuesday next week

  -- Also extend membership to far future
  update memberships set end_date = current_date + interval '1 year' where id = test_membership_id;

  -- =====================================================================================
  -- Test 1: First weekly booking passes
  b1_id := create_member_booking(
    test_user_id, slot_mon_id, 
    jsonb_build_array(jsonb_build_object('type', 'MEMBER', 'member_id', test_member_id)), 
    test_user_id
  );
  if b1_id is null then raise exception 'Test 1 Failed'; end if;
  
  -- =====================================================================================
  -- Test 2: Second weekly booking passes
  b2_id := create_member_booking(
    test_user_id, slot_tue_id, 
    jsonb_build_array(jsonb_build_object('type', 'MEMBER', 'member_id', test_member_id)), 
    test_user_id
  );
  if b2_id is null then raise exception 'Test 2 Failed'; end if;

  -- =====================================================================================
  -- Test 3: Third weekly booking fails (WEEKLY_BOOKING_LIMIT_REACHED)
  begin
    b3_id := create_member_booking(
      test_user_id, slot_wed_id, 
      jsonb_build_array(jsonb_build_object('type', 'MEMBER', 'member_id', test_member_id)), 
      test_user_id
    );
    raise exception 'Test 3 Failed: Should have rejected the 3rd booking';
  exception when others then
    if sqlerrm != 'WEEKLY_BOOKING_LIMIT_REACHED' then
      raise exception 'Test 3 Failed: Wrong error message %', sqlerrm;
    end if;
  end;

  -- =====================================================================================
  -- Test 4: Cancelled booking does not count
  -- We cancel b2_id
  update bookings set status = 'MEMBER_CANCELLED' where id = b2_id;
  
  -- Now booking the 3rd slot should pass, because we only have 1 active this week!
  b3_id := create_member_booking(
    test_user_id, slot_wed_id, 
    jsonb_build_array(jsonb_build_object('type', 'MEMBER', 'member_id', test_member_id)), 
    test_user_id
  );
  if b3_id is null then raise exception 'Test 4 Failed'; end if;

  -- =====================================================================================
  -- Test 5: Completed booking counts
  -- We set b1_id to COMPLETED
  update bookings set status = 'COMPLETED' where id = b1_id;
  
  -- Now we have 1 COMPLETED (b1) and 1 PENDING (b3). Limit is 2.
  -- Trying to book again should fail.
  begin
    perform create_member_booking(
      test_user_id, slot_tue_id, -- reuse tue slot for test
      jsonb_build_array(jsonb_build_object('type', 'MEMBER', 'member_id', test_member_id)), 
      test_user_id
    );
    raise exception 'Test 5 Failed: Should have rejected since COMPLETED counts';
  exception when others then
    if sqlerrm != 'WEEKLY_BOOKING_LIMIT_REACHED' then
      raise exception 'Test 5 Failed: Wrong error message %', sqlerrm;
    end if;
  end;

  -- =====================================================================================
  -- Test 7: Across Sunday -> Monday are different weeks
  -- Next week booking should pass!
  perform create_member_booking(
    test_user_id, slot_next_mon_id, 
    jsonb_build_array(jsonb_build_object('type', 'MEMBER', 'member_id', test_member_id)), 
    test_user_id
  );

  raise notice 'ALL TESTS PASSED!';
end $$;

ROLLBACK;
