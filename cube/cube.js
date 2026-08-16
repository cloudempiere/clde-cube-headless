/**
 * Cube configuration.
 *
 * TENANT ISOLATION
 *
 * Every cube carrying ad_client_id declares its own access_policy - 35 of them,
 * with no exceptions. That is the whole mechanism.
 *
 * It was not always. Until now queryRewrite pushed
 * `Client.ad_client_id IN (tenant, 0)` onto every query, because access_policy
 * templating - "{ securityContext.x }" - silently does nothing in JavaScript
 * cubes: the string passes through literally and matches no row. With the model
 * in JS, that function was the only thing standing between sixteen tenants.
 *
 * The model is now entirely YAML, where the templating works. The last cube
 * without a policy was Warehouselayout, and the reason is worth remembering:
 * the Inventory view read locator and warehouse names THROUGH it, and a
 * row_level filter on a JOINED dimension does not merely hide dimension rows,
 * it drops FACT rows whose join finds no permitted match. 651 movements have no
 * locator at all, so a policy there silently deleted them from the view. That
 * was misdiagnosed for a long time as 624 cross-tenant locator references; there
 * are none - 0 of 16.5M movement lines - and locators are exclusively
 * tenant-owned, 0 of 21,851 carrying ad_client_id = 0.
 *
 * Warehouse now resolves both names on the fact, so the view no longer joins
 * that cube and the policy is free.
 *
 * WHAT STILL GUARDS THIS
 *
 * access_policy is deny-by-default only for cubes that HAVE a policy. A cube
 * added later without one is readable by every tenant, with no error and nothing
 * in the logs. scripts/validate.mjs therefore FAILS if any cube exposing
 * ad_client_id lacks an access_policy - that check is the durable guarantee, and
 * queryRewrite below keeps only a claim assertion.
 *
 * DESTINATION REACHED: see docs/ADR-001.
 */
module.exports = {
  /**
   * CONSTANT, deliberately.
   *
   * contextToAppId keys the COMPILED MODEL cache. It must vary by everything
   * that changes the model - and nothing here does. The model contains zero
   * uses of COMPILE_CONTEXT and zero of SECURITY_CONTEXT; isolation is applied
   * at QUERY time by access_policy and queryRewrite, which run per request
   * regardless of this key.
   *
   * It used to return `CUBE_APP_${ad_client_id}`, which compiled sixteen
   * byte-identical models and bought nothing.
   *
   * It also created a documented hazard. Cube requires scheduledRefreshContexts
   * whenever the security context feeds contextToAppId, and warns that leaving
   * it unset means "the security context will be undefined" during scheduled
   * refresh. That was unset here. Nothing broke, because one build genuinely
   * does serve every tenant - but only by accident of the model being uniform.
   * A constant key makes that uniformity explicit instead of accidental, and
   * removes the requirement rather than leaving it unmet.
   *
   * ISOLATION IS NOT AFFECTED. Rollups are shared across tenants by design -
   * ad_client_id is a rollup dimension and filtering happens on read. That was
   * already true with per-tenant app ids, and test-rollup-isolation asserts it:
   * each tenant's rollup answer must equal that same tenant's source answer.
   *
   * If a cube ever varies by COMPILE_CONTEXT, this must become per-tenant again
   * AND scheduledRefreshContexts must be declared alongside it.
   */
  contextToAppId: () => 'CUBE_APP_SHARED',

  /** Groups drive access_policy on the reference/domain cubes. */
  contextToGroups: ({ securityContext }) => {
    if (!securityContext?.ad_client_id) return [];
    const roles = Array.isArray(securityContext.roles) ? securityContext.roles : [];
    return ['tenant_user', ...roles];
  },

  /**
   * SQL API AUTH (port CUBEJS_PG_SQL_PORT - DBeaver, Superset, Metabase, psql)
   *
   * The SQL API carries no JWT, so without this every SQL connection reaches
   * queryRewrite with an empty security context and is refused. A BI tool
   * cannot send claims, so the LOGIN has to carry the tenant instead.
   *
   *   username   <ad_client_id>            e.g. 1000026
   *              <ad_client_id>.<lang>     e.g. 1000026.sk_SK
   *   password   CUBEJS_SQL_PASSWORD (one shared secret, checked below)
   *
   * The username is the tenant claim, so anyone who can reach the port and
   * knows the password can pick their own tenant. That is acceptable for a
   * LOCAL DEV instance bound to localhost and nothing else. Before this is
   * exposed anywhere, give each tenant its own credential and verify the pair,
   * or put the SQL API behind a proxy that injects the identity.
   */
  checkSqlAuth: (req, user, password) => {
    const expected = process.env.CUBEJS_SQL_PASSWORD;
    if (!expected) throw new Error('SQL API disabled: CUBEJS_SQL_PASSWORD is not set');
    if (password !== expected) throw new Error('Access denied: bad SQL password');

    const [tenant, language = 'en_US'] = String(user ?? '').split('.');
    if (!/^\d+$/.test(tenant)) {
      throw new Error(
        `Access denied: SQL username must be an ad_client_id, optionally "<id>.<lang>" - got "${user}"`
      );
    }

    return {
      password,
      securityContext: {
        ad_client_id: Number(tenant),
        ad_language: language,
        roles: ['tenant_user'],
      },
    };
  },

  /**
   * CLAIM ASSERTION ONLY. The tenant FILTER that used to live here is gone.
   *
   * WHAT THIS USED TO DO, AND WHY IT NO LONGER DOES
   *
   * It pushed `Client.ad_client_id IN (tenant, 0)` onto every query. That was
   * the entire isolation story while the model was JavaScript, because
   * access_policy templating - "{ securityContext.x }" - silently does nothing
   * in JS cubes: the string passes through literally and matches no row.
   *
   * Every cube carrying ad_client_id is now YAML and declares its own
   * access_policy - 35 of them. The last holdout was Warehouselayout, which
   * could not have one because the Inventory view reached locator and warehouse
   * names THROUGH it, and a row_level filter on a joined dimension drops FACT
   * rows whose join finds no permitted match. 651 movements have no locator at
   * all and vanished. Warehouse now carries those two names on the fact, the
   * view no longer joins that cube, and the policy costs nothing.
   *
   * Removing the filter also removes a forced join to Client on every single
   * query, which existed only to carry the predicate.
   *
   * WHY AN ASSERTION REMAINS
   *
   * access_policy is deny-by-default only for cubes that HAVE a policy. A cube
   * added later without one would be readable across all sixteen tenants, with
   * no error and nothing in the logs - exactly the failure this file has warned
   * about since the 2022 model shipped `if (context.ad_client_id) { ... }` with
   * no else, handing every tenant's rows to any token that authenticated
   * without a claim.
   *
   * So the claim check stays - it is cheap and it fails loudly - and
   * scripts/validate.mjs now FAILS if any cube exposing ad_client_id lacks an
   * access_policy. That check, not this function, is what keeps the guarantee.
   */
  queryRewrite: (query, { securityContext }) => {
    const tenant = securityContext?.ad_client_id;

    if (tenant === undefined || tenant === null || tenant === '') {
      throw new Error('Access denied: security context carries no ad_client_id');
    }

    return query;
  },
};
