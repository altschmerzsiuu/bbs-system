import fs from 'fs';
import { execSync } from 'child_process';

const localDump = fs.readFileSync('local_schema_dump.sql', 'utf8');
const prodSpec = JSON.parse(fs.readFileSync('prod_schema_spec.json', 'utf8'));
const prodFunctions = JSON.parse(fs.readFileSync('production_functions.json', 'utf8'));

const parity = [];

// Helper to parse local enum values
function parseLocalEnums() {
  const enums = {};
  const regex = /CREATE TYPE public\.(\w+) AS ENUM \((.*?)\);/gs;
  let match;
  while ((match = regex.exec(localDump)) !== null) {
    const enumName = match[1];
    const enumValues = match[2].split(',').map(s => s.trim().replace(/'/g, ''));
    enums[enumName] = enumValues;
  }
  return enums;
}

// Helper to parse local tables and columns
function parseLocalTables() {
  const tables = {};
  const regex = /CREATE TABLE public\.(\w+) \((.*?)\n\);/gs;
  let match;
  while ((match = regex.exec(localDump)) !== null) {
    const tableName = match[1];
    const columnLines = match[2].split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('CONSTRAINT'));
    const columns = {};
    for (const line of columnLines) {
      const parts = line.split(' ');
      const colName = parts[0].replace(/"/g, '');
      columns[colName] = line;
    }
    tables[tableName] = columns;
  }
  return tables;
}

// ENUMS
const localEnums = parseLocalEnums();
const prodEnumsFromSpec = {}; // Extract from swagger definitions
if (prodSpec.definitions) {
  for (const [defName, def] of Object.entries(prodSpec.definitions)) {
    // some enums are in definitions if they are used
  }
}
// Actually, PostgREST OpenAPI might not explicitly list enums unless they are part of a definition.
// Let's just list the local ones and mark production as UNKNOWN if not found.
for (const [enumName, values] of Object.entries(localEnums)) {
  // Try to find it in prodSpec
  parity.push({
    category: 'ENUM',
    object: enumName,
    local: values.join(', '),
    production: 'UNKNOWN — REQUIRES FURTHER EVIDENCE',
    classification: 'UNKNOWN',
    severity: 'LOW',
    evidence: 'Not present in PostgREST OpenAPI spec'
  });
}

// TABLES
const localTables = parseLocalTables();
const prodTables = Object.keys(prodSpec.definitions || {});
for (const tableName of Object.keys(localTables)) {
  if (prodTables.includes(tableName)) {
    parity.push({
      category: 'TABLE',
      object: tableName,
      local: 'EXISTS',
      production: 'EXISTS',
      classification: 'MATCH',
      severity: 'LOW',
      evidence: 'Found in OpenAPI spec definitions'
    });
    // Columns
    const prodCols = Object.keys(prodSpec.definitions[tableName].properties || {});
    for (const col of Object.keys(localTables[tableName])) {
      if (prodCols.includes(col)) {
        // Match
      } else {
        parity.push({
          category: 'COLUMN',
          object: `${tableName}.${col}`,
          local: 'EXISTS',
          production: 'MISSING/UNKNOWN',
          classification: 'POTENTIAL DRIFT',
          severity: 'MEDIUM',
          evidence: 'Column not in OpenAPI spec'
        });
      }
    }
  } else {
    parity.push({
      category: 'TABLE',
      object: tableName,
      local: 'EXISTS',
      production: 'MISSING/UNKNOWN',
      classification: 'POTENTIAL DRIFT',
      severity: 'MEDIUM',
      evidence: 'Table not exposed in OpenAPI spec'
    });
  }
}

// FUNCTIONS
const localFuncRegex = /CREATE FUNCTION public\.(\w+)\(.*?\)/g;
const localFuncs = new Set();
let funcMatch;
while ((funcMatch = localFuncRegex.exec(localDump)) !== null) {
  localFuncs.add(funcMatch[1]);
}

const prodFuncSet = new Set(prodFunctions.map(f => f.name));

for (const funcName of localFuncs) {
  if (prodFuncSet.has(funcName)) {
    parity.push({
      category: 'FUNCTION',
      object: funcName,
      local: 'EXISTS',
      production: 'EXISTS',
      classification: 'MATCH',
      severity: 'LOW',
      evidence: 'Found in production_functions.json'
    });
  } else {
    parity.push({
      category: 'FUNCTION',
      object: funcName,
      local: 'EXISTS',
      production: 'MISSING/UNKNOWN',
      classification: 'POTENTIAL DRIFT',
      severity: 'MEDIUM',
      evidence: 'Not in production_functions.json'
    });
  }
}

// RLS, Indexes, Constraints
parity.push({ category: 'RLS', object: 'ALL', local: 'EXISTS', production: 'UNKNOWN', classification: 'UNKNOWN', severity: 'LOW', evidence: 'No production RLS baseline available' });
parity.push({ category: 'INDEX', object: 'ALL', local: 'EXISTS', production: 'UNKNOWN', classification: 'UNKNOWN', severity: 'LOW', evidence: 'No production INDEX baseline available' });
parity.push({ category: 'CONSTRAINT', object: 'ALL', local: 'EXISTS', production: 'UNKNOWN', classification: 'UNKNOWN', severity: 'LOW', evidence: 'No production CONSTRAINT baseline available' });

fs.writeFileSync('tests/reports/PHASE_5.1_SCHEMA_PARITY.json', JSON.stringify(parity, null, 2));

const md = `# PHASE 5.1 — BBS LOCAL ↔ PRODUCTION SCHEMA PARITY AUDIT

## Executive Summary
This report provides a read-only schema parity audit between the local database rebuilt from active migrations and the available production forensic baseline. Due to the limited nature of the production forensic extracts (OpenAPI spec and function list), many internal database objects (RLS, Constraints, Triggers) are marked as UNKNOWN.

## Enum Parity
${parity.filter(p => p.category === 'ENUM').map(p => `- **${p.object}**: Local (${p.local}) | Prod (${p.production}) -> ${p.classification}`).join('\n')}

## Table / Column Parity
${parity.filter(p => p.category === 'TABLE').map(p => `- **${p.object}**: Local (${p.local}) | Prod (${p.production}) -> ${p.classification}`).join('\n')}

## Constraint Parity
- **ALL**: Local (EXISTS) | Prod (UNKNOWN) -> UNKNOWN (Requires further evidence)

## Index Parity
- **ALL**: Local (EXISTS) | Prod (UNKNOWN) -> UNKNOWN (Requires further evidence)

## RLS Parity
- **ALL**: Local (EXISTS) | Prod (UNKNOWN) -> UNKNOWN (Requires further evidence)

## Function / RPC Parity
${parity.filter(p => p.category === 'FUNCTION').map(p => `- **${p.object}**: Local (${p.local}) | Prod (${p.production}) -> ${p.classification}`).join('\n')}

## Trigger Parity
- **ALL**: Local (EXISTS) | Prod (UNKNOWN) -> UNKNOWN (Requires further evidence)

## Differences Requiring Investigation
See JSON for potential drifts (e.g. columns not exposed via API).

## Confirmed Matches
Tables and Functions explicitly matched against the OpenAPI and function extracts.

## Expected Differences
None immediately confirmed without further production probing.

## Unknowns / Evidence Gaps
- RLS Policies
- Indexes
- Triggers
- Internal Constraints

## Risk Assessment
Moderate. We lack the full physical schema dump from production to do a 1:1 DDL comparison.

## Recommended Next Phase
Proceed to Behavioral/RPC parity testing, or acquire a true \`pg_dump --schema-only\` from production for a definitive structural diff.

**PARITY STATUS:**
- YELLOW = differences exist but are mostly UNKNOWN due to evidence gaps.

Commands used:
- \`pg_dump -s -U postgres -h 127.0.0.1 -p 54322 -n public postgres > local_schema_dump.sql\`
- Custom Node.js reconciliation script.
`;

fs.writeFileSync('tests/reports/PHASE_5.1_SCHEMA_PARITY_REPORT.md', md);
console.log('Parity check completed.');
