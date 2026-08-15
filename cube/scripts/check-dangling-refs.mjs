#!/usr/bin/env node
/**
 * Find pre-aggregations, drill_members and measure lists that reference a
 * member the migration stripped.
 *
 *   node scripts/check-dangling-refs.mjs model/cubes
 *
 * WHY THIS EXISTS
 *
 * Stripping a member that referenced a foreign cube is not enough - anything
 * still pointing at it dangles. Cube does NOT catch this at compile time:
 *
 *   Businesspartner had a pre-aggregation listing Businesspartner.salesrep,
 *   a dimension the migration commented out. The model compiled cleanly with
 *   44 entities. Any query touching that cube then failed at runtime with
 *   "TesseractUserError: Cannot resolve: salesrep".
 *
 * So a green compile says nothing about this class of defect. It only appears
 * when a query happens to hit the affected cube, which in a 27-cube model may
 * be much later than the change that caused it.
 *
 * Exit code 1 if any dangling reference is found. Suitable for CI.
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] ?? 'model/cubes';
const LIST_KEYS = /(dimensions|measures|drill_members|drillMembers|segments)\s*:\s*\[/;

let found = 0;
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(dir, file), 'utf8');

  // members the migration commented out
  const stripped = new Set(
    [...src.matchAll(/\/\/ MIGRATION v1\.x:[^\n]*\n\s*\/\/[^\n]*\n\s*\/\/\s+(\w+): \{/g)].map(m => m[1])
  );
  if (!stripped.size) continue;

  src.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) return;      // already commented out
    if (!LIST_KEYS.test(line)) return;
    for (const member of stripped) {
      if (new RegExp(`\\b${member}\\b`).test(line)) {
        found++;
        console.log(`  ${file}:${i + 1}  references stripped member '${member}'`);
        console.log(`      ${trimmed.slice(0, 100)}`);
      }
    }
  });
}

console.log(found
  ? `\n  ${found} dangling reference(s) - these COMPILE but fail at query time\n`
  : '\n  no dangling references\n');
process.exit(found ? 1 : 0);
