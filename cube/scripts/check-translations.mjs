#!/usr/bin/env node
/**
 * Report reference labels that have a translation row but no translation.
 *
 *   node scripts/check-translations.mjs           # all modelled domains
 *   node scripts/check-translations.mjs --lang hu_HU
 *   node scripts/check-translations.mjs --fail-over 50   # exit 1 above 50%
 *
 * WHY A COVERAGE CHECK IS NOT ENOUGH
 *
 * Every domain in the model has ad_ref_list_trl rows for all five languages, so
 * any check asking "is there a translation?" passes for all of them. The rows
 * exist; some just contain the English text.
 *
 * That distinction is invisible from the API. A Slovak user asking for open
 * item aging gets "Due Today" and "Due Today-30" - correct-looking labels, in
 * the wrong language, with no error anywhere. The model resolves the
 * translation faithfully; there is nothing to resolve.
 *
 * So this compares t.name against rl.name rather than counting rows. Anything
 * reported here is an iDempiere DATA task - translate the reference list - not
 * a change to the semantic layer.
 *
 * At the time of writing, per LABEL across the eleven modelled domains
 * (143 labels each, excluding en_US which is the base):
 *
 *     es_CO   74 / 143   51.7% still English
 *     hu_HU   70 / 143   49.0%
 *     cs_CZ   68 / 143   47.6%
 *     sk_SK   27 / 143   18.9%
 *
 * Count LABELS, not domains. Counting domains-with-any-gap gives "9 of 11 for
 * Czech", which reads as though Czech were barely translated - it is about
 * half, and several domains have a single missing entry. The label figure is
 * the one that describes what a user sees.
 *
 * Worst single domain for Slovak: OpenItemAging, 22 of 22 English.
 * DocumentStatus 3 of 15, DocBaseType 2 of 55, the other eight complete - which
 * shows the translation PIPELINE works, so a domain appearing here is missing
 * content rather than broken plumbing.
 *
 * ad_ref_list and ad_ref_list_trl are system-owned: ad_client_id is always 0,
 * one row per (label, language), no tenant variation. So these figures are the
 * same for every tenant.
 */
import pg from 'pg';

/** ad_reference_id -> cube name, mirroring scripts/gen-reference-domains.mjs. */
const DOMAINS = [
  [151, 'DeliveryRule'], [150, 'InvoiceRule'], [1000116, 'OrderLineStatus'],
  [1000188, 'LostSalesReason'], [131, 'DocumentStatus'], [183, 'DocBaseType'],
  [152, 'DeliveryViaRule'], [117, 'AccountType'], [216, 'BankAccountType'],
  [53385, 'CashFlowType'], [1000388, 'OpenItemAging'],
];

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const LANG = arg('--lang', 'sk_SK');

/**
 * ad_ref_list.name holds the English text, so for en_US a translation row that
 * equals the base is CORRECT, not missing. Without this the check reports
 * English as entirely untranslated - which it technically is, and which is
 * exactly what you want it to be.
 */
const BASE_LANGUAGE = 'en_US';
const FAIL_OVER = Number(arg('--fail-over', 'Infinity'));

const client = new pg.Client({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5433),
  database: process.env.PGDATABASE ?? 'cloudempiere_dev',
  user: process.env.PGUSER ?? 'cube_readonly',
  password: process.env.PGPASSWORD ?? 'cube_local_dev',
});

await client.connect();
await client.query('SET max_parallel_workers_per_gather = 0');

const { rows } = await client.query(
  `WITH modelled(ref_id, cube) AS (VALUES ${DOMAINS.map(([id, c]) => `(${id},'${c}')`).join(',')})
   SELECT m.cube,
          count(*) FILTER (WHERE t.ad_language = $1)                          AS rows,
          count(*) FILTER (WHERE t.ad_language = $1 AND t.name = rl.name)     AS english,
          count(*) FILTER (WHERE t.ad_language = $1 AND t.name IS NULL)       AS missing
   FROM modelled m
   JOIN ad_ref_list rl ON rl.ad_reference_id = m.ref_id AND rl.isactive = 'Y'
   LEFT JOIN ad_ref_list_trl t ON t.ad_ref_list_id = rl.ad_ref_list_id AND t.isactive = 'Y'
   GROUP BY m.cube ORDER BY 3::numeric / NULLIF(2, 0) DESC, m.cube`,
  [LANG]
);
await client.end();

if (LANG === BASE_LANGUAGE) {
  console.log(`\n  ${LANG} is the base language - ad_ref_list.name already holds it,`);
  console.log(`  so a matching translation row is correct. Nothing to report.\n`);
  process.exit(0);
}
console.log(`\n  reference label translation, ${LANG}\n`);
console.log(`  ${'domain'.padEnd(18)}${'labels'.padStart(7)}${'english'.padStart(9)}${'missing'.padStart(9)}   status`);

let worst = 0;
const scored = rows
  .map(r => ({ ...r, pct: Number(r.rows) ? (Number(r.english) / Number(r.rows)) * 100 : 0 }))
  .sort((a, b) => b.pct - a.pct || a.cube.localeCompare(b.cube));

for (const r of scored) {
  worst = Math.max(worst, r.pct);
  const status = r.pct === 0 ? 'translated'
    : r.pct === 100 ? 'ENTIRELY IN ENGLISH'
    : `${r.pct.toFixed(0)}% still English`;
  console.log(
    `  ${r.cube.padEnd(18)}${String(r.rows).padStart(7)}${String(r.english).padStart(9)}` +
    `${String(r.missing).padStart(9)}   ${status}`
  );
}

const labels  = scored.reduce((a, r) => a + Number(r.rows), 0);
const english = scored.reduce((a, r) => a + Number(r.english), 0);
console.log(
  `\n  ${english} of ${labels} labels still English ` +
  `(${((english / labels) * 100).toFixed(1)}%)\n` +
  `\n  Counted per LABEL, not per domain: several domains have a single gap, so\n` +
  `  "N of 11 domains affected" overstates how much a user actually sees.\n` +
  `\n  Everything here is an iDempiere data task - translate the reference list -\n` +
  `  not a change to the semantic layer. Domains at 0% show the pipeline works.\n`
);

if (worst > FAIL_OVER) {
  console.error(`  worst domain is ${worst.toFixed(0)}% English, over the --fail-over ${FAIL_OVER}%\n`);
  process.exit(1);
}
