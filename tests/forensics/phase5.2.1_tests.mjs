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
    // 1. Setup Identities
    console.log("Setting up identities...");
    const adminId = uuid();
    const memberAId = uuid();
    const memberBId = uuid();
    const groomerId = uuid();
    const unauthId = uuid();
    
    await adminClient.query("INSERT INTO auth.users (id, role) VALUES ($1, 'authenticated'), ($2, 'authenticated'), ($3, 'authenticated'), ($4, 'authenticated'), ($5, 'anon')", [adminId, memberAId, memberBId, groomerId, unauthId]);
    await adminClient.query("INSERT INTO public.users (id, email, role) VALUES ($1, $5, 'ADMIN'), ($2, $6, 'MEMBER'), ($3, $7, 'MEMBER'), ($4, $8, 'GROOMER')", [adminId, memberAId, memberBId, groomerId, `admin_${adminId}@test.com`, `a_${memberAId}@test.com`, `b_${memberBId}@test.com`, `groomer_${groomerId}@test.com`]);
    
    await adminClient.query("INSERT INTO public.members (id, user_id, full_name, phone) VALUES ($1, $1, 'Member A', '123'), ($2, $2, 'Member B', '456')", [memberAId, memberBId]);

    // Create role-specific clients
    const createClientForUser = async (userId, role = 'authenticated') => {
      const c = new Client({ connectionString: DB_URL });
      await c.connect();
      // Emulate Supabase auth
      await c.query(`
        set role ${role};
        select set_config('request.jwt.claims', json_build_object('sub', '${userId}', 'role', '${role}')::text, false);
      `);
      return c;
    };

    const clientA = await createClientForUser(memberAId);
    const clientB = await createClientForUser(memberBId);
    const clientAdmin = await createClientForUser(adminId);
    const clientGroomer = await createClientForUser(groomerId);
    const clientUnauth = await createClientForUser(unauthId, 'anon');

    // ---------------------------------------------------------
    // STEP 3: AUTHORIZATION / RLS
    // ---------------------------------------------------------
    console.log("Testing RLS...");
    
    // A. Member A cannot read Member B's private data
    try {
      const res = await clientA.query("SELECT * FROM public.members WHERE id = $1", [memberBId]);
      recordResult('RLS', 'Member A cannot read Member B', '0 rows', `${res.rowCount} rows`, res.rowCount === 0);
    } catch(e) {
      recordResult('RLS', 'Member A cannot read Member B', '0 rows or error', `Error: ${e.message}`, true);
    }

    // B. Member cannot perform admin-only operations (e.g. inserting slots)
    try {
      await clientA.query("INSERT INTO public.session_slots (id, slot_date, start_time, end_time, capacity, block) VALUES ($1, CURRENT_DATE, '18:00', '19:00', 1, 'AFTERNOON')", [uuid()]);
      recordResult('RLS', 'Member cannot insert slot', 'Error', 'Success', false);
    } catch (e) {
      recordResult('RLS', 'Member cannot insert slot', 'Error', 'Error', true);
    }
    
    // C. Groomer cannot perform admin-only operations
    try {
      await clientGroomer.query("INSERT INTO public.session_slots (id, slot_date, start_time, end_time, capacity, block) VALUES ($1, CURRENT_DATE, '18:00', '19:00', 1, 'AFTERNOON')", [uuid()]);
      recordResult('RLS', 'Groomer cannot insert slot', 'Error', 'Success', false);
    } catch (e) {
      recordResult('RLS', 'Groomer cannot insert slot', 'Error', 'Error', true);
    }

    // D. Admin can perform admin operations
    try {
      await clientAdmin.query("INSERT INTO public.session_slots (id, slot_date, start_time, end_time, capacity, block) VALUES ($1, CURRENT_DATE, '18:00', '19:00', 1, 'AFTERNOON')", [uuid()]);
      recordResult('RLS', 'Admin can insert slot', 'Success', 'Success', true);
    } catch (e) {
      recordResult('RLS', 'Admin can insert slot', 'Success', `Error: ${e.message}`, false);
    }

    // E. Unauthorized actor cannot manipulate another member's booking
    try {
      await clientUnauth.query("UPDATE public.bookings SET status = 'CANCELLED'");
      recordResult('RLS', 'Anon cannot update bookings', 'Error or 0 rows', 'Success', false);
    } catch (e) {
      recordResult('RLS', 'Anon cannot update bookings', 'Error or 0 rows', 'Error', true);
    }

    // F. SECURITY DEFINER RPC checks (approve_booking)
    try {
      await clientA.query("SELECT approve_booking($1, $2)", [uuid(), memberAId]);
      recordResult('RPC Security', 'Member cannot approve booking', 'Error', 'Success', false);
    } catch (e) {
      recordResult('RPC Security', 'Member cannot approve booking', 'Error', 'Error', true, e.message);
    }

    await clientA.end();
    await clientB.end();
    await clientAdmin.end();
    await clientGroomer.end();
    await clientUnauth.end();

    fs.writeFileSync('tests/reports/phase5.2.1_results.json', JSON.stringify(results, null, 2));
    console.log("Done.");

  } catch (e) {
    console.error("Test suite crashed:", e);
  } finally {
    await adminClient.end();
  }
}

runTests();
