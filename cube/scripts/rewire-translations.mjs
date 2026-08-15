#!/usr/bin/env node
/**
 * Replace inline rv_ad_reference_trl joins with joins to domain-scoped
 * Reference cubes.
 *
 *   node scripts/rewire-translations.mjs <file.js> [--write]
 *
 * For each inline join it finds:
 *
 *   JOIN rv_ad_reference_trl <alias>
 *     ON <src.col> = <alias>.value::bpchar
 *    AND <alias>.ad_reference_id = <N>::numeric
 *    AND <alias>.ad_language = <whatever>
 *
 * it does three things:
 *
 *   1. removes the join line
 *   2. rewrites the SELECT item `<alias>.name as <dim>` to `<src.col> AS <dim>_code`
 *      so the fact carries the stable code instead of a language-bound label
 *   3. adds a cube-level join to the domain cube for <N>
 *
 * The label then comes from the domain cube, whose access_policy filters
 * ad_language from the security context - one compiled model, one rollup set,
 * and a sixth language is an INSERT. See docs/ADR-001.
 *
 * Any domain not in DOMAIN_CUBE is reported and left alone rather than guessed.
 */
import fs from 'node:fs';

/** ad_reference_id -> cube name, matching scripts/gen-reference-domains.mjs */
const DOMAIN_CUBE = {
  151: 'DeliveryRule',      150: 'InvoiceRule',
  1000116: 'OrderLineStatus', 1000188: 'LostSalesReason',
  131: 'DocumentStatus',    183: 'DocBaseType',
  152: 'DeliveryViaRule',   117: 'AccountType',
  216: 'BankAccountType',   53385: 'CashFlowType',
  1000388: 'OpenItemAging',
};

const file  = process.argv[2];
const write = process.argv.includes('--write');
if (!file) { console.error('usage: rewire-translations.mjs <file.js> [--write]'); process.exit(2); }

let src = fs.readFileSync(file, 'utf8');
const lines = src.split('\n');

// 1. find the inline joins
const joins = [];
// note: .*? between value and AND - '::bpchar' contains letters
const joinRe = /^\s*(?:LEFT\s+)?JOIN\s+rv_ad_reference_trl\s+(\w+)\s+ON\s+([\w.]+)\s*=\s*\1\.value.*?AND\s+\1\.ad_reference_id\s*=\s*(\d+)/i;
lines.forEach((line, i) => {
  const m = joinRe.exec(line);
  if (m) joins.push({ line: i, alias: m[1], srcCol: m[2], refId: Number(m[3]) });
});

if (!joins.length) { console.log(`  ${file.split('/').pop().padEnd(22)} no inline translation joins`); process.exit(0); }

const unknown = joins.filter(j => !DOMAIN_CUBE[j.refId]);
const known   = joins.filter(j => DOMAIN_CUBE[j.refId]);

// 2. rewrite the SELECT items that surface each alias as a label
for (const j of known) {
  const selectRe = new RegExp(`(^\\s*)${j.alias}\\.name\\s+as\\s+(\\w+)(,?)\\s*$`, 'im');
  const m = selectRe.exec(src);
  if (m) {
    j.dim = m[2];
    src = src.replace(selectRe, `$1${j.srcCol} AS ${m[2]}_code$3`);
  }
}

// 3. drop the join lines
src = src.split('\n').filter(l => !joinRe.test(l)).join('\n');

// 4. add cube-level joins, ONE per domain cube.
//
// Warehouse joins the same two domains from five different subquery aliases,
// all feeding one output column - so five inline joins collapse to one
// cube-level join. Emitting one per inline join would produce duplicate keys.
//
// Joins whose SELECT item could not be located are skipped and reported: the
// rewrite would produce a join on a column that does not exist.
const usable = known.filter(j => j.dim);
const skipped = known.filter(j => !j.dim);
const byDomain = new Map();
for (const j of usable) if (!byDomain.has(j.refId)) byDomain.set(j.refId, j);
const cubeJoins = [...byDomain.values()].map(j =>
  `    ${DOMAIN_CUBE[j.refId]}: {\n` +
  `      relationship: \`many_to_one\`,\n` +
  `      sql: \`\${CUBE}.${j.dim ?? j.srcCol.split('.').pop()}_code = \${${DOMAIN_CUBE[j.refId]}}.value\`\n` +
  `    },`
).join('\n');

if (/^\s*joins:\s*\{/m.test(src)) {
  src = src.replace(/^(\s*joins:\s*\{)/m,
    `$1\n    // Translated labels now come from domain-scoped Reference cubes,\n` +
    `    // whose access_policy filters ad_language from the security context.\n${cubeJoins}`);
} else {
  console.log(`  ${file.split('/').pop()}  WARNING: no joins block, cube joins not added`);
}

const name = file.split('/').pop().padEnd(22);
console.log(`  ${name} ${usable.length}/${known.length} rewired -> ${byDomain.size} cube join(s)` +
  (skipped.length ? `, ${skipped.length} SKIPPED (select item not found)` : '') +
  (unknown.length ? `, ${unknown.length} UNKNOWN domain(s): ${unknown.map(u => u.refId).join(', ')}` : ''));
for (const j of usable)  console.log(`      ok   ${j.refId} ${DOMAIN_CUBE[j.refId].padEnd(16)} ${j.srcCol} -> ${j.dim}_code`);
for (const j of skipped) console.log(`      SKIP ${j.refId} ${DOMAIN_CUBE[j.refId].padEnd(16)} ${j.srcCol} - needs manual review`);

if (write) fs.writeFileSync(file, src);
else console.log('      (dry run - pass --write to apply)');
