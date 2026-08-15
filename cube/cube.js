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

  queryRewrite: (query, { securityContext }) => {
    const tenant = securityContext?.ad_client_id;

    // Deny, do not pass through. This is the 2022 defect.
    if (tenant === undefined || tenant === null || tenant === '') {
      throw new Error('Access denied: security context carries no ad_client_id');
    }

    query.filters = query.filters ?? [];
    query.filters.push({
      member: 'Client.ad_client_id',
      operator: 'equals',
      values: [String(tenant)],
    });
    return query;
  },
};
