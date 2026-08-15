#!/usr/bin/env node
/**
 * Migrate Cube v0.28 JavaScript models to v1.x.
 *
 *   node scripts/migrate-js.mjs            # dry run, prints a report
 *   node scripts/migrate-js.mjs --write    # writes to model/cubes/
 *
 * Source: ../schema/*.js   Target: ./model/cubes/*.js
 *
 * This handles the mechanical ~80%. Every file still needs review — see the
 * REVIEW notes it emits, and MIGRATION.md for what it deliberately does not do.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '../../schema');
const OUT = path.resolve(here, '../model/cubes');
const WRITE = process.argv.includes('--write');

/** Purely mechanical renames — safe, no semantic change. */
const RENAMES = [
  [/measureReferences/g,                    'measures'],
  [/dimensionReferences/g,                  'dimensions'],
  [/segmentReferences/g,                    'segments'],
  [/timeDimensionReference/g,               'timeDimension'],
  [/granularity:\s*`(\w+)`/g,               'granularity: `$1`'],   // unchanged, kept for clarity
  [/primaryKey:/g,                          'primary_key:'],
  [/\bshown:/g,                             'public:'],
  [/refreshKey:/g,                          'refresh_key:'],
  [/sqlAlias:/g,                            'sql_alias:'],
  [/relationship:\s*`belongsTo`/g,          'relationship: `many_to_one`'],
  [/relationship:\s*`hasMany`/g,            'relationship: `one_to_many`'],
  [/relationship:\s*`hasOne`/g,             'relationship: `one_to_one`'],
  [/type:\s*`originalSql`/g,                'type: `original_sql`'],
  [/partitionGranularity:/g,                'partition_granularity:'],
  [/updateWindow:/g,                        'update_window:'],
  [/drillMembers:/g,                        'drill_members:'],
  [/allowNonStrictDateRangeMatch:/g,        'allow_non_strict_date_range_match:'],
];

/** Cube Store is the only pre-aggregation store in v1.x; the flag is gone. */
const DROP_EXTERNAL = [
  [/^\s*external:\s*true,?\s*$/gm, ''],
  [/,(\s*)external:\s*true/g,      ''],
  [/external:\s*true,\s*/g,        ''],
];

const rows = [];
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.js'));

for (const file of files) {
  const before = fs.readFileSync(path.join(SRC, file), 'utf8');
  let after = before;
  const notes = [];

  // Skip the Cube starter template's sample cube.
  if (file === 'Orders.js' && /SELECT 1 as id, 100 as amount/.test(before)) {
    rows.push({ file, action: 'SKIP', notes: ['starter template sample cube'] });
    continue;
  }

  for (const [re, to] of [...RENAMES, ...DROP_EXTERNAL]) after = after.replace(re, to);

  // Tenant isolation moves to access_policy. Replacing the whole expression with
  // 1=1 keeps every position syntactically valid: `WHERE 1=1`, `AND 1=1`.
  // Whitespace is inconsistent across files: `filter(`, `filter (`, `)}`, `) }`.
  const tenantRe = /\$\{\s*SECURITY_CONTEXT\.ad_client_id\.filter\s*\([^)]*\)\s*\}/g;
  const tenantHits = (after.match(tenantRe) || []).length;
  if (tenantHits) {
    after = after.replace(tenantRe, '1=1');
    notes.push(`${tenantHits} tenant filter(s) -> 1=1; isolation now via access_policy`);
  }

  // Language filtering is NOT tenancy - it resolves translated labels from
  // rv_ad_reference_trl and must survive. SECURITY_CONTEXT is removed in v1.x,
  // so read the same claim from COMPILE_CONTEXT instead.
  const langRe = /\$\{\s*SECURITY_CONTEXT\.ad_language\.filter\s*\(\s*'([^']+)'\s*\)\s*\}/g;
  const langHits = (after.match(langRe) || []).length;
  if (langHits) {
    after = after.replace(langRe,
      "$1 = '${COMPILE_CONTEXT.securityContext.ad_language || 'en_US'}'");
    notes.push(`${langHits} language filter(s) -> COMPILE_CONTEXT (i18n preserved)`);
  }

  // Anything still referencing the removed global needs a human.
  const leftover = (after.match(/SECURITY_CONTEXT/g) || []).length;
  if (leftover) notes.push(`REVIEW: ${leftover} unhandled SECURITY_CONTEXT reference(s)`);

  if (/\.sql\(\)/.test(after))  notes.push('REVIEW: uses Cube.sql() - verify against v1.x');
  if (/extends:/.test(after))   notes.push('REVIEW: uses extends - verify inheritance');
  if (/FILTER_PARAMS/.test(after)) notes.push('FILTER_PARAMS retained (still supported)');

  rows.push({ file, action: after === before ? 'unchanged' : 'migrated', notes });

  if (WRITE) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, file), after);
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${WRITE ? 'WROTE' : 'DRY RUN'}  ${SRC} -> ${OUT}\n`);
for (const r of rows) {
  console.log(`${pad(r.file, 24)} ${pad(r.action, 10)} ${r.notes.join(' | ')}`);
}
const review = rows.filter(r => r.notes.some(n => n.startsWith('REVIEW')));
console.log(`\n${rows.length} files, ${rows.filter(r => r.action === 'migrated').length} migrated, ${review.length} need review`);
if (!WRITE) console.log('\nRe-run with --write to apply.\n');
