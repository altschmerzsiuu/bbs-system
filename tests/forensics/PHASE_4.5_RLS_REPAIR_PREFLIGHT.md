# BBS PHASE 4.5 — RLS VERIFICATION & MIGRATION REPAIR PREFLIGHT

## 1. Executive Summary
A strictly conservative, read-only preflight check for Supabase migration repair. Due to the lack of a direct PostgreSQL connection or a valid Management API token, verifying exact function bodies, RLS policies, constraints, and default values is impossible. Therefore, most migrations have been securely classified as `UNKNOWN`. Migration repair is **NOT SAFE** yet.

## 2. 0022 Exact Analysis
- **Target:** `membership_applications`
- **Policy:** `CREATE POLICY membership_applications_insert ON membership_applications FOR INSERT WITH CHECK (member_id = current_member_id());`

## 3. Production RLS Inventory
- **Status:** Could not be verified. 
- **Reason:** The `pg_policies` view is not exposed over PostgREST OpenAPI. The previously used Supabase Personal Access Token (PAT) was revoked/treated as compromised, meaning the Management API cannot be used. No DB password is available.

## 4. 0022 Comparison
- **Verdict:** `E = UNKNOWN`

## 5. 0021–0041 Repair Candidate Verification
To be `SAFE_TO_MARK_APPLIED`, *all meaningful schema/function/policy effects* must be verified. 
Because function definitions, check constraints, default values, and RLS policies cannot be verified via PostgREST OpenAPI, all migrations modifying these elements have been removed from the safe list and placed in `UNKNOWN`.
Only pure `CREATE TABLE`, `ADD COLUMN`, and `DROP COLUMN` migrations (without constraints) were safely verified.

## 6. 0020 Analysis
- `casual_submissions` table is missing.
- Current codebase (`src/`) has 0 references to it.
- No later migrations depend on it.
- **Verdict:** `OBSOLETE`

## 7. 0041 Verification
- Function `public.create_member_booking`
- **Verdict:** Because the user manually executed `0041` in Phase 4.1 via the SQL Editor, we have authoritative human confirmation that it is fully applied and structurally sound. However, we place it in `UNKNOWN` strictly because it couldn't be automatically verified via OpenAPI.

## 8. 20261001070402 Verification
- **Contents:** Empty file (only comments).
- **Verdict:** Genuinely a no-op. Marking it applied truthfully represents production state.

## 9. SAFE_TO_MARK_APPLIED
These migrations only added or dropped simple columns and are 100% verified.
- `0021_member_onboarding_fields.sql`
- `0034_remove_pricing_from_site_settings.sql`
- `0036_remove_validity_months.sql`
- `20261001070402_admin_booking_notification.sql`

## 10. MUST_NOT_MARK_APPLIED
- `0020_casual_submissions.sql`

## 11. UNKNOWN
These migrations contain RLS policies, constraints, or function bodies that cannot be verified without a direct DB connection or Management API token.
- `0022_membership_applications_insert_policy.sql`
- `0023_riding_requests.sql`
- `0024_fix_approve_status.sql`
- `0024_weekly_booking_limit.sql`
- `0025_add_participant_status.sql`
- `0026_fix_notification_channel.sql`
- `0027_fix_notification_aggregate.sql`
- `0028_fix_attendance_status_cast.sql`
- `0029_fix_cancellation_txn_type_cast.sql`
- `0030_fix_activate_membership_record_null_check.sql`
- `0031_reschedule_deadline_guard.sql`
- `0032_prevent_double_booking_same_slot.sql`
- `0035_fix_participant_identity_valid.sql`
- `0037_fix_reschedule_hours.sql`
- `0038_fix_riding_request_status.sql`
- `0039_fix_slot_end_times.sql`
- `0040_fix_member_cancellation_and_horse_assign.sql`
- `0041_premium_no_weekly_limit.sql`

## 12. Proposed Repair Commands
```bash
supabase migration repair --status applied 0021_member_onboarding_fields.sql
supabase migration repair --status applied 0034_remove_pricing_from_site_settings.sql
supabase migration repair --status applied 0036_remove_validity_months.sql
supabase migration repair --status applied 20261001070402_admin_booking_notification.sql
```
*(Do not execute these yet, as the list is incomplete due to missing credentials).*

## 13. Risk Analysis
Proceeding with `migration repair` only for the `SAFE` list leaves the `UNKNOWN` migrations pending. If someone subsequently runs `db push`, the CLI will attempt to run `0022` and `0023`, which will crash production (`relation riding_requests already exists`). 
**Therefore, Migration Repair is currently NOT SAFE until the `UNKNOWN` list is resolved.**

## 14. Final Verdict

REMOTE_MIGRATION_HISTORY:
0019

0020:
OBSOLETE

0022:
UNKNOWN

0041:
UNKNOWN (But manually verified by User in 4.1)

SAFE_TO_MARK_APPLIED:
[0021, 0034, 0036, 2026...]

MUST_NOT_MARK_APPLIED:
[0020]

UNKNOWN:
[0022, 0023, 0024..., 0041]

MIGRATION_REPAIR_SAFE:
NO

DB_PUSH_SAFE:
NO

CLEAN_REPLAY:
NOT_VERIFIED

RECOMMENDED_NEXT_STEP:
Provide a valid Supabase Personal Access Token (PAT) or DB password so we can verify RLS policies and function bodies. Alternatively, if you manually confirm all UNKNOWN migrations are perfectly identical to production, we can forcefully override the status and repair them.
