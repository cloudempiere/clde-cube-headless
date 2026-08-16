#!/usr/bin/env node
/**
 * Compare a Cube measure against reference SQL run directly on the source.
 *
 *   node scripts/validate.mjs                       # every case
 *   node scripts/validate.mjs scripts/cases/x.json  # one case
 *
 * A case is JSON:
 *
 *   {
 *     "name": "...",
 *     "cubeQuery":    { "measures": ["Orderfacts.linecount"], ... },
 *     "referenceSql": "SELECT count(*) AS value FROM ...",
 *     "tolerance":    0,          // 0 = exact; 0.01 = 1% (use for HLL measures)
 *     "securityContext": { "ad_client_id": 1000026, "ad_language": "sk_SK" }
 *   }
 *
 * WHY THIS EXISTS
 *
 * Converting 185 chart definitions without an automated comparison produces
 * 185 plausible claims. The 2022 model carried a hardcoded `limit 100` inside
 * the OrderFacts SQL that silently capped every query against 11.2M rows - the
 * kind of defect that looks perfectly reasonable on a dashboard. Nothing but a
 * comparison against source catches it.
 *
 * Exit code 0 if every case passes, 1 otherwise. Suitable for CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const API    = process.env.CUBE_URL ?? 'http://localhost:4000/cubejs-api/v1/load';
const CASES  = path.resolve(import.meta.dirname, 'cases');

/**
 * Read the secret from .env when it is not exported, and FAIL if it is missing.
 *
 * This used to be `process.env.CUBEJS_API_SECRET` with `if (!SECRET) return ''`,
 * which sent an unauthenticated request instead. Every case then came back
 * "Access denied: security context carries no ad_client_id" - a message that
 * points at the model and the security context, not at the missing secret. It
 * reads exactly like a broken tenant filter, and it cost a wrong diagnosis.
 * A missing credential must look like a missing credential.
 */
const SECRET = process.env.CUBEJS_API_SECRET ?? (() => {
  const envFile = path.resolve(import.meta.dirname, '..', '.env');
  const line = fs.existsSync(envFile)
    ? fs.readFileSync(envFile, 'utf8').split('\n').find(l => l.startsWith('CUBEJS_API_SECRET='))
    : null;
  return line ? line.slice('CUBEJS_API_SECRET='.length).trim() : null;
})();

if (!SECRET) {
  console.error('\n  CUBEJS_API_SECRET is not set and not readable from .env - cannot sign a token.\n');
  process.exit(2);
}

function jwt(payload) {
  const b64  = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ ...payload, exp: Math.floor(Date.now() / 1000) + 900 });
  const sig  = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

/** Cube answers long queries with "Continue wait"; poll until it resolves. */
async function fromCube(query, ctx) {
  for (let i = 0; i < 60; i++) {
    const res  = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: jwt(ctx ?? {}) },
      body: JSON.stringify({ query }),
    });
    const body = await res.json();
    if (body.error === 'Continue wait') { await new Promise(r => setTimeout(r, 5000)); continue; }
    if (body.error) throw new Error(String(body.error).slice(0, 200));
    const total = (body.data ?? []).reduce((sum, row) => {
      const v = Object.values(row).find(x => x !== null && !Number.isNaN(Number(x)));
      return sum + Number(v ?? 0);
    }, 0);
    return { value: total, preAgg: Boolean(body.usedPreAggregations && Object.keys(body.usedPreAggregations).length) };
  }
  throw new Error('timed out waiting for Cube');
}

async function fromSql(sql) {
  const client = new pg.Client({
    host:     process.env.PGHOST     ?? 'localhost',
    port:     Number(process.env.PGPORT ?? 5433),
    database: process.env.PGDATABASE ?? 'cloudempiere_dev',
    user:     process.env.PGUSER     ?? 'cube_readonly',
    password: process.env.PGPASSWORD ?? 'cube_local_dev',
  });
  await client.connect();
  try {
    // Reference queries scan whole fact tables, and Postgres' parallel workers
    // then ask for more shared memory than the container has:
    //   "could not resize shared memory segment ... No space left on device"
    // That surfaces as a case ERROR and reads like a broken reference query.
    // These run once, so serial execution costs little and always completes.
    await client.query('SET max_parallel_workers_per_gather = 0');
    const { rows } = await client.query(sql);
    return Number(Object.values(rows[0])[0]);
  } finally { await client.end(); }
}

const files = process.argv[2]
  ? [path.resolve(process.argv[2])]
  : fs.readdirSync(CASES).filter(f => f.endsWith('.json')).map(f => path.join(CASES, f)).sort();

if (!files.length) { console.error('no cases found in', CASES); process.exit(2); }

let failed = 0;
console.log();
for (const file of files) {
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  const tol = c.tolerance ?? 0;
  process.stdout.write(`  ${path.basename(file).padEnd(30)}`);
  try {
    const [cube, ref] = await Promise.all([
      fromCube(c.cubeQuery, c.securityContext),
      fromSql(c.referenceSql),
    ]);
    const diff  = Math.abs(cube.value - ref);
    const scale = Math.max(Math.abs(ref), 1);
    const pct   = (diff / scale) * 100;
    const pass  = diff / scale <= tol;
    if (!pass) failed++;
    console.log(
      `${pass ? 'PASS' : 'FAIL'}  cube=${cube.value.toLocaleString()} ` +
      `ref=${ref.toLocaleString()} delta=${pct.toFixed(3)}% ` +
      `tol=${(tol * 100).toFixed(2)}%${cube.preAgg ? ' [rollup]' : ''}`
    );
  } catch (e) {
    failed++;
    console.log(`ERROR ${e.message}`);
  }
}
console.log(`\n  ${files.length - failed}/${files.length} passed\n`);
process.exit(failed ? 1 : 0);
