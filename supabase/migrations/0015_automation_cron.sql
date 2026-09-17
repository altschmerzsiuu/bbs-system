-- 0015_automation_cron.sql

-- 1. Fix expire_memberships to use Asia/Jakarta timezone
create or replace function expire_memberships() returns int
language plpgsql security definer set search_path = public as $$
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

-- 2. Create activate_pending_memberships with strict defense
create or replace function activate_pending_memberships() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m record; 
  v_activated int := 0;
  v_skipped int := 0;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
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

-- 3. Create daily_maintenance to enforce strict ordering
create or replace function daily_maintenance() returns jsonb
language plpgsql security definer set search_path = public as $$
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

-- 4. Enable pg_cron and schedule jobs (Idempotent and Strict)
create extension if not exists pg_cron;

-- Unschedule just in case it was previously scheduled with a different ID to ensure true idempotency
select cron.unschedule('expire-pending-bookings');
select cron.unschedule('daily-maintenance');

-- Schedule pending booking expiration every minute
select cron.schedule(
  'expire-pending-bookings',
  '* * * * *',
  'select expire_pending_bookings();'
);

-- Schedule daily maintenance at 00:01 WIB (UTC+7) -> 17:01 UTC
select cron.schedule(
  'daily-maintenance',
  '1 17 * * *',
  'select daily_maintenance();'
);
