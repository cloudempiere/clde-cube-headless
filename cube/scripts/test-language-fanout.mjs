#!/usr/bin/env node
/**
 * Does an access_policy row_level filter on a lookup cube apply when that cube
 * is JOINED from a fact, or only when it is queried directly?
 *
 * This decides the translation design:
 *
 *   applies on join      -> keep ad_language as an ordinary dimension, let the
 *                           policy filter it. Unlimited languages, no pivot,
 *                           nothing hardcoded.
 *
 *   direct query only    -> joining fans the fact table out by the number of
 *                           languages, silently. Pivot into columns instead and
 *                           accept the hardcoded language list.
 *
 *   CUBEJS_API_SECRET=... node scripts/test-language-fanout.mjs
 */
import crypto from 'node:crypto';

const SECRET = process.env.CUBEJS_API_SECRET;
if (!SECRET) { console.error('CUBEJS_API_SECRET not set'); process.exit(2); }
const API = 'http://localhost:4000/cubejs-api/v1/load';

function jwt(payload) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ ...payload, exp: Math.floor(Date.now() / 1000) + 600 });
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

async function q(query, ctx) {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: jwt(ctx) },
      body: JSON.stringify({ query }),
    });
    const body = await res.json();
    if (body.error === 'Continue wait') { await new Promise(r => setTimeout(r, 3000)); continue; }
    if (body.error) return { error: String(body.error).slice(0, 160) };
    return { data: body.data };
  }
  return { error: 'timed out' };
}

const SK = { ad_client_id: 1000026, ad_language: 'sk_SK', roles: ['tenant_user'] };
const HU = { ad_client_id: 1000026, ad_language: 'hu_HU', roles: ['tenant_user'] };
const num = r => (r.data && r.data[0]) ? Number(Object.values(r.data[0])[0]) : null;

console.log('\n1. DIRECT QUERY - does the policy filter at all?\n');
const sk = await q({ measures: ['Reference.count'] }, SK);
const hu = await q({ measures: ['Reference.count'] }, HU);
console.log('   sk_SK context :', num(sk) ?? sk.error);
console.log('   hu_HU context :', num(hu) ?? hu.error);

const skCount = num(sk);
const policyWorks = skCount !== null && num(hu) !== null;
if (!policyWorks) { console.log('\n   cannot proceed - direct query failed'); process.exit(1); }

console.log('\n2. LANGUAGES VISIBLE - should be exactly one\n');
const langs = await q({ dimensions: ['Reference.ad_language'] }, SK);
const seen = (langs.data || []).map(r => r['Reference.ad_language']);
console.log('   languages returned under sk_SK context :', seen.join(', ') || langs.error);

console.log('\n3. THE VERDICT\n');
if (seen.length === 1 && seen[0] === 'sk_SK') {
  console.log('   PASS - the policy restricts rows to the security context language.');
  console.log('   A fact joining this cube sees one row per code, so NO FAN-OUT.');
  console.log('   -> use ad_language as a dimension + access_policy. No pivot needed.');
} else if (seen.length > 1) {
  console.log(`   FAIL - ${seen.length} languages visible despite the policy.`);
  console.log('   Joining this cube from a fact would multiply rows by', seen.length + '.');
  console.log('   -> pivot into columns instead, and accept the hardcoded language list.');
} else {
  console.log('   INCONCLUSIVE:', langs.error ?? seen);
}
console.log();
