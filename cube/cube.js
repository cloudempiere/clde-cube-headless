/**
 * Cube configuration.
 *
 * TENANT ISOLATION
 *
 * queryRewrite is plain JavaScript, so unlike access_policy it does not depend
 * on the "{ securityContext.x }" templating that silently fails in JS models.
 * It therefore works today, with the fact cubes still in JavaScript.
 *
 * It is DENY-BY-DEFAULT. The 2022 model did:
 *
 *     if (context.ad_client_id) { query.filters.push(...) }   // no else
 *
 * so a token that authenticated but carried no claim received NO filter and
 * every tenant's rows. Here a missing claim throws instead.
 *
 * DESTINATION: per-cube access_policy in YAML, which additionally gives
 * member-level control and masking. queryRewrite is the interim, not the end
 * state - see docs/ADR-001.
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
   * TENANT ISOLATION
   *
   * The rule is iDempiere's own: ad_client_id IN (tenant, 0).
   *
   *   transactional facts   tenant rows only - c_order, c_invoice and
   *                         m_movement contain ZERO ad_client_id = 0 rows,
   *                         so the 0 is harmless there
   *   master and reference  tenant rows PLUS system defaults - c_uom has 37
   *                         system rows, ad_ref_list 3,232, ad_org 1,
   *                         c_bpartner 2
   *
   * One rule covers both. Earlier revisions kept an explicit list of "system
   * cubes" to exempt, which was a maintenance hazard: register a new lookup
   * cube late and every query touching it breaks.
   *
   * REGRESSION THIS RESTORES
   *
   * The 2020 model filtered values: [user.ad_client_id, 0]. The 2022 rewrite
   * dropped the 0 - values: [context.ad_client_id] - so system-owned master
   * data has been invisible since then: every reference value, 37 units of
   * measure, the system org. This restores it.
   *
   * DENY BY DEFAULT
   *
   * 2022 applied its filter only when the claim was present, with no else, so
   * a token without ad_client_id received every tenant's rows. Here a missing
   * claim throws.
   */
  queryRewrite: (query, { securityContext }) => {
    const tenant = securityContext?.ad_client_id;

    if (tenant === undefined || tenant === null || tenant === '') {
      throw new Error('Access denied: security context carries no ad_client_id');
    }

    query.filters = query.filters ?? [];
    query.filters.push({
      member: 'Client.ad_client_id',
      operator: 'equals',
      values: [String(tenant), '0'],
    });
    return query;
  },
};
