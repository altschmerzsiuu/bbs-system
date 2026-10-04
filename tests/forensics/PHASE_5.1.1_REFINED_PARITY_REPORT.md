# PHASE 5.1.1 — REFINED SCHEMA PARITY REPORT

## Executive Summary
This report refines the schema parity audit to exclude PostgreSQL system/extension objects and correctly categorizes missing production evidence as `UNKNOWN / PRODUCTION EVIDENCE MISSING` rather than `POTENTIAL DRIFT`.

## Confirmed Matches
Matches found: 77 objects (Functions, Columns, Constraints, RLS).

## Confirmed Differences
None

## Unknown Production Evidence
566 objects are present in our local repository migrations but absent from the physical production dump evidence (likely due to incomplete forensic extraction).

## Expected System Objects
0 internal/extension PostgreSQL functions (e.g. `gbt_*`, `uuid_*`) were ignored from application drift analysis.

## Application Risks (Potential Application Drift)
These objects exist in production but NOT in our local migrations.
- **booking_participants.cancellation_reason**: Local (MISSING) | Prod (EXISTS) -> POTENTIAL APPLICATION DRIFT
- **booking_participants.cancelled_at**: Local (MISSING) | Prod (EXISTS) -> POTENTIAL APPLICATION DRIFT
- **booking_participants.requested_slot_id**: Local (MISSING) | Prod (EXISTS) -> POTENTIAL APPLICATION DRIFT
- **booking_participants.attendance_status**: Local (MISSING) | Prod (EXISTS) -> POTENTIAL APPLICATION DRIFT
- **booking_participants.checked_in_at**: Local (MISSING) | Prod (EXISTS) -> POTENTIAL APPLICATION DRIFT
- **booking_participants.checked_in_by**: Local (MISSING) | Prod (EXISTS) -> POTENTIAL APPLICATION DRIFT
- **booking_participants.check_in_method**: Local (MISSING) | Prod (EXISTS) -> POTENTIAL APPLICATION DRIFT

## `booking_participants` Investigation
Investigation of suspicious columns:
- `cancellation_reason`
- `cancelled_at`
- `requested_slot_id`
- `attendance_status`
- `checked_in_at`
- `checked_in_by`
- `check_in_method`

**Verdict**: We searched all local migrations and confirmed that **none of these columns are created for the `booking_participants` table by any migration in our repository.** 
If they physically exist in production, they were likely added manually to the production database directly, or the production baseline JSON extracted them incorrectly from a view/join (e.g. they belong to `bookings` or `attendance_records`). They represent TRUE DRIFT or FALSE EVIDENCE. We must not remove them from local since they never existed locally.

## Final Verdict
**YELLOW** — evidence incomplete

While we resolved the false positives caused by incomplete production evidence and PostgreSQL extensions, the remaining `POTENTIAL APPLICATION DRIFT` (specifically the extra columns on `booking_participants`) requires either acknowledging them as manual production drift or acquiring a definitive production `pg_dump`.
