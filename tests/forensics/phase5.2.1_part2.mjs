import { Client } from 'pg';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function runTests() {
  const adminClient = new Client({ connectionString: DB_URL });
  await adminClient.connect();

  const results = [];
  function recordResult(area, name, expected, actual, passed, details = '') {
    results.push({ area, name, expected, actual, passed, details });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] [${area}] ${name}`);
    if (!passed) console.log(`   Expected: ${expected}\n   Actual: ${actual}\n   ${details}`);
  }

  try {
    await adminClient.query("TRUNCATE TABLE public.session_slots CASCADE");
    const adminId = uuid();
    const memberId = uuid();
    await adminClient.query("INSERT INTO auth.users (id, role) VALUES ($1, 'authenticated'), ($2, 'authenticated')", [adminId, memberId]);
    await adminClient.query("INSERT INTO public.users (id, email, role) VALUES ($1, $3, 'ADMIN'), ($2, $4, 'MEMBER')", [adminId, memberId, `a_${adminId}@t.c`, `b_${memberId}@t.c`]);
    await adminClient.query("INSERT INTO public.members (id, user_id, full_name, phone) VALUES ($1, $1, 'Test Member', '123')", [memberId]);

    const planId = uuid();
    await adminClient.query("INSERT INTO public.membership_plans (id, code, name, price_idr, credits, duration_months) VALUES ($1, $2, 'Basic', 1000, 4, 1)", [planId, planId.substring(0, 8)]);

    const horseId = uuid();
    await adminClient.query("INSERT INTO public.horses (id, name, status) VALUES ($1, 'Test Horse', 'ACTIVE')", [horseId]);

    const slotId = uuid();
    await adminClient.query("INSERT INTO public.session_slots (id, slot_date, start_time, end_time, capacity, block) VALUES ($1, CURRENT_DATE + interval '3 days', '10:00', '11:00', 1, 'MORNING')", [slotId]);

    // Test remaining RPCs
    
    // 1. activate_membership
    const applicationId = uuid();
    await adminClient.query(`
      INSERT INTO public.membership_applications (id, member_id, requested_plan_id, base_price_idr, final_price_idr, status, human_id)
      VALUES ($1, $2, $3, 1000, 1000, 'PAYMENT_CONFIRMED', $4)
    `, [applicationId, memberId, planId, applicationId]);
    
    await adminClient.query("SELECT activate_membership($1, $2)", [applicationId, adminId]);
    
    const mRes = await adminClient.query("SELECT status, allocated_credits FROM public.memberships WHERE member_id = $1", [memberId]);
    const membershipId = mRes.rows[0]?.id; // wait we don't have this, but let's just get it
    recordResult('RPC', 'activate_membership creates ACTIVE membership and credits', 'ACTIVE, 4', `${mRes.rows[0]?.status}, ${mRes.rows[0]?.allocated_credits}`, mRes.rows[0]?.status === 'ACTIVE' && mRes.rows[0]?.allocated_credits == 4);

    // Give some initial credits
    const ledger = await adminClient.query("SELECT * FROM public.membership_credit_ledger WHERE membership_id = (SELECT id FROM public.memberships WHERE member_id = $1)", [memberId]);
    recordResult('Ledger', 'activate_membership creates ledger row', '1 row', `${ledger.rowCount} row`, ledger.rowCount === 1);

    // 2. Booking negative transitions
    const bookingId = uuid();
    const bRes = await adminClient.query("SELECT create_member_booking($1, $2, $3::jsonb, $1)", [memberId, slotId, `[{"member_id":"${memberId}", "type": "MEMBER"}]`]);
    const actualBookingId = bRes.rows[0].create_member_booking;

    // Approve booking
    await adminClient.query("SELECT approve_booking($1, $2)", [actualBookingId, adminId]);
    
    // Try to approve again
    try {
      await adminClient.query("SELECT approve_booking($1, $2)", [actualBookingId, adminId]);
      recordResult('Negative State', 'Cannot approve already confirmed booking', 'Error', 'Success', false);
    } catch (e) {
      recordResult('Negative State', 'Cannot approve already confirmed booking', 'Error', 'Error', true);
    }

    // Reject booking (it's CONFIRMED, should fail to reject)
    try {
      await adminClient.query("SELECT reject_booking($1, 'reason', $2)", [actualBookingId, adminId]);
      recordResult('Negative State', 'Cannot reject confirmed booking', 'Error', 'Success', false);
    } catch (e) {
      recordResult('Negative State', 'Cannot reject confirmed booking', 'Error', 'Error', true);
    }

    // Cancel booking
    await adminClient.query("SELECT cancel_booking($1, $2, 'BBS', 'reason')", [actualBookingId, adminId]);

    // Try to approve cancelled
    try {
      await adminClient.query("SELECT approve_booking($1, $2)", [actualBookingId, adminId]);
      recordResult('Negative State', 'Cannot approve cancelled booking', 'Error', 'Success', false);
    } catch (e) {
      recordResult('Negative State', 'Cannot approve cancelled booking', 'Error', 'Error', true);
    }

    // Try to cancel already cancelled
    try {
      await adminClient.query("SELECT cancel_booking($1, $2, 'BBS', 'reason')", [actualBookingId, adminId]);
      recordResult('Negative State', 'Cannot cancel already cancelled booking', 'Error', 'Success', false);
    } catch (e) {
      recordResult('Negative State', 'Cannot cancel already cancelled booking', 'Error', 'Error', true);
    }

    // Reject Reschedule
    // Create new booking for reschedule test
    const b2Res = await adminClient.query("SELECT create_member_booking($1, $2, $3::jsonb, $1)", [memberId, slotId, `[{"member_id":"${memberId}", "type": "MEMBER"}]`]);
    const b2Id = b2Res.rows[0].create_member_booking;
    await adminClient.query("SELECT approve_booking($1, $2)", [b2Id, adminId]);

    const newSlotId = uuid();
    await adminClient.query("INSERT INTO public.session_slots (id, slot_date, start_time, end_time, capacity, block) VALUES ($1, CURRENT_DATE + interval '2 days', '10:00', '11:00', 1, 'MORNING')", [newSlotId]);
    await adminClient.query("SELECT request_reschedule($1, $2, $3, $3)", [b2Id, newSlotId, memberId]);
    
    await adminClient.query("SELECT reject_reschedule($1, $2, 'reason')", [b2Id, adminId]);
    
    const rRes = await adminClient.query("SELECT status, requested_slot_id FROM public.bookings WHERE id = $1", [b2Id]);
    recordResult('RPC', 'reject_reschedule reverts to CONFIRMED', 'CONFIRMED, null', `${rRes.rows[0].status}, ${rRes.rows[0].requested_slot_id}`, rRes.rows[0].status === 'CONFIRMED' && rRes.rows[0].requested_slot_id === null);

    // Try to approve reschedule when it's not requested
    try {
      await adminClient.query("SELECT approve_reschedule($1, $2)", [b2Id, adminId]);
      recordResult('Negative State', 'Cannot approve unrequested reschedule', 'Error', 'Success', false);
    } catch (e) {
      recordResult('Negative State', 'Cannot approve unrequested reschedule', 'Error', 'Error', true);
    }

    // Outbox check
    const outbox = await adminClient.query("SELECT event_type FROM public.notification_outbox WHERE recipient_user_id = $1", [memberId]);
    const events = outbox.rows.map(r => r.event_type);
    recordResult('Outbox', 'Outbox has events', 'Events exist', events.join(', '), events.length > 0);

    // Credit Ledger check
    const mResForId = await adminClient.query("SELECT id FROM public.memberships WHERE member_id = $1 LIMIT 1", [memberId]);
    const memId = mResForId.rows[0].id;
    const creditState = await adminClient.query("SELECT * FROM public.membership_credit_state($1)", [memId]);
    const state = creditState.rows[0];
    recordResult('Ledger', 'Credit state matches', '4', state.allocated, state.allocated == 4);
    
    fs.writeFileSync('tests/reports/phase5.2.1_part2_results.json', JSON.stringify(results, null, 2));
    console.log("Done.");

  } catch (e) {
    console.error("Test suite crashed:", e);
  } finally {
    await adminClient.end();
  }
}

runTests();
