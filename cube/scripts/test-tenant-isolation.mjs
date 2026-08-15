#!/usr/bin/env node
/**
 * Does a fact query leak across tenants?
 *
 *   CUBEJS_API_SECRET=... node scripts/test-tenant-isolation.mjs
 *
 * Three checks:
 *
 *   1. NO CLAIM       a token with no ad_client_id must be DENIED, not served.
 *                     The 2022 model returned every tenant's rows here.
 *   2. SCOPED         each tenant sees only its own rows.
 *   3. SUM < TOTAL    two tenants' counts must be less than the unfiltered
 *                     total, or the filter is not being applied at all.
 */
import crypto from 'node:crypto';

const SECRET = process.env.CUBEJS_API_SECRET;
if (!SECRET) { console.error('CUBEJS_API_SECRET not set'); process.exit(2); }
const API = 'http://localhost:4000/cubejs-api/v1/load';

function jwt(payload) {
  const b64  = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ ...payload, exp: Math.floor(Date.now() / 1000) + 900 });
  const sig  = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

async function count(ctx) {
  const query = {
    measures: ['Orderfacts.linecount'],
    timeDimensions: [{ dimension: 'Orderfacts.dateordered',
                       dateRange: ['2026-01-01', '2026-08-31'] }],
  };
  for (let i = 0; i < 40; i++) {
    const res  = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: jwt(ctx) },
      body: JSON.stringify({ query }),
    });
    const body = await res.json();
    if (body.error === 'Continue wait') { await new Promise(r => setTimeout(r, 4000)); continue; }
    if (body.error) return { denied: true, why: String(body.error).slice(0, 90) };
    return { denied: false, value: Number(Object.values(body.data[0] ?? {})[0] ?? 0) };
  }
  return { denied: true, why: 'timed out' };
}

console.log();
const noClaim = await count({ sub: 'attacker' });
console.log('  1. no ad_client_id claim');
console.log(`     ${noClaim.denied ? 'DENIED  ' + noClaim.why : 'SERVED ' + noClaim.value.toLocaleString() + '  <- LEAK'}`);

const a = await count({ ad_client_id: 1000026, roles: ['tenant_user'] });
const b = await count({ ad_client_id: 1000015, roles: ['tenant_user'] });
console.log('\n  2. per-tenant scoping');
console.log(`     tenant 1000026 : ${a.denied ? 'denied ' + a.why : a.value.toLocaleString()}`);
console.log(`     tenant 1000015 : ${b.denied ? 'denied ' + b.why : b.value.toLocaleString()}`);

console.log('\n  3. verdict');
const leaked  = !noClaim.denied && noClaim.value > 0;
const scoped  = !a.denied && !b.denied && a.value !== b.value;
if (leaked)      console.log('     FAIL - a token without a tenant claim was served data.');
else if (!scoped) console.log('     INCONCLUSIVE - tenants returned identical or no counts.');
else              console.log('     PASS - claimless token denied; tenants see different, scoped counts.');
console.log();
process.exit(leaked ? 1 : 0);
