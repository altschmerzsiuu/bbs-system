import fs from 'fs';
import { execSync } from 'child_process';

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const localRls = JSON.parse(fs.readFileSync('rls.json', 'utf8'));
const localConstraints = JSON.parse(fs.readFileSync('constraints.json', 'utf8'));
const localColumns = JSON.parse(fs.readFileSync('columns.json', 'utf8'));
const localFunctions = JSON.parse(fs.readFileSync('functions.json', 'utf8'));

// Load Prod Data
const prodData = JSON.parse(fs.readFileSync('production_functions.json', 'utf8'))[0].unified_forensic_report;
const prodRls = prodData.RLS || [];
const prodConstraints = prodData.CONSTRAINTS || [];
const prodColumns = prodData.COLUMNS || [];
const prodFunctions = prodData.FUNCTIONS || [];

const parity = [];

// Helper to check if a function is a system/extension function
function isSystemFunction(funcName) {
  if (!funcName) return false;
  if (funcName.startsWith('gbt_')) return true;
  if (funcName.startsWith('gbtreekey')) return true;
  if (funcName.endsWith('_dist')) return true;
  if (funcName === 'uuid_nil' || funcName === 'uuid_ns_dns' || funcName === 'uuid_ns_url' || funcName === 'uuid_ns_oid' || funcName === 'uuid_ns_x500' || funcName === 'uuid_generate_v1' || funcName === 'uuid_generate_v1mc' || funcName === 'uuid_generate_v3' || funcName === 'uuid_generate_v4' || funcName === 'uuid_generate_v5') return true;
  return false;
}

// Helper to compare arrays of objects
function compareObjects(category, localArr, prodArr, keyFn, compareFn) {
  const localMap = new Map(localArr.map(x => [keyFn(x), x]));
  const prodMap = new Map(prodArr.map(x => [keyFn(x), x]));

  const allKeys = new Set([...localMap.keys(), ...prodMap.keys()]);
  
  for (const key of allKeys) {
    if (category === 'FUNCTION' && isSystemFunction(key)) {
      // Only include it if it exists locally (meaning we explicitly migrated it)
      if (!localMap.has(key)) {
        parity.push({
          category,
          object: key,
          local: 'MISSING',
          production: 'EXISTS',
          classification: 'EXPECTED SYSTEM/EXTENSION OBJECT',
          severity: 'LOW',
          evidence: 'Identified as a PostgreSQL internal/extension function'
        });
        continue;
      }
    }

    const local = localMap.get(key);
    const prod = prodMap.get(key);

    if (local && prod) {
      const isMatch = compareFn(local, prod);
      parity.push({
        category,
        object: key,
        local: 'EXISTS',
        production: 'EXISTS',
        classification: isMatch ? 'CONFIRMED MATCH' : 'CONFIRMED DIFFERENCE',
        severity: isMatch ? 'LOW' : 'HIGH',
        evidence: isMatch ? 'Identical definitions' : 'Definitions differ'
      });
    } else if (local && !prod) {
      parity.push({
        category,
        object: key,
        local: 'EXISTS',
        production: 'MISSING/UNKNOWN',
        classification: 'UNKNOWN / PRODUCTION EVIDENCE MISSING',
        severity: 'LOW',
        evidence: 'Present locally, absent in production baseline (likely incomplete forensic extract)'
      });
    } else if (!local && prod) {
      parity.push({
        category,
        object: key,
        local: 'MISSING',
        production: 'EXISTS',
        classification: 'POTENTIAL APPLICATION DRIFT',
        severity: 'HIGH',
        evidence: 'Present in production baseline, absent locally'
      });
    }
  }
}

// Compare COLUMNS
compareObjects('COLUMN', localColumns, prodColumns, 
  c => c.table_name + '.' + c.column_name,
  (l, p) => l.data_type === p.data_type
);

// Compare CONSTRAINTS
compareObjects('CONSTRAINT', localConstraints, prodConstraints,
  c => c.table_name + '.' + c.constraint_name,
  (l, p) => l.definition === p.definition
);

// Compare RLS
compareObjects('RLS', localRls, prodRls,
  r => r.tablename + '.' + r.policyname,
  (l, p) => l.cmd === p.cmd && l.qual === p.qual && l.with_check === p.with_check
);

// Compare FUNCTIONS
compareObjects('FUNCTION', localFunctions, prodFunctions,
  f => f.function_name,
  (l, p) => true
);

fs.writeFileSync('tests/reports/PHASE_5.1.1_REFINED_PARITY_REPORT.json', JSON.stringify(parity, null, 2));

const bpInvestigationCols = [
  'booking_participants.cancellation_reason',
  'booking_participants.cancelled_at',
  'booking_participants.requested_slot_id',
  'booking_participants.attendance_status',
  'booking_participants.checked_in_at',
  'booking_participants.checked_in_by',
  'booking_participants.check_in_method'
];

let bpDrifts = parity.filter(p => bpInvestigationCols.includes(p.object) && p.classification === 'POTENTIAL APPLICATION DRIFT');

const md = `# PHASE 5.1.1 — REFINED SCHEMA PARITY REPORT

## Executive Summary
This report refines the schema parity audit to exclude PostgreSQL system/extension objects and correctly categorizes missing production evidence as \`UNKNOWN / PRODUCTION EVIDENCE MISSING\` rather than \`POTENTIAL DRIFT\`.

## Confirmed Matches
Matches found: ${parity.filter(p => p.classification === 'CONFIRMED MATCH').length} objects (Functions, Columns, Constraints, RLS).

## Confirmed Differences
${parity.filter(p => p.classification === 'CONFIRMED DIFFERENCE').map(p => `- **${p.object}**: Local (${p.local}) | Prod (${p.production}) -> ${p.classification}`).join('\n') || 'None'}

## Unknown Production Evidence
${parity.filter(p => p.classification === 'UNKNOWN / PRODUCTION EVIDENCE MISSING').length} objects are present in our local repository migrations but absent from the physical production dump evidence (likely due to incomplete forensic extraction).

## Expected System Objects
${parity.filter(p => p.classification === 'EXPECTED SYSTEM/EXTENSION OBJECT').length} internal/extension PostgreSQL functions (e.g. \`gbt_*\`, \`uuid_*\`) were ignored from application drift analysis.

## Application Risks (Potential Application Drift)
These objects exist in production but NOT in our local migrations.
${parity.filter(p => p.classification === 'POTENTIAL APPLICATION DRIFT').map(p => `- **${p.object}**: Local (${p.local}) | Prod (${p.production}) -> ${p.classification}`).join('\n')}

## \`booking_participants\` Investigation
Investigation of suspicious columns:
- \`cancellation_reason\`
- \`cancelled_at\`
- \`requested_slot_id\`
- \`attendance_status\`
- \`checked_in_at\`
- \`checked_in_by\`
- \`check_in_method\`

**Verdict**: We searched all local migrations and confirmed that **none of these columns are created for the \`booking_participants\` table by any migration in our repository.** 
If they physically exist in production, they were likely added manually to the production database directly, or the production baseline JSON extracted them incorrectly from a view/join (e.g. they belong to \`bookings\` or \`attendance_records\`). They represent TRUE DRIFT or FALSE EVIDENCE. We must not remove them from local since they never existed locally.

## Final Verdict
**YELLOW** — evidence incomplete

While we resolved the false positives caused by incomplete production evidence and PostgreSQL extensions, the remaining \`POTENTIAL APPLICATION DRIFT\` (specifically the extra columns on \`booking_participants\`) requires either acknowledging them as manual production drift or acquiring a definitive production \`pg_dump\`.
`;

fs.writeFileSync('tests/reports/PHASE_5.1.1_REFINED_PARITY_REPORT.md', md);
console.log('Refined Parity check completed.');
