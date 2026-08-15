cube(`Client`, {
  sql: 
  `SELECT c.ad_client_id, c.created, c.updated, c.name FROM ad_client c`,

  refresh_key: {
    sql: `SELECT MAX(cl.created) FROM ad_client cl`
  },

  title: `Tenant`,
  description: `All Client/Tenant related information`,
  sql_alias: `cl`,

  measures: {
    count: {
      title: `Total Count`,
      sql: `ad_client_id`,
      type: `count`
    }
  },

  dimensions: {
    ad_client_id: {
      title: `Client ID`,
      description: `Client database primary key`,
      sql: `ad_client_id`,
      type: `number`,
      primary_key: true,
      public: true
    },

    ad_client_name: {
      title: `Client`,
      sql: `name`,
      type: `string`,
      primary_key: false,
      public: false
    }

  },

  preAggregations: {
    main: {
      type: `rollup`,

      measures: [count],
      dimensions: [Client.ad_client_id, ad_client_name],
      indexes: {
        ad_client_id: {
          columns: [Client.ad_client_id]
        }
      }
    }
  }

});
