# ADR-001: Adopt Cube Core as the semantic layer, self-hosted, gated on a commercial trigger

- **Status:** Proposed
- **Date:** 2026-08-15
- **Deciders:** Cloudempiere platform
- **Repository:** `cloudempiere/clde-cube-headless` — **this repo is the baseline**
- **Supersedes:** `cloudempiere/cubejs` (Nov 2020, template 0.19/0.23), archived
  in place. See "Correct baseline" below.

---

## Context

### The measured situation

Queried live against production on 2026-08-15:

| Fact | Value |
|---|---|
| Tenants | 16 |
| Named users | 269 |
| Production database | 154 GB |
| `AD_Chart` definitions | 185 |
| `PA_Goal` KPIs | 49 (24 never placed on any dashboard) |
| `PA_MeasureCalc` calculations | 33 |
| `PA_Report` financial reports | 178 |
| Active dashboard panels | 302 — **267 at System level, 35 tenant-specific** |
| Tenants with **zero** dashboard content | **8 of 16** |
| `RV_*` reporting views shipped by iDempiere | 249 |
| Cubes in this repository | 27, in 23 files |
| Measures in this repository | 106, unused since November 2020 |

### The problem, stated precisely

**iDempiere offers seven mutually incompatible ways to define a metric:**
`PA_MeasureCalc`, `AD_Chart` + `AD_ChartDatasource`, `PA_Goal`, `PA_DocumentStatus`,
`PA_Ratio`, `PA_Benchmark`, and `PA_Report` line/column sets — with ZUL panels and
Java `CalculationClass` as further escape hatches. `PA_Measure.MeasureType` is
literally an enum selecting between several of them.

None of these definitions is reusable outside ZK. Not by the Angular monorepo,
not by Excel, not by an AI agent.

Three consequences follow:

1. **Nobody can see the whole metric set.** When a metric can live in seven
   places, "what do we report on?" has no answerable form. This is the root of
   the stated complaint that the team does not know what to report.
2. **Distribution has failed, not authoring.** Authoring demonstrably happened
   185 times. Getting content in front of tenants did not — 8 of 16 have nothing.
3. **Tenant isolation is fail-open.** `index.js` appends its `ad_client_id`
   filter only when `authInfo.u.ad_client_id` is present. A token that
   authenticates but carries no `u` claim returns **every tenant's rows**.

### Correct baseline

Two repositories hold the same model at different generations:

| | `cloudempiere/cubejs` (archived) | **this repo** |
|---|---|---|
| Last commit | Nov 2020 | **Apr 2022** |
| Template | 0.19.19 installed, `^0.23` declared | **0.28.19** |
| Config | `index.js` + `new CubejsServer()` | **`cube.js` config file** |
| Security API | `authInfo`, `queryTransformer` | **`securityContext`, `queryRewrite`** |
| Tenant filter | `USER_CONTEXT` — 19 files | **`SECURITY_CONTEXT` — 19 files** |
| Cubes / measures | 27 / 106 | 27 / 106 (+ template sample cube) |

**This repository is the migration baseline.** Three steps are already done here:
the config-file pattern, `securityContext`, and `queryRewrite`.

Two files in the archived repo (`Warehouse.js`, `Doctype.js`) carry later
modification dates and sit uncommitted, which makes them look newer. They are
not: diffing shows the same content with `SECURITY_CONTEXT` reverted to
`USER_CONTEXT`, plus whitespace. Nothing is lost by ignoring them.

`schema/Orders.js` is the Cube starter template's sample cube
(`SELECT 1 AS id, 100 AS amount ...`). Delete it during the port.

**Both repositories carry the same fail-open defect.** The 2022 rewrite
modernised the API and preserved the hole:

```js
if (context.ad_client_id) { query.filters.push({...}); }   // no else
```

**Existing i18n mechanism to preserve.** The 2022 model resolves translations
through the security context, not only tenancy:

```js
JOIN rv_ad_reference_trl ds ON m.docstatus = ds.value::bpchar
  AND ds.ad_reference_id = 131
  AND ${SECURITY_CONTEXT.ad_language.filter('ds.ad_language')}
```

This is the answer to the Slovak/English requirement and must survive the port.
`SECURITY_CONTEXT.x.filter()` is removed in v1.x, so it becomes a
`COMPILE_CONTEXT` reference or a query-time parameter.

### Revised migration gap

Because the baseline is 0.28 rather than 0.19, the remaining work is smaller:

| Remaining | Files affected |
|---|---|
| `measureReferences` / `dimensionReferences` → `measures` / `dimensions` | 20 |
| Remove `external: true` — Cube Store is the default | 22 |
| `belongsTo` → `many_to_one` | 21 |
| `SECURITY_CONTEXT` → `COMPILE_CONTEXT` / `access_policy` | 19 |
| `schema/*.js` → `model/cubes/*.yml`, `model/views/*.yml` | all |
| Replace fail-open filter with deny-by-default policy | `cube.js` |


### Verified constraints from the local migration (2026-08-15)

Established by running Cube 1.7.19 against a full production copy
(16 tenants, 11.2M order lines) - not from documentation.

**1. `access_policy` templating works only in YAML, not JavaScript.**

The same policy in each format produces:

```
JS model     params: ['{ securityContext.ad_language }']   <- literal, not resolved
YAML model   params: ['sk_SK']                             <- resolved
```

In JS the template passes through uninterpolated, yielding
`WHERE x = '{ securityContext.x }'`, which matches **zero rows, silently**.

Consequence: **every cube carrying an access policy must be YAML.** That is
every fact cube, because tenant isolation is an access policy. The mechanical
JS conversion is still useful to get cubes compiling, but the security layer
forces YAML. This overrides any "JS first" sequencing.

**2. `access_policy` uses `group:`, not `role:`.**

The compiler rejects `role:` with *"must contain at least one of [group, groups]"*.
Earlier revisions of this ADR and the plan specified `role:`; both are corrected.

**3. Imports resolve relative to the model root, not the importing file.**

`model/cubes/x.js` importing `./helpers` resolves to `model/helpers.js`, not a
sibling. The error - *"Required import for helpers.js is not found"* - does not
hint at this.

**4. A member may not reference a foreign cube.** 45 occurrences across the
model. The documented replacement is a view with `join_path` + `prefix`. Joins
*must* reference foreign cubes, so any automated fix must scope itself to
`dimensions` and `measures` only.

**5. Translations: language as a dimension, filtered by access policy.**

iDempiere holds translations in 127 `_trl` tables; the model uses one,
`rv_ad_reference_trl`, across 24 joins and 11 domains, in 5 installed languages.

Joining without a language predicate multiplies the fact table 5x - measured at
11,239,592 order lines becoming 56,197,976. Filtering by language via
`COMPILE_CONTEXT` avoids that but compiles a separate model *and* a separate
pre-aggregation set per language: 16 tenants x 5 languages = 80 variants.

Pivoting translations into columns avoids both but hardcodes the language list
into SQL, so a sixth language means editing every cube.

**The resolution: keep `ad_language` as an ordinary dimension on a lookup cube
and let `access_policy` filter it.** Verified: the policy applies on join, so a
joining fact sees one row per code and there is no fan-out. Unlimited languages,
nothing hardcoded, one compiled model, one rollup set.

`ad_language` must therefore NOT appear in `contextToAppId`.

**6. Defects found in the 2022 baseline, not introduced by the migration.**

- `schema/OrderFacts.js:81` contains a hardcoded `limit 100` inside the cube SQL,
  from commit `0862521` *"experimental, huge data transfer limit"*. Every
  Orderfacts query silently returned 100 rows' worth of data against 11.2M lines.
  Not present in the 2020 repo.
- Four `ad_language='sk_SK'` literals in the same file, while sibling cubes use
  the language context - i18n was already inconsistent.
- Two translation joins were `JOIN` rather than `LEFT JOIN`, silently dropping
  order lines with no translation. Correcting them recovered 12 rows.

### Verified constraints, second pass (2026-08-16)

Every one of these was found by running the system, and **none produced an
error**. Each returned a plausible number, or nothing at all.

**8. A rollup matches only when every filtered member is one of its dimensions.**

`queryRewrite` filtered `Client.ad_client_id` while the rollups were keyed on
`<Cube>.ad_client_id`. No rollup ever matched, so every query read the 11.2M-row
source and returned correct numbers. Adding per-cube `access_policy` later
reintroduced the same fault from the other side, because the policy filters the
cube's own column. **Both members must be rollup dimensions while both filters
exist.**

**9. Cube does not read outside a rollup's build range.**

The documentation is explicit: results outside `build_range_start`/`_end` are
not returned, which "can lead to an empty result set". It does not fall back to
source. With the floor moved to 2015 as an optimisation, tenant 1000015 asked
for 2010-2026 and received 4,391,856 instead of 4,479,064; asked for 2010-2012
it received **0** instead of 14,566. **`build_range_start` must equal the cube's
own SQL floor**, and `scripts/verify-rollups.mjs` now asserts that from source
rather than by probing, because a truncating configuration answers correctly
until older data arrives.

**10. `rollup_lambda` with `union_with_source_data` does not engage here.**

The documented remedy for constraint 9. Implemented and tested against
Orderfacts with the range cut to 2023: the planner kept selecting the plain
rollup, the lambda appeared in no log line, and 2010-2012 still returned 0.
Not shipped. The backfill was made tractable a different way - **yearly instead
of monthly partitioning**, cutting a cold build from ~2,244 partitions
(~12 hours) to ~189 (~1 hour) with no data excluded.

**11. Segments compare the raw column, not the dimension.**

Three of five segment-bearing cubes were broken. `Orderfacts.Sales` compared
`= 'true'` against a column holding `'Y'`/`'N'` and returned **zero rows for
years**. `Cashflowplan` referenced a column renamed during the translation
rewiring. `Factacct` compared a column never selected in the cube SQL. Measure
tests stayed green throughout all three.

**12. `type: boolean` converts iDempiere's `'Y'`/`'N'` unaided.**

Proven by `Businesspartner.isCustomer`, which reads a `character` column with no
CASE and returns `'true'`/`'false'` identically to the CASE-based dimensions.
Twenty such conversions were redundant. Two were not and stayed: one maps an
arbitrary product attribute, the other is a compound business rule.

**13. Model files cannot read `process.env`.**

A probe returned `NO_PROCESS_ENV`. Only `cube.js` sees the environment, so any
value the model needs must be a literal or arrive via `COMPILE_CONTEXT`.

**14. `contextToAppId` must be constant unless the model actually varies.**

It keyed on `ad_client_id`, compiling sixteen byte-identical models. Cube also
requires `scheduledRefreshContexts` whenever the security context feeds
`contextToAppId`, warning the context is otherwise undefined during refresh -
that was unset. Nothing broke, because one build genuinely serves every tenant,
but only by accident of the model being uniform. Now constant.

**15. `access_policy` denies by default - but only where it exists.**

"When you define access policies for specific groups, access is automatically
denied to all other groups." Cubes with **no** policy are unaffected and stay
fully readable. Fifteen cubes still have none, so `queryRewrite` cannot be
removed yet - see the warning at the top of `cube/cube.js`.

### Verification harness

19 cases in `cube/scripts/cases/`, each comparing Cube's answer against
reference SQL run directly on Postgres - the only check independent of Cube's
planner. There is no bypass through the query API: rollup coverage is total, so
asking the same question twice simply answers from the rollup twice.

Covering measures, segments, a credit-memo sign flip and view join fan-out.
Nine of forty-four entities; four views remain uncovered.


### Tenant isolation: the rule

**`ad_client_id IN (tenant, 0)`** — iDempiere's own convention, and it holds
for every cube, so no per-cube exemption list is needed.

| | System rows (`ad_client_id = 0`) | Filter |
|---|---|---|
| Transactional facts | `c_order` 0, `c_invoice` 0, `m_movement` 0 | tenant only, in effect |
| Master and reference | `ad_ref_list` 3,232, `c_uom` 37, `ad_org` 1, `c_bpartner` 2 | tenant **plus** system defaults |

Because the fact tables contain no system rows, including `0` is harmless
there; because master data does, omitting it makes shared defaults invisible.
One rule covers both.

An earlier revision maintained an explicit list of "system cubes" to exempt
from the tenant filter. That was a maintenance hazard — register a new lookup
cube late and every query touching it fails — and it has been removed.

**A regression this restores.** The 2020 model filtered
`values: [user.ad_client_id, 0]`. The 2022 rewrite dropped the zero:

```js
// 2020
values: [user.ad_client_id, 0]
// 2022
values: [context.ad_client_id]
```

So since 2022 every system-owned reference value, 37 units of measure and the
system organisation have been invisible to queries. On this point the older
model was the more correct one — worth remembering when treating the 2022
repository as strictly newer.


### Constraints

Nine are given; one is a choice.

**Non-negotiable**
- Tenant isolation cannot fail open — 16 tenants share one database.
- Numbers must reconcile with the ERP. A dashboard disagreeing with the source
  document destroys trust permanently.

**Environmental**
- The source is a live 154 GB operational ERP — it cannot absorb analytical load.
- The schema is non-standard: custom plugins add requests, baskets, WCS, loyalty,
  POS, projects and freight. **No purchased content pack can fit it.**
- The Application Dictionary changes across iDempiere versions.
- Content is bilingual, Slovak and English.

**Capability**
- There is **no business analytics specialist**, and consultants are billable.
- Whatever is built must survive the people who build it.

**Commercial**
- Cost must scale per tenant, not per seat.
- 185 charts and 106 measures represent years of encoded domain knowledge and
  cannot be discarded.

**The single open choice:** whether "data stays internal" is a hard requirement.

### The business case, run honestly

```
Today      ~20 new KPIs/year × 1–2 days        €8,000–16,000/year
After      same KPIs, mostly minutes           €2,000–4,000/year
Saving                                         €6,000–12,000/year

Against    build                               €27,000–44,000
           ongoing catalogue maintenance       €15,000/year
Verdict    the saving does not cover maintenance, let alone the build
```

**On efficiency alone this is not a positive business case.** It pays only if it
changes something commercial — tenants paying for analytics, deals won, churn
reduced. None of that is yet evidenced.

---

## Decision

### 1. Data moves outside iDempiere, reachable over APIs

Metric definitions and query serving leave the ERP so they can be consumed by
`cloudempiere/clde-nx-monorepo`, BI tools, Excel and AI agents. Extraction is by
**PostgreSQL streaming replication to a read replica** — no ETL pipeline, no
warehouse, no transformation layer to operate.

**Consuming repository:** `clde-nx-monorepo` — Nx workspace, Angular **21.2.7**,
five apps: `cms`, `corporate`, `ecommerce`, `mobile`, `portal`.

It currently has **no `@cubejs-client` dependency**, so the integration there is
greenfield: `@cubejs-client/ngx` plus a token-minting endpoint in the Fastify SSR
layer that already holds the session. Two consequences worth recording:

- The **`mobile`** app makes a third render target alongside Angular web and ZK.
  That strengthens the case for the Angular Elements renderer over a Superset
  iframe embed, since an iframe serves mobile poorly.
- Five apps means the token-minting endpoint should be a shared library, not
  duplicated per app.

### 2. Cube Core, self-hosted — not Cube Cloud

Cube **Core** (Apache 2.0) is the semantic layer. Verified for this context:

- **SQL API is in Core** (`CUBEJS_PG_SQL_PORT`, Postgres wire protocol) — so
  Superset, Metabase, Excel and Power BI can connect.
- **`access_policy` is in Core** since v1.2 — `member_level`, `row_level`,
  masking. Tenant isolation is free and self-hosted.
- REST, GraphQL, Cube Store pre-aggregations, full multi-tenancy: all in Core.

Cube Cloud is rejected on cost for now:

```
STARTER   2 devs × $40 + ~3,500 CCU × $0.10        ~$430/mo   (no embedding)
PREMIUM   $10,000/yr commitment + seats + CCU    ~$20,000/yr  (embedding required)
UNKNOWN   if embedded viewers are seat-billed:
          269 users × $20/mo                       $64,000/yr  ← must confirm
```

Core costs €155–525/month in infrastructure, with no licence and no commitment.

### 3. Identity stays in iDempiere

Cube Core has no user store, and that is correct here. `AD_User` and `AD_Role`
remain the source of truth:

```
AD_User / AD_Role → JWT claims → contextToGroups → access_policy
```

A second identity store would be worse than none.

### 4. A shared model, not a model per tenant

At 16 tenants both work, but per-tenant models mean **N pre-aggregation builds
per refresh cycle** and require `scheduledRefreshContexts` to enumerate every
tenant or rollups silently never build. One shared model with `row_level`
policies on `ad_client_id` is the default. Physical separation only if a tenant
contractually requires it.

### 5. Scope is gated by a commercial trigger

```
DEFAULT    no customer money  →  internal only
                                  read replica + Metabase/Superset
                                  + MCP chart generator + rolloutToTenants

TRIGGER    customer pays      →  prototype Cube Core self-hosted
                                  ~€155/month, 2–3 person-weeks
```

**The trigger must be written down as a testable condition** — a signed pilot, a
paid add-on, or a deal naming analytics as a requirement. "Customers seem
interested" is not a trigger and will not fire.

### 6. Presentation is a separate decision from definition

Cube Core ships no UI by design. Charts and dashboards come from Superset
(internal, days of work, iframe) or a purpose-built Angular Elements renderer
(tenant-facing, 6–12 person-weeks, native DOM, hostable in ZK as web components).
Chosen by audience, not globally.

---

## Alternatives Considered

### A. Keep `AD_Chart` as the definition layer, add a Quarkus GraphQL + MCP API

**Pros**
- Definitions stay where domain experts already work
- `AD_Role` keeps enforcing access for free; drill-to-record stays native
- All 185 charts become reusable immediately; ships via 2Pack
- Entirely inside the perimeter; €8–16k development, no subscription

**Cons**
- **No composability.** `AD_Chart` returns the chart someone defined. Every new
  question is still a new `AD_Chart` — the "slow development" complaint unchanged.
- Exposes the sprawl over HTTP rather than reconciling it; 185 definitions still drift
- An agent gets **185 fixed answers**, never an answer to an unanticipated question
- You own auth, tenancy, caching, pagination and versioning forever
- "Improving the source" until charts stop carrying bespoke joins **is** building a
  semantic layer, without the tooling that makes it composable or testable

**Verdict:** a good bridge, a poor destination. Retained as the fallback if the
trigger never fires.

### B. Superset or Metabase directly on the read replica, no semantic layer

**Pros**
- Days of work, free, self-hosted, stays internal
- Far better visuals and interactivity than ZK; genuine self-service exploration
- The advice most other iDempiere shops give, and correct for internal reporting

**Cons**
- **Metabase open source cannot do multi-tenant customer-facing analytics** —
  row-level security is Pro-only ($575/mo floor + $12/user, ≈€44k/yr at 269 users,
  which inverts the per-tenant cost constraint). Superset OSS has RLS free.
- Definitions live in the tool — an eighth place a metric can live
- Nothing travels to Angular, Excel or agents
- `AD_Role` re-implemented by hand in the tool

**Verdict:** correct if the answer is "internal reporting only". Adopted as the
**default track**, because it is — and because Superset connects to Cube's SQL
API later without rework.

### C. Cube Cloud

**Pros**
- Workbooks, dashboards, 11 chart types, agents, analytics chat, embedding
- Dashboards-as-code for per-tenant rollout — the measured failure
- Managed Cube Store; no clustering to operate

**Cons**
- Embedding requires Premium: **$10,000/year commitment**, ~$20k/yr all in
- Unresolved whether embedded viewers consume $20/month Viewer seats — $64k/yr at
  269 users if so
- Data leaves the perimeter
- Not justifiable before the commercial case is evidenced

**Verdict:** deferred. The YAML model is identical, so Core → Cloud is a
deployment change, not a rewrite. Revisit when a customer is paying.

### D. Amazon QuickSight

**Pros**
- AWS-native, alongside existing ECS and Terraform practice
- Multi-tenancy via namespaces and RLS tags; `GenerateEmbedURLForAnonymousUser`
  with `SessionTags` needs no account per customer
- Session-capacity pricing from ~$250/month

**Cons**
- A **BI product**, not a semantic layer — no API-first metric layer for Angular
- Cannot serve one definition to a custom UI, a BI tool and an agent simultaneously
- Does not read the 106 existing measures
- Anonymous users cannot hold granular per-dashboard permissions

**Verdict:** rejected. Solves dashboards, not the seven-mechanism problem.

### E. Do nothing

**Pros**
- Zero cost. ZK dashboards work for internal users today.
- Efficiency arithmetic does not justify the alternative.

**Cons**
- 8 of 16 tenants keep getting nothing
- Fail-open isolation remains in production
- Every KPI stays 1–2 days of AD work, forever, compounding nothing
- 106 measures and 185 charts continue to drift

**Verdict:** rejected for the default track's cheap subset (replica + explore +
rollout), which costs ~€150/month and addresses the measured failure.

---

## Consequences

### Positive

- **One definition, many consumers.** Angular, Superset, Excel, Power BI and
  agents read the same measures via REST, GraphQL and the SQL API.
- **Isolation becomes deny-by-default.** `access_policy` denies any member no
  policy grants, removing the fail-open hole by construction rather than by care.
- **106 measures and 33 `PA_MeasureCalc` definitions are recovered**, not
  rewritten. The measure calculations already separate select clause, where
  clause, date column and org column — most of a Cube measure.
- **Portability is preserved.** Core → Cloud needs no model change; OSI now
  standardises metric interchange, lowering lock-in further.
- **Spend is gated.** Nothing beyond ~€150/month is committed until a customer pays.

### Negative

- **`AD_Role` must be re-expressed** as JWT claims → `contextToGroups` →
  `access_policy`. Free today because iDempiere enforces it. This is the most
  underestimated task in the migration, and being wrong is a breach, not a bug.
- **Drill-to-record must be rebuilt.** Native in ZK; a deep-link convention
  elsewhere. Design it early — retrofitting across surfaces is worse.
- **Operations become ours.** Cube Store, upgrades, monitoring: ~0.1–0.2 FTE.
- **Catalogue maintenance is permanent, ~0.3 FTE.** An unmaintained metric
  catalogue rots within a year, returning us to drift with more infrastructure.
  This line item gets cut first and must not be.
- **A third config location appears** — Cube measures, Superset chart config,
  `AD_Chart` if retained. Better than seven, but `AD_Chart` should be *generated*
  from Cube rather than left running in parallel.

### Neutral / to be confirmed

- **Does Cube bill embedded viewers as seats?** Difference between $20k and $85k
  per year. Requires an answer from Cube sales before any Cloud decision.
- **Do tenant customers need to explore, or only view?** The single question that
  changes the plan; exploration mandates the semantic layer, viewing does not.
- **Currency.** `OrderFacts` multiplies price × quantity with no conversion.
  Latent while tenants are single-currency; wrong the moment one is not.
- **Custom plugin domains are unmodelled** — requests, baskets, WCS, loyalty, POS,
  projects, freight. Zero Cube coverage, richest chart coverage, and the actual
  differentiators. No vendor content will ever cover them.

### Explicitly out of scope

The 178 `PA_Report` financial reports are a statutory asset built on report line
and column sets. A semantic layer does not replace them and will not try.

---

## Implementation

See `docs/superpowers/plans/2026-08-15-cube-migration.md`.
