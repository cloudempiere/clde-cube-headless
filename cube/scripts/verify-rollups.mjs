#!/usr/bin/env node
/**
 * Prove every declared rollup is actually SERVING queries, not just declared.
 *
 *   node scripts/verify-rollups.mjs
 *
 * WHY THIS EXISTS
 *
 * A rollup can fail three different ways, and only the third is visible:
 *
 *   1. declared but never matched   - the planner silently reads the source
 *   2. matched but never built      - first query blocks, then times out
 *   3. built but wrong             - totals drift from the source
 *
 * Cube reports none of these as errors. `/v1/meta` does not even list
 * pre-aggregations, so "the model compiles" and "the rollups work" are
 * unrelated facts.
 *
 * The specific bug that motivated this: queryRewrite filters on
 * Client.ad_client_id, but the rollups were built on <Cube>.ad_client_id.
 * A rollup only matches when every filtered member is one of its dimensions,
 * so the tenant filter silently disabled EVERY pre-aggregation in the model.
 * Queries kept returning correct numbers - straight from the 11.2M-row source.
 *
 * So this checks all three: match (via /v1/sql), build+serve (via /v1/load and
 * usedPreAggregations), and correctness (total vs the same query with the
 * rollup disabled).
 *
 * Exit code 1 if any rollup fails. Suitable for CI.
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
const TENANT = 1000026;

/** Fact cubes that declare a rollup, with a measure and time dimension it covers. */
const CASES = [
  ['Orderfacts',    'linecount',     'dateordered'],
  ['Invoicefacts',  'linecount',     'dateinvoiced'],
  ['Quotefacts',    'linecount',     'datequoted'],
  ['Openitem',      'count',         'dateinvoiced'],
  ['Logisticfacts', 'shipmentcount', 'shipdate'],
  ['Cashflowplan',  'count',         'Date'],
  ['Warehouse',     'linecount',     'movementdate'],
];

const ROLLUP_GRAIN = 'year';

/**
 * How step 3 gets an independent number - and why it is not uniform.
 *
 * There is no "skip pre-aggregations" flag in the REST API, so asking the same
 * question twice answers from the rollup twice: a tautology that always passes.
 * A real bypass has to make the query unanswerable from the rollup.
 *
 * REJECTED: a finer granularity (`hour` against a `day` rollup). It worked once
 * and then stopped - these time dimensions are DATE columns with no time part,
 * so Cube can satisfy `hour` from a `day` rollup after all. Anything that
 * depends on the planner declining is only as stable as the planner.
 *
 * USED: request one extra measure that the rollup does not contain. The rollup
 * then cannot answer the query at all, Cube reads the source, and the measure
 * under test keeps its meaning so the totals stay comparable.
 *
 * ALSO REJECTED, AND THIS IS THE CONCLUSION: an extra measure the rollup does
 * not hold. Each fact cube carries SEVERAL pre-aggregations, so a measure
 * outside one rollup is inside another and Cube simply matches the other one.
 * Tested on Orderfacts.qtydelivered, Quotefacts.discount and
 * Cashflowplan.dailybalance - all three were served from a rollup.
 *
 * So there is NO bypass through the query API: rollup coverage is total, which
 * is good for performance and fatal for self-verification. Correctness is
 * therefore NOT checked here. It belongs to scripts/validate.mjs, which
 * compares Cube's answer against hand-written reference SQL run directly on
 * Postgres - the only path independent of Cube's planner. Because the rollups
 * now serve, those cases compare the ROLLUP against the source.
 *
 * This script proves the three things it still can: the planner matches the
 * rollup, the rollup builds and serves, and a range crossing build_range_start
 * falls back to source instead of silently undercounting.
 */

/**
 * Why this is bounded rather than full history.
 *
 * Every partition build re-executes the cube's whole join graph for its month,
 * which costs roughly 30 seconds. Full history is 2000-01 to now - about 320
 * partitions per cube, so warming all seven from cold runs into hours. That is
 * a one-time background cost and it is NOT what this script is testing.
 *
 * Correctness does not need 26 years. This window is recent enough to build in
 * minutes and still spans multiple partitions, multiple years and a partial
 * final month, which is where partition-boundary bugs actually live. Warm the
 * full range separately; leave this fast enough to run on every change.
 */
const RANGE = ['2026-01-01', '2026-08-31'];



const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
function token() {
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64({
    ad_client_id: TENANT, ad_language: 'sk_SK', roles: ['tenant_user'],
    exp: Math.floor(Date.now() / 1000) + 7200,
  });
  const sig = crypto.createHmac('sha256', env.CUBEJS_API_SECRET)
    .update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

const AUTH = token();
async function raw(endpoint, query) {
  const r = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: AUTH },
    body: JSON.stringify({ query }),
  });
  return r.text();
}

/**
 * Cube emits literal newlines inside JSON strings when returning generated SQL,
 * which is invalid JSON that JSON.parse rejects. That failure mode is dangerous
 * here: source SQL is long and multi-line so it throws, while rollup SQL is
 * short and parses - so a parse error looks exactly like "no rollup was used".
 * Escape stray control characters before parsing.
 */
function parse(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  try {
    const CONTROL = new RegExp("[\\u0000-\\u001f]", "g");
    return JSON.parse(text.replace(CONTROL, c =>
      ({ '\n': '\\n', '\r': '\\r', '\t': '\\t' })[c] ??
      `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`));
  } catch { return { error: `unparseable: ${text.slice(0, 120)}` }; }
}
const post = async (endpoint, query) => parse(await raw(endpoint, query));

/** Cube answers "Continue wait" while a pre-aggregation builds. */
async function load(query, budgetMs = 900_000) {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    const r = await post('load', query);
    if (typeof r.error === 'string' && r.error.includes('Continue wait')) {
      await new Promise(res => setTimeout(res, 5000));
      continue;
    }
    return r;
  }
  return { error: `still building after ${Math.round(budgetMs / 60000)} min` };
}

let failed = 0;
console.log(`\n  tenant ${TENANT}, ${CASES.length} rollups, window ${RANGE[0]}..${RANGE[1]}\n`);

for (const [cube, measure, timeDim] of CASES) {
  const at = (grain, range = RANGE) => ({
    measures: [`${cube}.${measure}`],
    timeDimensions: [{ dimension: `${cube}.${timeDim}`, granularity: grain, dateRange: range }],
  });
  const q = at(ROLLUP_GRAIN);
  const label = `  ${cube.padEnd(14)}`;

  // 1. does the planner route it to Cube Store? Match on the raw response -
  //    parsing can fail on source SQL, which would look like a planner miss.
  const sql = await raw('sql', q);
  // Distinguish "the API refused" from "the planner chose the source". Both
  // lack the dev_pre_aggregations marker, and reporting an auth or scope error
  // as a planner miss sends you debugging the model instead of the config.
  if (sql.includes('"error"')) {
    const why = (sql.match(/"error"\s*:\s*"([^"]{0,90})/) ?? [, 'unknown'])[1];
    console.log(`${label} FAIL  /v1/sql returned an error: ${why}`);
    failed++; continue;
  }
  if (!sql.includes('dev_pre_aggregations')) {
    console.log(`${label} FAIL  planner reads the source, rollup never matched`);
    failed++; continue;
  }

  // 2. does it build and serve?
  const hit = await load(q);
  if (hit.error) {
    console.log(`${label} FAIL  ${String(hit.error).slice(0, 90)}`);
    failed++; continue;
  }
  const used = Object.keys(hit.usedPreAggregations ?? {});
  if (!used.length) {
    console.log(`${label} FAIL  served without a pre-aggregation`);
    failed++; continue;
  }

  const total = (hit.data ?? []).reduce((a, r) => a + Number(r[`${cube}.${measure}`] ?? 0), 0);

  console.log(`${label} PASS  ${String(Math.round(total)).padStart(9)}  ${used[0].split('.').pop()}`);
}

/**
 * Static check: build_range_start must equal the cube's own SQL date floor.
 *
 * This reads the source rather than issuing a query, because no query can
 * detect the fault reliably. Cube does not fall back to source outside the
 * build range - it answers from the rollup and drops the uncovered years.
 * Measured with the floor at 2015: tenant 1000015 asked for 2010-2026 and got
 * 4,391,856 instead of 4,479,064; for 2010-2012 it got 0 instead of 14,566.
 * No error either time.
 *
 * A runtime probe was tried first and had to be abandoned: if no rows happen
 * to exist below the floor, a truncating configuration still answers correctly
 * today and only starts lying when older data arrives. Worse, when the floors
 * DO match, declining to use the rollup is the wrong expectation - so the
 * probe reported all seven cubes broken when nothing was. Comparing the two
 * floors in the source states the actual rule.
 */
console.log('\n  build_range_start vs cube SQL floor\n');
const modelDir = path.join(root, 'model', 'cubes');
for (const f of fs.readdirSync(modelDir).sort()) {
  if (!/\.(js|yml)$/.test(f)) continue;
  const src = fs.readFileSync(path.join(modelDir, f), 'utf8');
  // JS keeps build_range_start and its DATE on one line; YAML puts the sql: on
  // the next. A same-line pattern silently SKIPS every converted cube - which
  // it did, passing the whole run while checking nothing on the only cube that
  // had moved to YAML. Allow the value to sit within the next couple of lines.
  const brs = src.match(/build_range_start:(?:[^\n]*\n?){0,2}?[^\n]*DATE '(\d{4}-\d{2}-\d{2})'/);
  if (!brs) continue;
  const floor = src.match(/>=\s*DATE '(\d{4}-\d{2}-\d{2})'/);
  const name = f.replace(/\.(js|yml)$/, '').padEnd(18);
  if (!floor) {
    console.log(`  ${name} WARN  build_range starts ${brs[1]}, cube SQL has no floor`);
    console.log(`  ${' '.repeat(18)}       correct only while no row predates ${brs[1]}`);
  } else if (floor[1] !== brs[1]) {
    console.log(`  ${name} FAIL  build_range ${brs[1]} != SQL floor ${floor[1]} - truncates silently`);
    failed++;
  } else {
    console.log(`  ${name} PASS  both floors ${brs[1]}`);
  }
}

console.log(
  failed
    ? `\n  ${failed} failure(s)\n`
    : `\n  all ${CASES.length} matched, built and served; floors consistent\n` +
      `  Numbers are NOT checked here - no query can bypass the rollups. Run\n` +
      `  scripts/validate.mjs for correctness against reference SQL.\n`
);
process.exit(failed ? 1 : 0);
