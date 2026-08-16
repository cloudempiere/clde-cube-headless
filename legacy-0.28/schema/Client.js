cube(`Client`, {
  sql: 
  `SELECT c.ad_client_id, c.created, c.updated, c.name FROM ad_client c`,

  refreshKey: {
    sql: `SELECT MAX(cl.created) FROM ad_client cl`
  },

  title: `Tenant`,
  description: `All Client/Tenant related information`,
  sqlAlias: `cl`,

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
      primaryKey: true,
      shown: true
    },

    ad_client_name: {
      title: `Client`,
      sql: `name`,
      type: `string`,
      primaryKey: false,
      shown: false
    }

  },

  preAggregations: {
    main: {
      type: `rollup`,
      external: true,
      measureReferences: [count],
      dimensionReferences: [Client.ad_client_id, ad_client_name],
      indexes: {
        ad_client_id: {
          columns: [Client.ad_client_id]
        }
      }
    }
  }

});
