#!/usr/bin/env node
/**
 * Prove tenant isolation still holds when the answer comes from a rollup.
 *
 *   node scripts/test-rollup-isolation.mjs
 *
 * WHY THIS IS SEPARATE FROM test-tenant-isolation.mjs
 *
 * The rollups are keyed on Client.ad_client_id, which means ONE set of
 * pre-aggregation tables holds EVERY tenant's rows. Isolation is no longer a
 * property of the SQL that reads the source - it is a property of a filter
 * applied to a shared table in Cube Store. That is a different trust boundary
 * and it needs its own test.
 *
 * test-tenant-isolation.mjs asserts only that two tenants get different counts.
 * Different is not the same as correct: both could be wrong, or one could be
 * reading the other's partition. This asserts the stronger property - each
 * tenant's rollup answer equals that same tenant's source answer, exactly.
 *
 * The source figure is obtained by asking at a granularity finer than the
 * rollup's, which Cube cannot satisfy from a day-grained rollup.
 *
 * Exit code 1 on any failure. Suitable for CI.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, '.env'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);

const API = 'http://localhost:4000/cubejs-api/v1';
const TENANTS = [1000026, 1000015];
const MEASURE = 'Orderfacts.linecount';
const TIMEDIM = 'Orderfacts.dateordered';

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(claims) {
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64({ ...claims, exp: Math.floor(Date.now() / 1000) + 7200 });
  const sig = crypto.createHmac('sha256', env.CUBEJS_API_SECRET)
    .update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

async function call(endpoint, query, auth) {
  const r = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({ query }),
  });
  return r.text();
}

function parse(text) {
  try { return JSON.parse(text); } catch { /* Cube emits raw newlines in SQL */ }
  const CONTROL = new RegExp('[\\u0000-\\u001f]', 'g');
  try {
    return JSON.parse(text.replace(CONTROL, c =>
      ({ '\n': '\\n', '\r': '\\r', '\t': '\\t' })[c] ??
      `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`));
  } catch { return { error: `unparseable: ${text.slice(0, 100)}` }; }
}

const q = grain => ({
  measures: [MEASURE],
  timeDimensions: [{ dimension: TIMEDIM, granularity: grain }],
});

async function load(grain, auth, budgetMs = 900_000) {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    const r = parse(await call('load', q(grain), auth));
    if (typeof r.error === 'string' && r.error.includes('Continue wait')) {
      await new Promise(res => setTimeout(res, 5000));
      continue;
    }
    return r;
  }
  return { error: 'timed out waiting for build' };
}

const total = (r) => (r.data ?? []).reduce((a, x) => a + Number(x[MEASURE] ?? 0), 0);

let failed = 0;
const fail = m => { console.log(`  FAIL  ${m}`); failed++; };
const pass = m => console.log(`  PASS  ${m}`);

console.log('\n  tenant isolation through the rollup path\n');

// 1. A token with no tenant claim must get NO DATA, even though the rollup
//    tables physically contain every tenant's rows.
//
//    Two different refusals are both correct, and which one occurs depends on
//    the cube:
//
//      queryRewrite  throws, because a missing ad_client_id is an error
//      access_policy returns an empty result - Cube's documented behaviour is
//                    that "when you define access policies for specific groups,
//                    access is automatically denied to all other groups", and a
//                    claimless token yields no groups from contextToGroups
//
//    This asserted an error only, so once the fact cubes gained policies it
//    started failing on a technicality while the security property held. The
//    property being tested is that no rows come back; assert that instead.
const anon = parse(await call('load', q('year'), token({ sub: 'attacker' })));
const anonRows = anon.error ? 0 : total(anon);
if (anon.error) pass('claimless token denied - queryRewrite refused it');
else if (anonRows === 0) pass('claimless token denied - policy matched no group, empty result');
else fail(`claimless token LEAKED ${anonRows.toLocaleString()} rows worth of data`);

// 2. Each tenant's rollup answer must equal that tenant's own source answer.
const totals = {};
for (const t of TENANTS) {
  const auth = token({ ad_client_id: t, ad_language: 'sk_SK', roles: ['tenant_user'] });

  const sql = await call('sql', q('year'), auth);
  if (!sql.includes('dev_pre_aggregations')) {
    fail(`tenant ${t}: not served by a rollup, nothing to test`);
    continue;
  }

  const hit = await load('year', auth);
  const src = await load('hour', auth, 600_000);
  if (hit.error || src.error) {
    fail(`tenant ${t}: ${String(hit.error ?? src.error).slice(0, 70)}`);
    continue;
  }
  if (!Object.keys(hit.usedPreAggregations ?? {}).length) {
    fail(`tenant ${t}: served without a pre-aggregation`);
    continue;
  }

  const roll = total(hit), source = total(src);
  totals[t] = roll;
  if (roll === source) pass(`tenant ${t}: rollup ${roll.toLocaleString()} == source ${source.toLocaleString()}`);
  else fail(`tenant ${t}: rollup ${roll} != source ${source} - LEAKAGE OR LOSS`);
}

// 3. Two tenants must not see the same figure, which would mean the filter
//    never narrowed the shared table.
const [a, b] = TENANTS;
if (totals[a] !== undefined && totals[b] !== undefined) {
  if (totals[a] !== totals[b]) pass(`tenants differ: ${totals[a].toLocaleString()} vs ${totals[b].toLocaleString()}`);
  else fail(`both tenants see ${totals[a]} - filter not applied to the shared rollup`);
}

console.log(failed ? `\n  ${failed} failure(s)\n` : '\n  isolation holds through the rollup\n');
process.exit(failed ? 1 : 0);
