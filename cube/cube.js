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
   * Tenant only. ad_language is deliberately NOT part of the app id: including
   * it would compile a separate model and rollup set per language - 16 tenants
   * x 5 languages = 80 variants - to vary labels from a 16,160-row table.
   * Translations are handled by domain cubes whose access_policy filters
   * ad_language at query time.
   */
  contextToAppId: ({ securityContext }) =>
    `CUBE_APP_${securityContext?.ad_client_id ?? 'anon'}`,

  /** Groups drive access_policy on the reference/domain cubes. */
  contextToGroups: ({ securityContext }) => {
    if (!securityContext?.ad_client_id) return [];
    const roles = Array.isArray(securityContext.roles) ? securityContext.roles : [];
    return ['tenant_user', ...roles];
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
