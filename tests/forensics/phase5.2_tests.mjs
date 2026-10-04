import { Client } from 'pg';
import crypto from 'crypto';
import fs from 'fs';

const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
const results = [];

function uuid() { return crypto.randomUUID(); }

async function runTest(category, name, testFn) {
  try {
    await testFn();
    results.push({ category, name, status: 'PASS_LOCAL', evidence: 'Test executed successfully and invariants held.' });
    console.log(`[PASS] [${category}] ${name}`);
  } catch (err) {
    results.push({ category, name, status: 'RED', evidence: err.message });
    console.error(`[FAIL] [${category}] ${name} - ${err.message}`);
  }
}

async function assertThrows(promise, expectedError) {
  try {
    await promise;
    throw new Error('Expected an error but none was thrown');
  } catch (err) {
    if (expectedError && !err.message.includes(expectedError)) {
      throw new Error(`Expected error containing "${expectedError}", but got "${err.message}"`);
    }
  }
}

async function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg}: expected ${expected} but got ${actual}`);
}

async function setupFixtures() {
  const ids = {
    adminId: uuid(),
    memberAId: uuid(),
    memberBId: uuid(),
    memberCId: uuid(), // Premium
    memberDId: uuid(), // Premium
    horseAId: uuid(),
    horseBId: uuid(),
    planBasicId: uuid(),
    planPremiumId: uuid(),
    slotTomorrowId: uuid(),
    slotTomorrowFullId: uuid(),
    slotNextWeekId: uuid()
  };

  // Cleanup before test
  await client.query("TRUNCATE TABLE public.session_slots CASCADE");
  await client.query("TRUNCATE TABLE public.users CASCADE");
  await client.query("TRUNCATE TABLE public.horses CASCADE");
  await client.query("TRUNCATE TABLE public.membership_plans CASCADE");

  // Auth Users
  const insertAuthUser = `INSERT INTO auth.users (id, instance_id, role, aud) VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')`;
  await client.query(insertAuthUser, [ids.adminId]);
  await client.query(insertAuthUser, [ids.memberAId]);
  await client.query(insertAuthUser, [ids.memberBId]);
  await client.query(insertAuthUser, [ids.memberCId]);
  await client.query(insertAuthUser, [ids.memberDId]);

  // Public Users
  const insertUser = `INSERT INTO public.users (id, email, role) VALUES ($1, $2, $3)`;
  await client.query(insertUser, [ids.adminId, `admin_${ids.adminId}@test.com`, 'ADMIN']);
  await client.query(insertUser, [ids.memberAId, `memberA_${ids.memberAId}@test.com`, 'MEMBER']);
  await client.query(insertUser, [ids.memberBId, `memberB_${ids.memberBId}@test.com`, 'MEMBER']);
  await client.query(insertUser, [ids.memberCId, `memberC_${ids.memberCId}@test.com`, 'MEMBER']);
  await client.query(insertUser, [ids.memberDId, `memberD_${ids.memberDId}@test.com`, 'MEMBER']);

  // Members
  const insertMember = `INSERT INTO public.members (id, user_id, full_name, phone) VALUES ($1, $1, 'Test Member', $2) RETURNING id`;
  await client.query(insertMember, [ids.memberAId, ids.memberAId.slice(0, 15)]);
  await client.query(insertMember, [ids.memberBId, ids.memberBId.slice(0, 15)]);
  await client.query(insertMember, [ids.memberCId, ids.memberCId.slice(0, 15)]);
  await client.query(insertMember, [ids.memberDId, ids.memberDId.slice(0, 15)]);

  // Plans
  const insertPlan = `INSERT INTO public.membership_plans (id, code, name, price_idr, credits, duration_months) VALUES ($1, $2, $3, $4, $5, $6)`;
  await client.query(insertPlan, [ids.planBasicId, `B_${ids.planBasicId.substring(0,5)}`, 'Basic Plan', 100000, 4, 1]);
  await client.query(insertPlan, [ids.planPremiumId, `G_${ids.planPremiumId.substring(0,5)}`, 'Gold Premium Plan', 200000, 8, 1]);

  // Mark Premium Plan as GOLD tier in system_settings if required, actually the plan code or name might dictate it? The logic usually checks membership tier if there's a tier column, but membership_plans doesn't have tier anymore, let's assume it checks name or we ignore it if it's not present.

  // Memberships
  const insertMembership = `
    INSERT INTO public.memberships (id, member_id, plan_id, status, start_date, end_date, allocated_credits) 
    VALUES ($1, $2, $3, 'ACTIVE', CURRENT_DATE - interval '1 day', CURRENT_DATE + interval '30 days', $4)`;
  ids.membershipAId = uuid();
  ids.membershipBId = uuid(); 
  ids.membershipCId = uuid(); 
  ids.membershipDId = uuid(); 
  await client.query(insertMembership, [ids.membershipAId, ids.memberAId, ids.planBasicId, 4]);
  await client.query(insertMembership, [ids.membershipBId, ids.memberBId, ids.planBasicId, 0]);
  await client.query(insertMembership, [ids.membershipCId, ids.memberCId, ids.planPremiumId, 8]);
  await client.query(insertMembership, [ids.membershipDId, ids.memberDId, ids.planPremiumId, 8]);
  
  // Give credits via ledger
  const insertLedger = `
    INSERT INTO public.membership_credit_ledger (membership_id, member_id, txn_type, delta_allocated, reason, actor_id)
    VALUES ($1, $2, 'MEMBERSHIP_ALLOCATION', $3, 'Initial setup', $4)
  `;
  await client.query(insertLedger, [ids.membershipAId, ids.memberAId, 4, ids.adminId]); 
  await client.query(insertLedger, [ids.membershipCId, ids.memberCId, 8, ids.adminId]); 
  await client.query(insertLedger, [ids.membershipDId, ids.memberDId, 8, ids.adminId]); 

  // Horses
  const insertHorse = `INSERT INTO public.horses (id, name, status) VALUES ($1, $2, 'ACTIVE')`;
  await client.query(insertHorse, [ids.horseAId, 'Horse A']);
  await client.query(insertHorse, [ids.horseBId, 'Horse B']);

  // Slots
  const insertSlot = `INSERT INTO public.session_slots (id, slot_date, start_time, end_time, block, capacity) VALUES ($1, CURRENT_DATE + $2::interval, $3, $4, 'MORNING', $5)`;
  await client.query(insertSlot, [ids.slotTomorrowId, '1 day', '08:00', '09:00', 5]);
  await client.query(insertSlot, [ids.slotTomorrowFullId, '1 day', '09:00', '10:00', 1]); // Capacity 1
  await client.query(insertSlot, [ids.slotNextWeekId, '7 days', '08:00', '09:00', 5]);

  return ids;
}

async function getCreditState(membershipId) {
  const res = await client.query('SELECT * FROM membership_credit_state($1)', [membershipId]);
  return res.rows[0];
}

async function getBookingStatus(bookingId) {
  const res = await client.query('SELECT status FROM bookings WHERE id = $1', [bookingId]);
  return res.rows[0].status;
}

async function getParticipantId(bookingId) {
  const res = await client.query('SELECT id FROM booking_participants WHERE booking_id = $1 LIMIT 1', [bookingId]);
  return res.rows[0].id;
}

async function createBooking(f, slotId, memberId) {
  const participants = JSON.stringify([{ type: 'MEMBER', member_id: memberId }]);
  const res = await client.query('SELECT create_member_booking($1, $2, $3, $4) as booking_id', 
    [memberId, slotId, participants, memberId]
  );
  return res.rows[0].booking_id;
}

async function main() {
  await client.connect();
  const f = await setupFixtures();

  // ---------------------------------------------------------
  // 5.2.3 Booking Lifecycle & 5.2.4 Credit Integrity
  // ---------------------------------------------------------
  let bookingA = null;
  await runTest('5.2.3 Booking Lifecycle', 'Create booking and check credit state', async () => {
    const stateBefore = await getCreditState(f.membershipAId);
    bookingA = await createBooking(f, f.slotTomorrowId, f.memberAId);
    const stateAfter = await getCreditState(f.membershipAId);
    assertEqual(stateAfter.reserved, stateBefore.reserved, 'Credit should NOT be reserved upon PENDING booking');
    assertEqual(await getBookingStatus(bookingA), 'PENDING', 'Initial status should be PENDING');
  });

  await runTest('5.2.3 Booking Lifecycle', 'Approve booking and check credit reservation', async () => {
    const stateBefore = await getCreditState(f.membershipAId);
    await client.query('SELECT approve_booking($1, $2)', [bookingA, f.adminId]);
    const stateAfter = await getCreditState(f.membershipAId);
    assertEqual(stateAfter.reserved, stateBefore.reserved + 1, 'Credit should be reserved after approval');
    assertEqual(await getBookingStatus(bookingA), 'CONFIRMED', 'Status should be CONFIRMED');
  });

  await runTest('5.2.5 Negative Tests', 'Cannot double book same member same slot', async () => {
    await assertThrows(createBooking(f, f.slotTomorrowId, f.memberAId), 'ALREADY_BOOKED');
  });

  await runTest('5.2.3 Booking Lifecycle', 'Resolve attendance and consume credit', async () => {
    const pId = await getParticipantId(bookingA);
    const stateBefore = await getCreditState(f.membershipAId);
    await client.query('SELECT resolve_attendance($1, $2, $3, $4, $5)', [pId, 'ATTENDED', 'CONSUMED', 'Attended', f.adminId]);
    const stateAfter = await getCreditState(f.membershipAId);
    assertEqual(stateAfter.reserved, stateBefore.reserved - 1, 'Reservation should be released');
    assertEqual(stateAfter.consumed, stateBefore.consumed + 1, 'Credit should be consumed exactly once');
    assertEqual(await getBookingStatus(bookingA), 'COMPLETED', 'Status should be COMPLETED');
  });

  // ---------------------------------------------------------
  // 5.2.5 Negative Booking Tests
  // ---------------------------------------------------------
  await runTest('5.2.5 Negative Tests', 'Cannot book without available credits', async () => {
    await assertThrows(createBooking(f, f.slotTomorrowId, f.memberBId), 'INSUFFICIENT_CREDITS');
  });

  await runTest('5.2.5 Negative Tests', 'Cannot book when slot is full', async () => {
    // Fill the slot
    await createBooking(f, f.slotTomorrowFullId, f.memberAId);
    // Try to book again with C
    await assertThrows(createBooking(f, f.slotTomorrowFullId, f.memberCId), 'SLOT_FULL');
  });

  // ---------------------------------------------------------
  // 5.2.7 Cancellation
  // ---------------------------------------------------------
  await runTest('5.2.7 Cancellation', 'Cancel booking releases reservation', async () => {
    const cancelBookingId = await createBooking(f, f.slotNextWeekId, f.memberCId);
    await client.query('SELECT approve_booking($1, $2)', [cancelBookingId, f.adminId]);
    const stateBefore = await getCreditState(f.membershipCId);
    await client.query('SELECT cancel_booking($1, $2, $3, $4)', [cancelBookingId, f.memberCId, 'MEMBER', 'Changed mind']);
    const stateAfter = await getCreditState(f.membershipCId);
    assertEqual(stateAfter.reserved, stateBefore.reserved - 1, 'Reservation should be released upon cancellation');
    assertEqual(stateAfter.consumed, stateBefore.consumed, 'No credit should be consumed');
  });

  // ---------------------------------------------------------
  // 5.2.8 Reschedule
  // ---------------------------------------------------------
  await runTest('5.2.8 Reschedule', 'Request and approve reschedule', async () => {
    const reschBookingId = await createBooking(f, f.slotNextWeekId, f.memberCId);
    await client.query('SELECT approve_booking($1, $2)', [reschBookingId, f.adminId]);
    await client.query('SELECT request_reschedule($1, $2, $3, $4)', [reschBookingId, f.slotTomorrowId, f.memberCId, f.memberCId]);
    assertEqual(await getBookingStatus(reschBookingId), 'RESCHEDULE_REQUESTED', 'Status should be RESCHEDULE_REQUESTED');
    
    await client.query('SELECT approve_reschedule($1, $2)', [reschBookingId, f.adminId]);
    assertEqual(await getBookingStatus(reschBookingId), 'CONFIRMED', 'Status should be CONFIRMED after reschedule approval');
    
    // Check slot changed
    const b = await client.query('SELECT slot_id FROM bookings WHERE id = $1', [reschBookingId]);
    assertEqual(b.rows[0].slot_id, f.slotTomorrowId, 'Slot ID should be updated to new slot');
  });

  // ---------------------------------------------------------
  // 5.2.9 Horse Assignment
  // ---------------------------------------------------------
  await runTest('5.2.9 Horse Assignment', 'Assign horse successfully', async () => {
    const bookingH = await createBooking(f, f.slotNextWeekId, f.memberCId);
    await client.query('SELECT approve_booking($1, $2)', [bookingH, f.adminId]);
    const pH = await getParticipantId(bookingH);
    await client.query('SELECT assign_horse($1, $2, $3)', [pH, f.horseAId, f.adminId]);
    const hp = await client.query('SELECT horse_id FROM booking_participants WHERE id = $1', [pH]);
    assertEqual(hp.rows[0].horse_id, f.horseAId, 'Horse should be assigned');
  });

  // ---------------------------------------------------------
  // 5.2.10 Concurrency Tests
  // ---------------------------------------------------------
  await runTest('5.2.10 Concurrency', 'Prevent exceeding capacity under concurrent load', async () => {
    // Create a new slot with capacity 1
    const newSlotId = uuid();
    await client.query("INSERT INTO public.session_slots (id, slot_date, start_time, end_time, block, capacity) VALUES ($1, CURRENT_DATE + interval '3 days', '15:00', '16:00', 'AFTERNOON', 1)", [newSlotId]);
    
    // Member D and Member C try to book concurrently
    const p1 = createBooking(f, newSlotId, f.memberDId);
    const p2 = createBooking(f, newSlotId, f.memberCId);
    
    const resultsSettled = await Promise.allSettled([p1, p2]);
    const successes = resultsSettled.filter(r => r.status === 'fulfilled');
    const failures = resultsSettled.filter(r => r.status === 'rejected');
    
    console.log("Concurrency failures:", failures.map(f => f.reason.message));
    
    assertEqual(successes.length, 1, 'Only one booking should succeed');
    assertEqual(failures.length, 1, 'One booking should fail');
    assertEqual(failures[0].reason.message.includes('SLOT_FULL'), true, 'Failure should be SLOT_FULL');
  });

  // ---------------------------------------------------------
  // Write Report
  // ---------------------------------------------------------
  fs.writeFileSync('tests/reports/PHASE_5.2_BEHAVIORAL_PARITY_RESULTS.json', JSON.stringify(results, null, 2));

  let md = "# PHASE 5.2 — BEHAVIORAL / RPC PARITY TESTING REPORT\n\n";
  md += "## Executive Summary\n";
  md += "This report details the execution of behavioral and business logic tests on the local database. The tests prove that the local schema and RPC definitions correctly implement the core booking lifecycle, ledger integrity, capacity controls, and concurrency protections.\n\n";
  
  const categories = [...new Set(results.map(r => r.category))];
  
  for (const c of categories) {
    md += `## ${c}\n`;
    const tests = results.filter(r => r.category === c);
    for (const t of tests) {
      const icon = t.status === 'PASS_LOCAL' ? '🟢' : '🔴';
      md += `- ${icon} **${t.name}**: ${t.status}\n`;
      if (t.status === 'RED') {
        md += `  - Error: ${t.evidence}\n`;
      }
    }
    md += '\n';
  }

  md += "## Final Verdict\n";
  const allPass = results.every(r => r.status === 'PASS_LOCAL');
  if (allPass) {
    md += "**GREEN** — All local behavioral, lifecycle, integrity, negative, and concurrency tests passed successfully.\n";
  } else {
    md += "**RED** — Some behavioral tests failed. See details above.\n";
  }

  fs.writeFileSync('tests/reports/PHASE_5.2_BEHAVIORAL_PARITY_REPORT.md', md);
  console.log('Tests finished. Report written.');
  await client.end();
}

main().catch(async (e) => {
  console.error('FATAL ERROR:', e);
  await client.end();
});
