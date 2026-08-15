# Cube Migration, Self-Deployment and Local Testing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up Cube Core 1.x locally on macOS, migrate a proven vertical slice of the 2020 model with verified numbers, replace fail-open tenant isolation with deny-by-default access policies, and deploy the result self-hosted.

**Architecture:** A new `cube/` directory alongside the existing `schema/` — nothing is overwritten. Cube Core reads a PostgreSQL read replica (locally, the existing copy on port 5437). Metric definitions live in `cube/model/cubes/*.yml`; the user-facing contract lives in `cube/model/views/*.yml`. Identity stays in iDempiere: `AD_User`/`AD_Role` → JWT claims → `contextToGroups` → `access_policy`. Every ported measure is verified against the original SQL by an automated harness before it is trusted.

**Tech Stack:** Cube Core 1.x (`cubejs/cube`, `cubejs/cubestore`), PostgreSQL 15+, Docker Compose, Node 20+ (local: v25.2.1, Docker 29.7.2 confirmed present).

**Spec:** `docs/ADR-001-cube-semantic-layer.md`

## Source baseline

**Port from `./schema/` in this repository.** It is April 2022, template 0.28.19,
and already completed three migration steps: the `cube.js` config pattern,
`securityContext`, and `queryRewrite`. Throughout this plan, "the source" means
`./schema/<File>.js`.

Do **not** port from `cloudempiere/cubejs` — November 2020, template 0.19/0.23,
archived. Its two files with later modification dates (`Warehouse.js`,
`Doctype.js`, uncommitted there) are **not** newer in content: same code with
`SECURITY_CONTEXT` reverted to `USER_CONTEXT`. Verified by diff.

`./schema/Orders.js` is the Cube starter template's sample cube
(`SELECT 1 AS id, 100 AS amount UNION ALL ...`). Do not port it; delete it.

## Global Constraints

- **Never overwrite `./schema/` or `./cube.js`.** All new work lives in `cube/`. The 0.28 model stays readable as the reference implementation until the port is validated.
- **Preserve the language mechanism.** The 2022 source resolves translations via `${SECURITY_CONTEXT.ad_language.filter('ds.ad_language')}` joined to `rv_ad_reference_trl`. `SECURITY_CONTEXT.x.filter()` is removed in v1.x; carry the behaviour forward as a `COMPILE_CONTEXT` reference or a query-time parameter. Do not silently drop it — it is the Slovak/English implementation.
- **No measure ships unverified.** Every ported measure passes `scripts/validate.mjs` against the original SQL before the task is complete.
- **Deny-by-default isolation.** A security context without `ad_client_id` must return **zero rows**, never all rows. This is the defect being fixed; a test asserts it.
- **YAML, snake_case.** Cube 1.x model syntax: `primary_key`, `public`, `many_to_one` — not `primaryKey`, `shown`, `belongsTo`.
- **`host.docker.internal`, never `localhost`,** for database host inside containers on macOS.
- **Filter `docstatus`.** Completed and Closed (`CO`, `CL`) only, unless a measure deliberately includes drafts. Unfiltered document status is the most common cause of a dashboard disagreeing with the ERP.
- **Filter `isactive = 'Y'`** and exclude `ad_client_id = 0` (System rows) in every cube.
- Commit after every task. Conventional Commits.

---

### Task 1: Scaffold the Cube project and prove connectivity

**Files:**
- Create: `cube/docker-compose.yml`
- Create: `cube/.env.example`
- Create: `cube/.gitignore`
- Create: `cube/cube.js`
- Create: `cube/model/cubes/.gitkeep`
- Create: `cube/model/views/.gitkeep`

**Interfaces:**
- Consumes: nothing
- Produces: a running Cube API on `localhost:4000`, SQL API on `localhost:15432`, reading the local `cloudempiere_prod` copy on port 5437.

- [ ] **Step 1: Create the directory and gitignore**

```bash
mkdir -p cube/model/cubes cube/model/views cube/scripts
touch cube/model/cubes/.gitkeep cube/model/views/.gitkeep
cat > cube/.gitignore <<'EOF'
.env
.cubestore/
node_modules/
EOF
```

- [ ] **Step 2: Write `cube/docker-compose.yml`**

```yaml
services:
  cube:
    image: cubejs/cube:latest
    ports:
      - "4000:4000"
      - "15432:15432"
    env_file: .env
    volumes:
      - ./model:/cube/conf/model
      - ./cube.js:/cube/conf/cube.js
```

- [ ] **Step 3: Write `cube/.env.example`**

```bash
CUBEJS_DEV_MODE=true
CUBEJS_DB_TYPE=postgres
CUBEJS_DB_HOST=host.docker.internal
CUBEJS_DB_PORT=5437
CUBEJS_DB_NAME=cloudempiere_prod
CUBEJS_DB_USER=cubejsrole
CUBEJS_DB_PASS=changeme
CUBEJS_API_SECRET=changeme-long-random-string
CUBEJS_PG_SQL_PORT=15432
CUBEJS_LOG_LEVEL=info
```

- [ ] **Step 4: Write a minimal `cube/cube.js`**

```javascript
module.exports = {};
```

- [ ] **Step 5: Create the real `.env` and start**

```bash
cd cube
cp .env.example .env
# edit .env: set CUBEJS_DB_PASS and CUBEJS_API_SECRET
docker compose up -d
```

- [ ] **Step 6: Verify the API answers**

Run: `curl -s http://localhost:4000/readyz`
Expected: `{"health":"HEALTH"}`

If this fails with a connection error, PostgreSQL is not accepting the Docker network. Set `listen_addresses = '*'` in `postgresql.conf` and add `host all all 172.16.0.0/12 md5` to `pg_hba.conf`, then restart PostgreSQL.

- [ ] **Step 7: Verify the SQL API answers**

Run: `psql -h localhost -p 15432 -U cube -c "SELECT 1"`
Expected: returns `1`. This is the interface Superset will use — if it does not work, the whole downstream stack fails.

- [ ] **Step 8: Commit**

```bash
git add cube/
git commit -m "feat(cube): scaffold Cube Core 1.x project with docker-compose"
```

---

### Task 2: Build the validation harness before migrating anything

**Files:**
- Create: `cube/scripts/validate.mjs`
- Create: `cube/scripts/cases/README.md`
- Create: `cube/package.json`

**Interfaces:**
- Consumes: the running Cube API from Task 1.
- Produces: `node scripts/validate.mjs <case.json>` — exits 0 when the Cube result matches the reference SQL within tolerance, 1 otherwise. Every later task calls this.

**Why this task comes second:** converting 185 charts without an automated comparison produces 185 unverified claims. The harness must exist before volume conversion begins, not after.

- [ ] **Step 1: Write `cube/package.json`**

```json
{
  "name": "cube-clde",
  "private": true,
  "type": "module",
  "scripts": {
    "validate": "node scripts/validate.mjs"
  },
  "dependencies": {
    "pg": "^8.13.0"
  }
}
```

- [ ] **Step 2: Install**

```bash
cd cube && npm install
```

- [ ] **Step 3: Write the failing test case**

Create `cube/scripts/cases/smoke.json` — deliberately wrong, to prove the harness detects mismatches:

```json
{
  "name": "smoke — deliberately wrong, must FAIL",
  "cubeQuery": { "measures": ["client.count"] },
  "referenceSql": "SELECT 999999 AS value",
  "tolerance": 0
}
```

- [ ] **Step 4: Write `cube/scripts/validate.mjs`**

```javascript
import fs from 'node:fs';
import pg from 'pg';

const CUBE_URL = process.env.CUBE_URL ?? 'http://localhost:4000/cubejs-api/v1/load';
const TOKEN = process.env.CUBE_TOKEN ?? '';

const caseFile = process.argv[2];
if (!caseFile) {
  console.error('usage: node scripts/validate.mjs <case.json>');
  process.exit(2);
}
const testCase = JSON.parse(fs.readFileSync(caseFile, 'utf8'));

async function fromCube(query) {
  const res = await fetch(CUBE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: TOKEN },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Cube HTTP ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (body.error) throw new Error(`Cube error: ${body.error}`);
  const row = body.data[0];
  if (!row) return 0;
  return Number(Object.values(row)[0]);
}

async function fromSql(sql) {
  const client = new pg.Client({
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5437),
    database: process.env.PGDATABASE ?? 'cloudempiere_prod',
    user: process.env.PGUSER ?? 'cubejsrole',
    password: process.env.PGPASSWORD,
  });
  await client.connect();
  try {
    const { rows } = await client.query(sql);
    return Number(Object.values(rows[0])[0]);
  } finally {
    await client.end();
  }
}

const [cubeValue, sqlValue] = await Promise.all([
  fromCube(testCase.cubeQuery),
  fromSql(testCase.referenceSql),
]);

const tolerance = testCase.tolerance ?? 0.01;
const diff = Math.abs(cubeValue - sqlValue);
const scale = Math.max(Math.abs(sqlValue), 1);
const pass = diff / scale <= tolerance;

console.log(`case:      ${testCase.name}`);
console.log(`cube:      ${cubeValue}`);
console.log(`reference: ${sqlValue}`);
console.log(`delta:     ${diff} (${((diff / scale) * 100).toFixed(4)}%)`);
console.log(pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
```

- [ ] **Step 5: Write `cube/scripts/cases/README.md`**

```markdown
# Validation cases

One JSON file per ported measure. Each compares a Cube query against the
reference SQL taken from the 2020 model, a `PA_MeasureCalc` select clause,
or an `AD_ChartDatasource` query.

    { "name": "...", "cubeQuery": {...}, "referenceSql": "...", "tolerance": 0.01 }

Run one:   npm run validate -- scripts/cases/<file>.json
Run all:   for f in scripts/cases/*.json; do npm run validate -- "$f" || exit 1; done

A measure is not migrated until its case passes.
```

- [ ] **Step 6: Run the smoke case and confirm it FAILS**

Run: `cd cube && npm run validate -- scripts/cases/smoke.json`
Expected: exits non-zero. It will error on `client.count` not existing yet — that is correct; the harness must refuse to pass when the measure is absent.

- [ ] **Step 7: Commit**

```bash
git add cube/package.json cube/package-lock.json cube/scripts/
git commit -m "feat(cube): add measure validation harness"
```

---

### Task 3: Port the conformed dimensions — Client, Organization, Product

**Files:**
- Create: `cube/model/cubes/client.yml`
- Create: `cube/model/cubes/organization.yml`
- Create: `cube/model/cubes/product.yml`
- Create: `cube/scripts/cases/client-count.json`
- Reference: `schema/Client.js`, `schema/Organization.js`, `schema/MProduct.js`

**Interfaces:**
- Consumes: Task 1 environment, Task 2 harness.
- Produces: cubes `client`, `organization`, `product`. Later tasks join to these by `ad_client_id`, `ad_org_id`, `m_product_id`.

- [ ] **Step 1: Write the failing validation case**

Create `cube/scripts/cases/client-count.json`:

```json
{
  "name": "client.count equals active tenant count",
  "cubeQuery": { "measures": ["client.count"] },
  "referenceSql": "SELECT count(*) AS value FROM ad_client WHERE isactive='Y' AND ad_client_id > 0",
  "tolerance": 0
}
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd cube && npm run validate -- scripts/cases/client-count.json`
Expected: FAIL — `client.count` does not exist yet.

- [ ] **Step 3: Write `cube/model/cubes/client.yml`**

```yaml
cubes:
  - name: client
    title: Tenant
    description: All tenant-level information
    sql: >
      SELECT ad_client_id, created, updated, name
      FROM ad_client
      WHERE isactive = 'Y' AND ad_client_id > 0

    refresh_key:
      every: 1 hour

    dimensions:
      - name: ad_client_id
        title: Tenant ID
        sql: ad_client_id
        type: number
        primary_key: true
        public: true

      - name: name
        title: Tenant
        sql: name
        type: string

    measures:
      - name: count
        title: Total Tenants
        type: count
```

- [ ] **Step 4: Run the validation case again**

Run: `cd cube && npm run validate -- scripts/cases/client-count.json`
Expected: PASS

- [ ] **Step 5: Write `cube/model/cubes/organization.yml`**

```yaml
cubes:
  - name: organization
    title: Organization
    sql: >
      SELECT ad_org_id, ad_client_id, value, name, isactive
      FROM ad_org
      WHERE isactive = 'Y' AND ad_client_id > 0

    joins:
      - name: client
        relationship: many_to_one
        sql: "{CUBE}.ad_client_id = {client}.ad_client_id"

    dimensions:
      - name: ad_org_id
        sql: ad_org_id
        type: number
        primary_key: true
        public: true

      - name: ad_client_id
        sql: ad_client_id
        type: number
        public: false

      - name: name
        title: Organization
        sql: name
        type: string

    measures:
      - name: count
        type: count
```

- [ ] **Step 6: Write `cube/model/cubes/product.yml`**

```yaml
cubes:
  - name: product
    title: Product
    sql: >
      SELECT p.m_product_id, p.ad_client_id, p.value, p.name,
             p.m_product_category_id, pc.name AS category_name,
             p.weight, p.volume
      FROM m_product p
      LEFT JOIN m_product_category pc
             ON pc.m_product_category_id = p.m_product_category_id
      WHERE p.isactive = 'Y' AND p.ad_client_id > 0

    joins:
      - name: client
        relationship: many_to_one
        sql: "{CUBE}.ad_client_id = {client}.ad_client_id"

    dimensions:
      - name: m_product_id
        sql: m_product_id
        type: number
        primary_key: true
        public: true

      - name: ad_client_id
        sql: ad_client_id
        type: number
        public: false

      - name: value
        title: Product Key
        sql: value
        type: string

      - name: name
        title: Product
        sql: name
        type: string

      - name: category_name
        title: Product Category
        sql: category_name
        type: string

    measures:
      - name: count
        type: count
```

- [ ] **Step 7: Verify all three compile**

Run: `curl -s http://localhost:4000/cubejs-api/v1/meta | python3 -m json.tool | grep '"name"' | head -20`
Expected: `client`, `organization`, `product` appear.

- [ ] **Step 8: Commit**

```bash
git add cube/model/cubes/ cube/scripts/cases/
git commit -m "feat(cube): port client, organization and product dimensions to YAML"
```

---

### Task 4: Port `Invoicefacts` — the first fact cube

**Files:**
- Create: `cube/model/cubes/invoice_facts.yml`
- Create: `cube/scripts/cases/invoice-net-revenue.json`
- Create: `cube/scripts/cases/invoice-count.json`
- Reference: `schema/InvoiceFacts.js` (12 measures)

**Interfaces:**
- Consumes: `client`, `organization`, `product` from Task 3.
- Produces: cube `invoice_facts` with measures `count`, `line_net_amt`, `line_total_amt`, and dimensions `dateinvoiced`, `issotrx`, `docstatus`. Task 6 views reference these names.

**Note on the source:** `schema/InvoiceFacts.js` sign-flips credit memos via `charat(dt.docbasetype,3) = 'C'`. That logic is business-critical and ports verbatim.

- [ ] **Step 1: Write the failing validation cases**

Create `cube/scripts/cases/invoice-net-revenue.json`:

```json
{
  "name": "invoice_facts.line_net_amt matches source SQL, sales only, completed",
  "cubeQuery": {
    "measures": ["invoice_facts.line_net_amt"],
    "filters": [
      { "member": "invoice_facts.issotrx", "operator": "equals", "values": ["true"] }
    ]
  },
  "referenceSql": "SELECT COALESCE(SUM(CASE WHEN substr(dt.docbasetype,3,1)='C' THEN il.linenetamt*-1 ELSE il.linenetamt END),0) AS value FROM c_invoice i JOIN c_invoiceline il ON il.c_invoice_id=i.c_invoice_id JOIN c_doctype dt ON dt.c_doctype_id=i.c_doctype_id WHERE i.isactive='Y' AND il.isactive='Y' AND i.ad_client_id>0 AND i.docstatus IN ('CO','CL') AND dt.issotrx='Y'",
  "tolerance": 0.0001
}
```

Create `cube/scripts/cases/invoice-count.json`:

```json
{
  "name": "invoice_facts.count matches completed invoice line count",
  "cubeQuery": { "measures": ["invoice_facts.count"] },
  "referenceSql": "SELECT count(*) AS value FROM c_invoice i JOIN c_invoiceline il ON il.c_invoice_id=i.c_invoice_id WHERE i.isactive='Y' AND il.isactive='Y' AND i.ad_client_id>0 AND i.docstatus IN ('CO','CL')",
  "tolerance": 0
}
```

- [ ] **Step 2: Run both to confirm they fail**

Run: `cd cube && npm run validate -- scripts/cases/invoice-net-revenue.json`
Expected: FAIL — cube does not exist.

- [ ] **Step 3: Write `cube/model/cubes/invoice_facts.yml`**

```yaml
cubes:
  - name: invoice_facts
    title: Invoices
    description: Invoice lines, sales and purchase, credit memos sign-flipped
    sql: >
      SELECT
        i.ad_client_id,
        i.ad_org_id,
        i.c_invoice_id,
        il.c_invoiceline_id,
        i.dateinvoiced,
        i.docstatus,
        i.c_bpartner_id,
        il.m_product_id,
        dt.issotrx,
        dt.docbasetype,
        CASE WHEN substr(dt.docbasetype, 3, 1) = 'C'
             THEN il.linenetamt * -1 ELSE il.linenetamt END   AS linenetamt,
        CASE WHEN substr(dt.docbasetype, 3, 1) = 'C'
             THEN il.linetotalamt * -1 ELSE il.linetotalamt END AS linetotalamt,
        CASE WHEN substr(dt.docbasetype, 3, 1) = 'C'
             THEN il.qtyinvoiced * -1 ELSE il.qtyinvoiced END  AS qtyinvoiced
      FROM c_invoice i
      JOIN c_invoiceline il ON il.c_invoice_id = i.c_invoice_id
      JOIN c_doctype     dt ON dt.c_doctype_id = i.c_doctype_id
      WHERE i.isactive = 'Y'
        AND il.isactive = 'Y'
        AND i.ad_client_id > 0
        AND i.docstatus IN ('CO', 'CL')

    joins:
      - name: client
        relationship: many_to_one
        sql: "{CUBE}.ad_client_id = {client}.ad_client_id"
      - name: organization
        relationship: many_to_one
        sql: "{CUBE}.ad_org_id = {organization}.ad_org_id"
      - name: product
        relationship: many_to_one
        sql: "{CUBE}.m_product_id = {product}.m_product_id"

    dimensions:
      - name: c_invoiceline_id
        sql: c_invoiceline_id
        type: number
        primary_key: true
        public: true

      - name: ad_client_id
        sql: ad_client_id
        type: number
        public: false

      - name: ad_org_id
        sql: ad_org_id
        type: number
        public: false

      - name: c_invoice_id
        title: Invoice ID
        sql: c_invoice_id
        type: number

      - name: dateinvoiced
        title: Invoice Date
        sql: dateinvoiced
        type: time

      - name: docstatus
        title: Document Status
        sql: docstatus
        type: string

      - name: issotrx
        title: Sales Transaction
        sql: "CASE WHEN {CUBE}.issotrx = 'Y' THEN 'true' ELSE 'false' END"
        type: string

    segments:
      - name: sales
        sql: "{CUBE}.issotrx = 'Y'"
      - name: purchase
        sql: "{CUBE}.issotrx = 'N'"

    measures:
      - name: count
        title: Invoice Lines
        type: count

      - name: line_net_amt
        title: Net Revenue
        sql: linenetamt
        type: sum
        format: currency

      - name: line_total_amt
        title: Gross Revenue
        sql: linetotalamt
        type: sum
        format: currency

      - name: qty_invoiced
        title: Quantity Invoiced
        description: >
          Summing across products with different units of measure is not
          meaningful. Group by product or product category.
        sql: qtyinvoiced
        type: sum

      - name: invoice_count
        title: Invoices
        sql: c_invoice_id
        type: count_distinct
```

- [ ] **Step 4: Run both validation cases**

```bash
cd cube
npm run validate -- scripts/cases/invoice-count.json
npm run validate -- scripts/cases/invoice-net-revenue.json
```
Expected: both PASS.

If `line_net_amt` fails, the cause is almost always `docstatus` or the credit-memo sign flip. Compare the generated SQL: `curl -s -X POST http://localhost:4000/cubejs-api/v1/sql -H 'Content-Type: application/json' -d '{"query":{"measures":["invoice_facts.line_net_amt"]}}'`

- [ ] **Step 5: Commit**

```bash
git add cube/model/cubes/invoice_facts.yml cube/scripts/cases/
git commit -m "feat(cube): port invoice facts with credit-memo sign handling"
```

---

### Task 5: Port `Orderfacts` and the Business Partner dimension

**Files:**
- Create: `cube/model/cubes/business_partner.yml`
- Create: `cube/model/cubes/order_facts.yml`
- Create: `cube/scripts/cases/order-net-amt.json`
- Reference: `schema/OrderFacts.js` (17 measures), `schema/BusinessPartner.js`

**Interfaces:**
- Consumes: `client`, `organization`, `product` from Task 3.
- Produces: cubes `business_partner` and `order_facts`. `order_facts` exposes `line_net_amt`, `qty_ordered`, `qty_delivered`, `dateordered`, and segments `sales` / `purchase`.

- [ ] **Step 1: Write the failing validation case**

Create `cube/scripts/cases/order-net-amt.json`:

```json
{
  "name": "order_facts.line_net_amt matches source SQL, sales only, completed",
  "cubeQuery": {
    "measures": ["order_facts.line_net_amt"],
    "segments": ["order_facts.sales"]
  },
  "referenceSql": "SELECT COALESCE(SUM(ol.linenetamt),0) AS value FROM c_order o JOIN c_orderline ol ON ol.c_order_id=o.c_order_id WHERE o.isactive='Y' AND ol.isactive='Y' AND o.ad_client_id>0 AND o.docstatus IN ('CO','CL') AND o.issotrx='Y'",
  "tolerance": 0.0001
}
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd cube && npm run validate -- scripts/cases/order-net-amt.json`
Expected: FAIL.

- [ ] **Step 3: Write `cube/model/cubes/business_partner.yml`**

```yaml
cubes:
  - name: business_partner
    title: Business Partner
    sql: >
      SELECT c_bpartner_id, ad_client_id, value, name, name2,
             iscustomer, isvendor, isemployee
      FROM c_bpartner
      WHERE isactive = 'Y' AND ad_client_id > 0

    joins:
      - name: client
        relationship: many_to_one
        sql: "{CUBE}.ad_client_id = {client}.ad_client_id"

    dimensions:
      - name: c_bpartner_id
        sql: c_bpartner_id
        type: number
        primary_key: true
        public: true

      - name: ad_client_id
        sql: ad_client_id
        type: number
        public: false

      - name: value
        title: Partner Key
        sql: value
        type: string

      - name: name
        title: Business Partner
        sql: name
        type: string

      - name: is_customer
        title: Customer
        sql: "CASE WHEN {CUBE}.iscustomer = 'Y' THEN 'true' ELSE 'false' END"
        type: string

      - name: is_vendor
        title: Vendor
        sql: "CASE WHEN {CUBE}.isvendor = 'Y' THEN 'true' ELSE 'false' END"
        type: string

    measures:
      - name: count
        type: count
```

- [ ] **Step 4: Write `cube/model/cubes/order_facts.yml`**

```yaml
cubes:
  - name: order_facts
    title: Orders
    description: Order lines, sales and purchase
    sql: >
      SELECT
        o.ad_client_id,
        o.ad_org_id,
        o.c_order_id,
        ol.c_orderline_id,
        o.dateordered,
        o.datepromised,
        o.docstatus,
        o.c_bpartner_id,
        ol.m_product_id,
        o.issotrx,
        ol.linenetamt,
        ol.qtyordered,
        ol.qtydelivered,
        ol.qtyinvoiced,
        ol.priceactual,
        ol.pricelist
      FROM c_order o
      JOIN c_orderline ol ON ol.c_order_id = o.c_order_id
      WHERE o.isactive = 'Y'
        AND ol.isactive = 'Y'
        AND o.ad_client_id > 0
        AND o.docstatus IN ('CO', 'CL')

    joins:
      - name: client
        relationship: many_to_one
        sql: "{CUBE}.ad_client_id = {client}.ad_client_id"
      - name: organization
        relationship: many_to_one
        sql: "{CUBE}.ad_org_id = {organization}.ad_org_id"
      - name: product
        relationship: many_to_one
        sql: "{CUBE}.m_product_id = {product}.m_product_id"
      - name: business_partner
        relationship: many_to_one
        sql: "{CUBE}.c_bpartner_id = {business_partner}.c_bpartner_id"

    dimensions:
      - name: c_orderline_id
        sql: c_orderline_id
        type: number
        primary_key: true
        public: true

      - name: ad_client_id
        sql: ad_client_id
        type: number
        public: false

      - name: ad_org_id
        sql: ad_org_id
        type: number
        public: false

      - name: dateordered
        title: Order Date
        sql: dateordered
        type: time

      - name: datepromised
        title: Promised Date
        sql: datepromised
        type: time

      - name: docstatus
        title: Document Status
        sql: docstatus
        type: string

    segments:
      - name: sales
        sql: "{CUBE}.issotrx = 'Y'"
      - name: purchase
        sql: "{CUBE}.issotrx = 'N'"

    measures:
      - name: count
        title: Order Lines
        type: count

      - name: order_count
        title: Orders
        sql: c_order_id
        type: count_distinct

      - name: line_net_amt
        title: Order Value
        sql: linenetamt
        type: sum
        format: currency

      - name: qty_ordered
        title: Quantity Ordered
        description: >
          Not meaningful summed across products with different units of measure.
        sql: qtyordered
        type: sum

      - name: qty_delivered
        title: Quantity Delivered
        sql: qtydelivered
        type: sum

      - name: qty_to_deliver
        title: Quantity To Deliver
        sql: "{CUBE}.qtyordered - {CUBE}.qtydelivered"
        type: sum

      - name: avg_order_value
        title: Average Order Value
        sql: "{line_net_amt} / NULLIF({order_count}, 0)"
        type: number
        format: currency
```

- [ ] **Step 5: Run the validation case**

Run: `cd cube && npm run validate -- scripts/cases/order-net-amt.json`
Expected: PASS.

- [ ] **Step 6: Run every case to check nothing regressed**

```bash
cd cube
for f in scripts/cases/*.json; do
  [ "$(basename "$f")" = "smoke.json" ] && continue
  npm run validate -- "$f" || { echo "FAILED: $f"; exit 1; }
done
```
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add cube/model/cubes/ cube/scripts/cases/
git commit -m "feat(cube): port order facts and business partner dimension"
```

---

### Task 6: Replace fail-open isolation with deny-by-default access policies

**Files:**
- Modify: `cube/cube.js`
- Modify: `cube/model/cubes/invoice_facts.yml` (add `access_policy`)
- Modify: `cube/model/cubes/order_facts.yml` (add `access_policy`)
- Create: `cube/scripts/test-isolation.mjs`
- Reference: `index.js:17-29` — the defect being fixed

**Interfaces:**
- Consumes: cubes from Tasks 3–5.
- Produces: `contextToGroups` in `cube.js`; `access_policy` blocks on both fact cubes. A JWT without `ad_client_id` returns zero rows.

**The defect:** `index.js` appends its tenant filter only when `authInfo.u.ad_client_id` exists. A token lacking that claim returns every tenant's rows.

- [ ] **Step 1: Write the failing isolation test**

Create `cube/scripts/test-isolation.mjs`:

```javascript
import crypto from 'node:crypto';

const SECRET = process.env.CUBEJS_API_SECRET;
if (!SECRET) { console.error('CUBEJS_API_SECRET not set'); process.exit(2); }

function jwt(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ ...payload, exp: Math.floor(Date.now() / 1000) + 300 });
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

async function rowsFor(payload) {
  const res = await fetch('http://localhost:4000/cubejs-api/v1/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: jwt(payload) },
    body: JSON.stringify({ query: { measures: ['invoice_facts.line_net_amt'] } }),
  });
  const body = await res.json();
  if (body.error) return { denied: true, value: null, error: body.error };
  const row = body.data?.[0];
  return { denied: false, value: row ? Number(Object.values(row)[0]) : 0 };
}

const noClaim = await rowsFor({ sub: 'attacker' });
const withTenant = await rowsFor({ sub: 'user', ad_client_id: 1000000, roles: ['tenant_user'] });

console.log('no ad_client_id claim :', JSON.stringify(noClaim));
console.log('valid tenant claim    :', JSON.stringify(withTenant));

const failOpen = !noClaim.denied && noClaim.value > 0;
if (failOpen) {
  console.log('FAIL — token without ad_client_id returned data. This is the 2020 defect.');
  process.exit(1);
}
console.log('PASS — deny-by-default holds.');
```

- [ ] **Step 2: Run it against the current model and confirm it FAILS**

```bash
cd cube
export CUBEJS_API_SECRET=$(grep CUBEJS_API_SECRET .env | cut -d= -f2)
node scripts/test-isolation.mjs
```
Expected: FAIL — with no access policy defined, any authenticated token sees everything. This reproduces the production defect.

- [ ] **Step 3: Add `contextToGroups` to `cube/cube.js`**

```javascript
module.exports = {
  /**
   * Maps the verified JWT security context onto access-policy groups.
   * Returns an empty array when ad_client_id is absent — no group means no
   * policy matches, and access_policy denies by default.
   */
  contextToGroups: ({ securityContext }) => {
    if (!securityContext?.ad_client_id) return [];
    const roles = Array.isArray(securityContext.roles) ? securityContext.roles : [];
    return ['tenant_user', ...roles];
  },
};
```

- [ ] **Step 4: Add `access_policy` to `cube/model/cubes/invoice_facts.yml`**

Append at the same indentation level as `measures:`:

```yaml
    access_policy:
      - role: tenant_user
        member_level:
          includes: "*"
        row_level:
          filters:
            - member: ad_client_id
              operator: equals
              values: ["{ securityContext.ad_client_id }"]
```

- [ ] **Step 5: Add the identical block to `cube/model/cubes/order_facts.yml`**

```yaml
    access_policy:
      - role: tenant_user
        member_level:
          includes: "*"
        row_level:
          filters:
            - member: ad_client_id
              operator: equals
              values: ["{ securityContext.ad_client_id }"]
```

- [ ] **Step 6: Restart Cube and rerun the isolation test**

```bash
cd cube && docker compose restart cube && sleep 8
node scripts/test-isolation.mjs
```
Expected: PASS — the claimless token is denied or returns zero; the tenant token returns that tenant's total only.

- [ ] **Step 7: Commit**

```bash
git add cube/cube.js cube/model/cubes/ cube/scripts/test-isolation.mjs
git commit -m "fix(cube): replace fail-open tenant filter with deny-by-default access policy"
```

---

### Task 7: Build the Sales and Receivables views

**Files:**
- Create: `cube/model/views/sales.yml`
- Create: `cube/model/views/receivables.yml`

**Interfaces:**
- Consumes: `order_facts`, `invoice_facts`, `business_partner`, `product`, `organization` from Tasks 3–5.
- Produces: views `sales` and `receivables` — the user-facing contract that Superset and Angular query, and the only surface AI context attaches to.

**Why views matter:** cubes are a modelling artifact. Views are the product. `ai_context` at cube level is not consumed by agents — it must live on views and members.

- [ ] **Step 1: Write `cube/model/views/sales.yml`**

```yaml
views:
  - name: sales
    title: Sales
    description: >
      Order and invoice activity for completed sales documents. Use for revenue,
      order value, delivery backlog and customer ranking.

    cubes:
      - join_path: order_facts
        includes:
          - line_net_amt
          - order_count
          - qty_ordered
          - qty_delivered
          - qty_to_deliver
          - avg_order_value
          - dateordered
          - datepromised

      - join_path: order_facts.business_partner
        prefix: true
        includes:
          - name
          - value

      - join_path: order_facts.product
        prefix: true
        includes:
          - name
          - category_name

      - join_path: order_facts.organization
        prefix: true
        includes:
          - name
```

- [ ] **Step 2: Write `cube/model/views/receivables.yml`**

```yaml
views:
  - name: receivables
    title: Receivables
    description: >
      Invoiced revenue and outstanding balances. Credit memos are sign-flipped,
      so sums are net. Only Completed and Closed documents are included.

    cubes:
      - join_path: invoice_facts
        includes:
          - line_net_amt
          - line_total_amt
          - invoice_count
          - count
          - dateinvoiced
          - docstatus

      - join_path: invoice_facts.business_partner
        prefix: true
        includes:
          - name
          - value

      - join_path: invoice_facts.organization
        prefix: true
        includes:
          - name
```

- [ ] **Step 3: Verify both views compile and expose members**

Run: `curl -s http://localhost:4000/cubejs-api/v1/meta | python3 -c "import json,sys; d=json.load(sys.stdin); print([c['name'] for c in d['cubes']])"`
Expected: `sales` and `receivables` appear alongside the cubes.

- [ ] **Step 4: Query a view end to end**

```bash
curl -s -X POST http://localhost:4000/cubejs-api/v1/load \
  -H 'Content-Type: application/json' \
  -d '{"query":{"measures":["sales.line_net_amt"],"timeDimensions":[{"dimension":"sales.dateordered","granularity":"month","dateRange":"Last 12 months"}]}}' \
  | python3 -m json.tool | head -30
```
Expected: twelve monthly rows.

- [ ] **Step 5: Commit**

```bash
git add cube/model/views/
git commit -m "feat(cube): add sales and receivables views"
```

---

### Task 8: Add Cube Store and one pre-aggregation

**Files:**
- Modify: `cube/docker-compose.yml`
- Modify: `cube/model/cubes/order_facts.yml` (add `pre_aggregations`)

**Interfaces:**
- Consumes: everything above.
- Produces: a Cube Store cluster and a verified rollup hit on `order_facts`.

- [ ] **Step 1: Add Cube Store services to `cube/docker-compose.yml`**

Replace the file with:

```yaml
services:
  cube:
    image: cubejs/cube:latest
    ports:
      - "4000:4000"
      - "15432:15432"
    env_file: .env
    environment:
      - CUBEJS_CUBESTORE_HOST=cubestore_router
      - CUBEJS_CUBESTORE_PORT=3030
    volumes:
      - ./model:/cube/conf/model
      - ./cube.js:/cube/conf/cube.js
    depends_on:
      - cubestore_router

  cubestore_router:
    image: cubejs/cubestore:latest
    environment:
      - CUBESTORE_SERVER_NAME=cubestore_router:9999
      - CUBESTORE_META_PORT=9999
      - CUBESTORE_WORKERS=cubestore_worker_1:10001
      - CUBESTORE_REMOTE_DIR=/cube/data
    volumes:
      - ./.cubestore:/cube/data

  cubestore_worker_1:
    image: cubejs/cubestore:latest
    environment:
      - CUBESTORE_SERVER_NAME=cubestore_worker_1:10001
      - CUBESTORE_WORKER_PORT=10001
      - CUBESTORE_META_ADDR=cubestore_router:9999
      - CUBESTORE_WORKERS=cubestore_worker_1:10001
      - CUBESTORE_REMOTE_DIR=/cube/data
    volumes:
      - ./.cubestore:/cube/data
    depends_on:
      - cubestore_router
```

On Apple Silicon, if either Cube Store container exits immediately, add `platform: linux/amd64` to that service.

- [ ] **Step 2: Add a pre-aggregation to `cube/model/cubes/order_facts.yml`**

Append at the same indentation level as `measures:`:

```yaml
    pre_aggregations:
      - name: monthly_by_tenant
        measures:
          - line_net_amt
          - order_count
        dimensions:
          - ad_client_id
        time_dimension: dateordered
        granularity: month
        partition_granularity: year
        refresh_key:
          every: 1 hour
```

`ad_client_id` is included as a dimension so one shared rollup serves every tenant — the shared-model decision from ADR-001.

- [ ] **Step 3: Restart and wait for the build**

```bash
cd cube && docker compose up -d && sleep 20
curl -s http://localhost:4000/cubejs-api/v1/pre-aggregations/jobs | python3 -m json.tool | head -20
```
Expected: a job for `monthly_by_tenant`, eventually `"status": "done"`.

- [ ] **Step 4: Confirm the query hits the pre-aggregation**

```bash
curl -s -X POST http://localhost:4000/cubejs-api/v1/load \
  -H 'Content-Type: application/json' \
  -d '{"query":{"measures":["order_facts.line_net_amt"],"dimensions":["order_facts.ad_client_id"],"timeDimensions":[{"dimension":"order_facts.dateordered","granularity":"month"}]}}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('preAgg used:', d.get('usedPreAggregations'))"
```
Expected: a non-empty `usedPreAggregations` object. If empty, the query does not match the rollup — the measures, dimensions and granularity must all be covered.

- [ ] **Step 5: Rerun all validation cases against the accelerated model**

```bash
cd cube
for f in scripts/cases/*.json; do
  [ "$(basename "$f")" = "smoke.json" ] && continue
  npm run validate -- "$f" || { echo "FAILED: $f"; exit 1; }
done
```
Expected: all PASS. Pre-aggregation must not change any number.

- [ ] **Step 6: Commit**

```bash
git add cube/docker-compose.yml cube/model/cubes/order_facts.yml
git commit -m "feat(cube): add Cube Store and shared monthly pre-aggregation"
```

---

### Task 9: Connect Superset over the SQL API

**Files:**
- Create: `cube/docker-compose.superset.yml`

**Interfaces:**
- Consumes: the SQL API on port 15432 from Task 1.
- Produces: a running Superset able to query `sales` and `receivables` as if they were Postgres tables.

**Why this task exists:** ADR-001 depends on Superset connecting to Cube Core. This proves it before anything is built on the assumption.

- [ ] **Step 1: Write `cube/docker-compose.superset.yml`**

```yaml
services:
  superset:
    image: apache/superset:latest
    ports:
      - "8088:8088"
    environment:
      - SUPERSET_SECRET_KEY=local-dev-only-change-me
    command: >
      bash -c "superset db upgrade &&
               superset fab create-admin --username admin --firstname A --lastname D
                 --email admin@local --password admin || true &&
               superset init &&
               superset run -h 0.0.0.0 -p 8088"
```

- [ ] **Step 2: Start Superset**

```bash
cd cube && docker compose -f docker-compose.superset.yml up -d && sleep 60
```

- [ ] **Step 3: Add Cube as a database connection**

Open `http://localhost:8088`, log in as `admin` / `admin`, then **Settings → Database Connections → + Database → PostgreSQL** with:

```
HOST     host.docker.internal
PORT     15432
DATABASE cube
USERNAME cube
PASSWORD (leave empty in dev mode)
```

- [ ] **Step 4: Verify the views are visible**

In Superset **SQL Lab**, run:

```sql
SELECT * FROM sales LIMIT 10;
```
Expected: rows returned. The Cube view appears to Superset as a table.

- [ ] **Step 5: Build one chart against `receivables`**

Create a chart on the `receivables` dataset showing `line_net_amt` by `dateinvoiced` (month). Confirm it renders.

- [ ] **Step 6: Commit**

```bash
git add cube/docker-compose.superset.yml
git commit -m "feat(cube): add local Superset connected over the SQL API"
```

---

### Task 10: Production deployment configuration

**Files:**
- Create: `cube/docker-compose.prod.yml`
- Create: `cube/.env.prod.example`
- Create: `cube/DEPLOY.md`

**Interfaces:**
- Consumes: the validated model from Tasks 3–8.
- Produces: a deployable configuration with a separate refresh worker and dev mode disabled.

**Key differences from local:** `CUBEJS_DEV_MODE=false` (Playground off, auth enforced), a dedicated refresh worker (exactly one), and the read replica rather than a local copy.

- [ ] **Step 1: Write `cube/.env.prod.example`**

```bash
CUBEJS_DEV_MODE=false
CUBEJS_DB_TYPE=postgres
CUBEJS_DB_HOST=replica.internal
CUBEJS_DB_PORT=5432
CUBEJS_DB_NAME=cloudempiere_prod
CUBEJS_DB_USER=cube_readonly
CUBEJS_DB_PASS=
CUBEJS_API_SECRET=
CUBEJS_PG_SQL_PORT=15432
CUBEJS_CUBESTORE_HOST=cubestore_router
CUBEJS_CUBESTORE_PORT=3030
CUBEJS_LOG_LEVEL=warn
```

- [ ] **Step 2: Write `cube/docker-compose.prod.yml`**

```yaml
services:
  cube_api:
    image: cubejs/cube:latest
    restart: unless-stopped
    ports:
      - "4000:4000"
      - "15432:15432"
    env_file: .env.prod
    volumes:
      - ./model:/cube/conf/model:ro
      - ./cube.js:/cube/conf/cube.js:ro
    depends_on: [cubestore_router]

  cube_refresh:
    image: cubejs/cube:latest
    restart: unless-stopped
    env_file: .env.prod
    environment:
      - CUBEJS_REFRESH_WORKER=true
    volumes:
      - ./model:/cube/conf/model:ro
      - ./cube.js:/cube/conf/cube.js:ro
    depends_on: [cubestore_router]

  cubestore_router:
    image: cubejs/cubestore:latest
    restart: unless-stopped
    environment:
      - CUBESTORE_SERVER_NAME=cubestore_router:9999
      - CUBESTORE_META_PORT=9999
      - CUBESTORE_WORKERS=cubestore_worker_1:10001
      - CUBESTORE_REMOTE_DIR=/cube/data
    volumes:
      - cubestore_data:/cube/data

  cubestore_worker_1:
    image: cubejs/cubestore:latest
    restart: unless-stopped
    environment:
      - CUBESTORE_SERVER_NAME=cubestore_worker_1:10001
      - CUBESTORE_WORKER_PORT=10001
      - CUBESTORE_META_ADDR=cubestore_router:9999
      - CUBESTORE_WORKERS=cubestore_worker_1:10001
      - CUBESTORE_REMOTE_DIR=/cube/data
    volumes:
      - cubestore_data:/cube/data
    depends_on: [cubestore_router]

volumes:
  cubestore_data:
```

**Exactly one `cube_refresh` service.** Running two causes duplicate pre-aggregation builds.

- [ ] **Step 3: Write `cube/DEPLOY.md`**

````markdown
# Deploying Cube Core

## Read replica

Streaming replication from the iDempiere primary. Analytics never touches production.

    -- on the primary
    CREATE ROLE cube_readonly LOGIN PASSWORD '<secret>';
    GRANT CONNECT ON DATABASE cloudempiere_prod TO cube_readonly;
    GRANT USAGE ON SCHEMA public TO cube_readonly;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO cube_readonly;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT ON TABLES TO cube_readonly;

## Host sizing

Lean, single host — adequate for 16 tenants and 269 users:

| Component        | Size            |
|------------------|-----------------|
| Replica          | 2–4 vCPU, 16–32 GB, 200 GB gp3 |
| Cube API         | 1 vCPU / 2 GB   |
| Refresh worker   | 1 vCPU / 4 GB   |
| Cube Store       | router + 1 worker, 1 vCPU / 4 GB each |

Peak concurrency is 10–30 queries. Scale for HA and refresh throughput, not query volume.

## Deploy

    scp -r cube/ deploy@host:/opt/cube
    ssh deploy@host
    cd /opt/cube
    cp .env.prod.example .env.prod   # fill in secrets
    docker compose -f docker-compose.prod.yml up -d

## Verify

    curl -s http://localhost:4000/readyz          # {"health":"HEALTH"}
    curl -s http://localhost:4000/cubejs-api/v1/meta   # 403 — dev mode off, auth enforced

A 403 on `/meta` without a token is correct. Dev mode is disabled.

## Post-deploy checks

1. Isolation: run `scripts/test-isolation.mjs` against the deployed host.
2. Numbers: run every case in `scripts/cases/` against the replica.
3. Refresh: confirm `pre-aggregations/jobs` reaches `done`.
````

- [ ] **Step 4: Validate the production compose file parses**

Run: `cd cube && docker compose -f docker-compose.prod.yml config > /dev/null && echo OK`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add cube/docker-compose.prod.yml cube/.env.prod.example cube/DEPLOY.md
git commit -m "feat(cube): add production deployment configuration and runbook"
```

---

### Task 11: Document the migration mapping for the remaining cubes

**Files:**
- Create: `cube/MIGRATION.md`

**Interfaces:**
- Consumes: the patterns established in Tasks 3–6.
- Produces: the reference every subsequent cube port follows.

- [ ] **Step 1: Write `cube/MIGRATION.md`**

````markdown
# Migrating the 2020 model

Source of truth for the old model is `../schema/*.js` — 27 cubes, 106 measures.
Ported: `client`, `organization`, `product`, `business_partner`,
`invoice_facts`, `order_facts`. Remaining: 21 cubes.

Baseline is `clde-cube-headless/schema/` (Apr 2022, template 0.28.19), which
already did `authInfo`→`securityContext`, `queryTransformer`→`queryRewrite`,
and `index.js`→`cube.js`.

## Mechanical renames

| 0.28 source (`schema/*.js`)     | Cube 1.x (`model/cubes/*.yml`) |
|---------------------------------|--------------------------------|
| `cube('X', {...})`              | `cubes: - name: x`             |
| `primaryKey: true`              | `primary_key: true`            |
| `shown: true` / `false`         | `public: true` / `false`       |
| `relationship: 'belongsTo'`     | `relationship: many_to_one`    |
| `relationship: 'hasMany'`       | `relationship: one_to_many`    |
| `${CUBE}.col`                   | `{CUBE}.col`                   |
| `${Other}.col`                  | `{other}.col`                  |
| `measureReferences: [...]`      | `measures: [...]`              |
| `dimensionReferences: [...]`    | `dimensions: [...]`            |
| `external: true`                | remove — Cube Store is default |
| `refreshKey: { every: '1 day' }`| `refresh_key: { every: 1 day }`|

## Removals

- **`SECURITY_CONTEXT.ad_client_id.filter(...)`** — appears in 19 files of the
  baseline (`USER_CONTEXT` in the 2020 repo). Delete it. Tenant isolation is now
  `access_policy` `row_level`, applied centrally. Leaving both means double filtering.
- **`queryRewrite` tenant push** in the baseline `cube.js` — replaced by
  `access_policy`. It is also the fail-open defect: `if (context.ad_client_id)`
  with no `else`. Do not port.
- **`Orders.js`** — the Cube starter template's sample cube. Delete.

## Do NOT remove

- **`SECURITY_CONTEXT.ad_language.filter('ds.ad_language')`** — this is the
  translation mechanism, not tenancy. It joins `rv_ad_reference_trl` to resolve
  document status and doc-base-type labels into the user's language. Carry the
  behaviour into v1.x as a `COMPILE_CONTEXT` reference or query-time parameter.
  Dropping it silently loses Slovak labels.

## Additions every cube needs

    WHERE isactive = 'Y' AND ad_client_id > 0
    AND docstatus IN ('CO','CL')     -- fact cubes only

Plus an `access_policy` block matching `invoice_facts.yml`.

## Known defects to fix during the port

- `schema/Doctype.js` marks **both** `c_doctype_id` and `ad_client_name` as
  `primaryKey: true`, creating an unintended composite key. Keep only
  `c_doctype_id`.
- `schema/Doctype.js` titles its `docbasetype` dimension **"Product Category"**.
  Correct to "Document Base Type". Track G raises the stakes: this title is
  what an AI agent reads.
- No cube references currency. `order_facts` multiplies price × quantity with
  no conversion. Confirm whether any tenant is multi-currency before relying on
  cross-tenant totals.

## Order of remaining work, by value

1. `RvOpenitem` → `open_items` — 15 measures, receivables ageing
2. `Quotations` → `quote_facts` — 12 measures
3. `CashFlowPlan` → `cash_flow` — 11 measures
4. `AccountingFact` → `fact_acct` — 8 measures, already a star schema
5. `LogisticFacts`, `Storage`, `Warehouse` — 16 measures combined
6. The rest — dimensions and low-measure cubes

## Rule

**No cube is merged without a passing case in `scripts/cases/`.**
Converting without comparison produces plausible wrong numbers at scale.
````

- [ ] **Step 2: Commit**

```bash
git add cube/MIGRATION.md
git commit -m "docs(cube): add migration mapping and remaining-cube order"
```

---

## Self-Review

**Spec coverage.** ADR-001's decisions map to tasks: data outside iDempiere via replica → Tasks 1, 10; Cube Core self-hosted → Tasks 1, 8, 10; identity in iDempiere → Task 6; shared model not per-tenant → Task 8 (`ad_client_id` as rollup dimension); SQL API for Superset → Tasks 1, 9; deny-by-default isolation → Task 6. The commercial trigger is a business gate, not an implementation task, and is correctly absent.

**Placeholder scan.** No TBDs. Every code step contains runnable content. Every test step names the command and the expected output.

**Type consistency.** Cube names are snake_case throughout (`invoice_facts`, `order_facts`, `business_partner`) and referenced identically in joins, views, validation cases and the isolation test. Measure names introduced in Tasks 4–5 (`line_net_amt`, `order_count`, `qty_to_deliver`) are the same names used in Task 7's views and Task 8's pre-aggregation.

**Deliberately out of scope.** Angular integration, the MCP chart generator, `rolloutToTenants`, AI context, and the remaining 21 cubes. Each is a separate plan; this one ends with a validated, deployable vertical slice.
