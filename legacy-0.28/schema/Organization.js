cube(`Organization`, {
  sql: 
   `
    SELECT 
      o.ad_client_id,
      o.ad_org_id,
      o.updated,
      o.value,
      o.name as ad_org_name,
      o.isactive
    FROM ad_org o
    WHERE ${SECURITY_CONTEXT.ad_client_id.filter('o.ad_client_id')}
    AND o.issummary = 'N'::bpchar`,

    // refreshKey: {
    //   sql: `SELECT MAX(created) FROM ad_org`
    // },

  title: `Organization`,
  description: `All Organization related information`,
  sqlAlias: `org`,

  joins: {
    Client: {
      relationship: `belongsTo`,
      sql: `${Organization}.ad_client_id = ${Client}.ad_client_id`
    }
  },

  measures: {
    count: {
      title: `Total Count`,
      sql: `ad_org_id`,
      type: `count`,
      drillMembers: [ad_org_name]
    }
  },

  dimensions: {
    ad_client_id: {
      title: `Client`,
      sql: `ad_client_id`,
      type: `number`,
      shown: false
    },

    ad_org_id: {
      title: `Org ID`,
      description: `Organization database primary key`,
      sql: `ad_org_id`,
      type: `number`,
      primaryKey: true,
      shown: true
    },

    ad_org_name: {
      title: `Organization`,
      sql: `ad_org_name`,
      type: `string`,
      shown: true
    },

    tenant: {
      title: `Tenant Name`,
      sql: `${Client}.name`,
      type: `string`,
      shown: true
    }
  },

  preAggregations: {
    // main: {
    //   type: `rollup`,
    //   external: true,
    //   measureReferences: [count],
    //   dimensionReferences: [Client.ad_client_id, Organization.ad_org_id, ad_org_name, tenant],
    //   indexes: {
    //     ad_org_client_idx: {
    //       columns: [Client.ad_client_id]
    //     },
    //     ad_org_idx: {
    //       columns: [Organization.ad_org_id]
    //     }
    //   }
    // }
  }

});
