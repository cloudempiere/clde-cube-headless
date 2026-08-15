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
    WHERE 1=1
    AND o.issummary = 'N'::bpchar`,

    // refresh_key: {
    //   sql: `SELECT MAX(created) FROM ad_org`
    // },

  title: `Organization`,
  description: `All Organization related information`,
  sql_alias: `org`,

  joins: {
    Client: {
      relationship: `many_to_one`,
      sql: `${Organization}.ad_client_id = ${Client}.ad_client_id`
    }
  },

  measures: {
    count: {
      title: `Total Count`,
      sql: `ad_org_id`,
      type: `count`,
      drill_members: [ad_org_name]
    }
  },

  dimensions: {
    ad_client_id: {
      title: `Client`,
      sql: `ad_client_id`,
      type: `number`,
      public: false
    },

    ad_org_id: {
      title: `Org ID`,
      description: `Organization database primary key`,
      sql: `ad_org_id`,
      type: `number`,
      primary_key: true,
      public: true
    },

    ad_org_name: {
      title: `Organization`,
      sql: `ad_org_name`,
      type: `string`,
      public: true
    },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Client).
    // Expose through a view using join_path + prefix.
    //     tenant: {
    //       title: `Tenant Name`,
    //       sql: `${Client}.name`,
    //       type: `string`,
    //       public: true
    //     }
  },

  preAggregations: {
    // main: {
    //   type: `rollup`,
    //   //   measures: [count],
    //   dimensions: [Client.ad_client_id, Organization.ad_org_id, ad_org_name, tenant],
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
