# BBS PHASE 4.6 — SQL EDITOR READ-ONLY VERIFICATION PACKAGE (UNIFIED)

## 1. Why this happened
Supabase SQL Editor default behavior is to only return the result of the *last* statement executed when you run a batch of queries. That's why you only saw the `INDEX` results.

To fix this, I have combined all the forensic checks (RLS, Columns, Constraints, and Functions) into **ONE SINGLE QUERY** using JSON aggregation.

## 2. Exact SQL Verification Block
Copy the entire block below and run it in the SQL Editor. It will output a single column called `unified_forensic_report` containing all the data in JSON format.

```sql
-- =========================================================
-- READ-ONLY FORENSIC VERIFICATION SCRIPT (UNIFIED)
-- DO NOT MODIFY DATABASE. SELECT ONLY.
-- =========================================================

WITH rls AS (
  SELECT json_agg(jsonb_build_object(
    'tablename', tablename,
    'policyname', policyname,
    'roles', roles,
    'cmd', cmd,
    'qual', qual,
    'with_check', with_check
  )) as data
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('membership_applications', 'riding_requests')
),
columns_info AS (
  SELECT json_agg(jsonb_build_object(
    'table_name', table_name,
    'column_name', column_name,
    'data_type', data_type,
    'column_default', column_default
  )) as data
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name IN ('riding_requests', 'membership_applications', 'booking_participants', 'site_settings', 'members')
),
constraints_info AS (
  SELECT json_agg(jsonb_build_object(
    'table_name', rel.relname,
    'constraint_name', con.conname,
    'definition', pg_get_constraintdef(con.oid)
  )) as data
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = con.connamespace
  WHERE nsp.nspname = 'public' AND rel.relname IN ('booking_participants', 'riding_requests') AND con.contype = 'c'
),
functions_info AS (
  SELECT json_agg(jsonb_build_object(
    'function_name', p.proname,
    'arguments', pg_catalog.pg_get_function_arguments(p.oid),
    'is_security_definer', p.prosecdef,
    'full_definition', pg_catalog.pg_get_functiondef(p.oid)
  )) as data
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' 
  AND p.proname IN (
    'approve_riding_request', 'create_member_booking', 'membership_credit_state', 'cancel_booking', 
    'request_reschedule', 'approve_reschedule', 'reject_reschedule', 'resolve_attendance', 
    'assign_horse', 'reject_booking', 'activate_membership', 'activate_pending_memberships'
  )
)
SELECT jsonb_build_object(
  'RLS', (SELECT data FROM rls),
  'COLUMNS', (SELECT data FROM columns_info),
  'CONSTRAINTS', (SELECT data FROM constraints_info),
  'FUNCTIONS', (SELECT data FROM functions_info)
) AS unified_forensic_report;
```

---

## 3. How to extract the result
1. Run the query.
2. Click on the cell under `unified_forensic_report`.
3. Copy the entire JSON object.
4. Paste it back into this chat. (It will contain everything we need to verify Phase 4.6).
