import { Client } from 'pg';
import crypto from 'crypto';

const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
const results = {
  lifecycle: [],
  credit: [],
  negative: [],
  premium: [],
  cancellation: [],
  reschedule: [],
  horse: [],
  concurrency: [],
  auth: [],
  notification: []
};

function uuid() {
  return crypto.randomUUID();
}

async function runTest(category, name, testFn) {
  try {
    await testFn();
    results[category].push({ name, status: 'PASS' });
    console.log(`[PASS] [${category}] ${name}`);
  } catch (err) {
    results[category].push({ name, status: 'FAIL', error: err.message });
    console.error(`[FAIL] [${category}] ${name} - ${err.message}`);
  }
}

async function setupFixtures() {
  const ids = {
    adminId: uuid(),
    memberAId: uuid(),
    memberBId: uuid(),
    memberCId: uuid(), // Premium
    horseAId: uuid(),
    horseBId: uuid(),
    planBasicId: uuid(),
    planPremiumId: uuid(),
    slotAId: uuid(), // Available
    slotBId: uuid()  // Full
  };

  // Insert auth users
  const insertAuthUser = `INSERT INTO auth.users (id, instance_id, role, aud) VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')`;
  await client.query(insertAuthUser, [ids.adminId]);
  await client.query(insertAuthUser, [ids.memberAId]);
  await client.query(insertAuthUser, [ids.memberBId]);
  await client.query(insertAuthUser, [ids.memberCId]);

  // Insert public users
  const insertUser = `INSERT INTO public.users (id, email, role) VALUES ($1, $2, $3)`;
  await client.query(insertUser, [ids.adminId, `admin_${ids.adminId}@test.com`, 'ADMIN']);
  await client.query(insertUser, [ids.memberAId, `memberA_${ids.memberAId}@test.com`, 'MEMBER']);
  await client.query(insertUser, [ids.memberBId, `memberB_${ids.memberBId}@test.com`, 'MEMBER']);
  await client.query(insertUser, [ids.memberCId, `memberC_${ids.memberCId}@test.com`, 'MEMBER']);

  // Insert members
  const insertMember = `INSERT INTO public.members (id, user_id, full_name, phone) VALUES ($1, $1, 'Test Member', $2) RETURNING id`;
  await client.query(insertMember, [ids.memberAId, ids.memberAId.slice(0, 15)]);
  await client.query(insertMember, [ids.memberBId, ids.memberBId.slice(0, 15)]);
  await client.query(insertMember, [ids.memberCId, ids.memberCId.slice(0, 15)]);

  // Insert plans
  const insertPlan = `INSERT INTO public.membership_plans (id, code, name, price_idr, credits, duration_months) VALUES ($1, $2, $3, $4, $5, $6)`;
  await client.query(insertPlan, [ids.planBasicId, `B_${ids.planBasicId.substring(0, 5)}`, 'Basic Plan', 100000, 4, 1]);
  await client.query(insertPlan, [ids.planPremiumId, `G_${ids.planPremiumId.substring(0, 5)}`, 'Premium Plan', 200000, 8, 1]);

  // Insert memberships
  const insertMembership = `
    INSERT INTO public.memberships (id, member_id, plan_id, status, start_date, end_date, allocated_credits) 
    VALUES ($1, $2, $3, 'ACTIVE', CURRENT_DATE, CURRENT_DATE + interval '30 days', $4)`;
  const membershipAId = uuid();
  const membershipBId = uuid(); // Will have no credits
  const membershipCId = uuid(); // Premium
  await client.query(insertMembership, [membershipAId, ids.memberAId, ids.planBasicId, 4]);
  await client.query(insertMembership, [membershipBId, ids.memberBId, ids.planBasicId, 0]);
  await client.query(insertMembership, [membershipCId, ids.memberCId, ids.planPremiumId, 8]);
  
  // Give credits via ledger
  const insertLedger = `
    INSERT INTO public.membership_credit_ledger (membership_id, member_id, txn_type, delta_allocated, reason, actor_id)
    VALUES ($1, $2, 'MEMBERSHIP_ALLOCATION', $3, 'Initial setup', $4)
  `;
  await client.query(insertLedger, [membershipAId, ids.memberAId, 4, ids.adminId]); // A has 4 credits
  await client.query(insertLedger, [membershipCId, ids.memberCId, 8, ids.adminId]); // C has 8 credits
  // B gets 0 credits

  // Horses
  const insertHorse = `INSERT INTO public.horses (id, name, status) VALUES ($1, $2, 'ACTIVE')`;
  await client.query(insertHorse, [ids.horseAId, 'Horse A']);
  await client.query(insertHorse, [ids.horseBId, 'Horse B']);

  // Slots
  const insertSlot = `INSERT INTO public.session_slots (id, slot_date, start_time, end_time, block, capacity) VALUES ($1, $2, $3, $4, $5, $6)`;
  await client.query(insertSlot, [ids.slotAId, '2027-01-01', '08:00', '09:00', 'MORNING', 5]);
  await client.query(insertSlot, [ids.slotBId, '2027-01-01', '09:00', '10:00', 'MORNING', 1]); // Full capacity is 1, so 1 booking fills it

  ids.membershipAId = membershipAId;
  ids.membershipBId = membershipBId;
  ids.membershipCId = membershipCId;
  
  return ids;
}

async function main() {
  await client.connect();
  console.log('Connected. Setting up fixtures...');
  const f = await setupFixtures();
  console.log('Fixtures set up.');
  
  await runTest('lifecycle', 'Booking creation to attendance', async () => {
    // 1. Create booking
    const participants = JSON.stringify([{ type: 'MEMBER', memberId: f.memberAId }]);
    const res = await client.query('SELECT create_member_booking($1, $2, $3, $4) as booking_id', 
      [f.memberAId, f.slotAId, participants, f.memberAId]
    );
    const bookingId = res.rows[0].booking_id;
    if (!bookingId) throw new Error('No booking ID returned');

    // 2. Check credit state
    const cState = await client.query('SELECT * FROM membership_credit_state($1)', [f.membershipAId]);
    if (cState.rows[0].reserved !== 1) throw new Error('Credit not reserved');

    // 3. Approve booking
    await client.query('SELECT approve_booking($1, $2)', [bookingId, f.adminId]);
    const bState = await client.query('SELECT status FROM bookings WHERE id = $1', [bookingId]);
    if (bState.rows[0].status !== 'CONFIRMED') throw new Error('Booking not confirmed');

    // 4. Resolve attendance
    const pRes = await client.query('SELECT id FROM booking_participants WHERE booking_id = $1 LIMIT 1', [bookingId]);
    await client.query('SELECT resolve_attendance($1, $2, $3, $4, $5)', [pRes.rows[0].id, 'PRESENT', 'CONSUME', 'Attended', f.adminId]);
    
    // 5. Check credit consumed
    const cStateFinal = await client.query('SELECT * FROM membership_credit_state($1)', [f.membershipAId]);
    if (cStateFinal.rows[0].consumed !== 1) throw new Error('Credit not consumed');
  });

  await client.end();
  // console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
