module.exports = {
  /**
   * Tenant only. ad_language is deliberately NOT part of the app id.
   *
   * Including language would compile a separate model AND a separate
   * pre-aggregation set per language: 16 tenants x 5 languages = 80 variants,
   * to vary labels drawn from a 16,160-row table.
   *
   * Translations are pivoted into columns instead - see References.js and
   * Uom.js. One compiled model, one rollup set, every language available.
   */
  contextToAppId: ({ securityContext }) =>
    `CUBE_APP_${securityContext?.ad_client_id ?? 'anon'}`,

  /**
   * Deny-by-default: no ad_client_id claim yields no groups, so no
   * access_policy matches and access is denied. Replaces the 2022
   * queryRewrite, which applied its filter only when the claim was present
   * and returned every tenant's rows when it was not.
   */
  contextToGroups: ({ securityContext }) => {
    if (!securityContext?.ad_client_id) return [];
    const roles = Array.isArray(securityContext.roles) ? securityContext.roles : [];
    return ['tenant_user', ...roles];
  },
};
