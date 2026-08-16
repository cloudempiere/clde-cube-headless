cube(`Productcategory`, {
  sql: `SELECT * FROM m_product_category pc
  WHERE ${SECURITY_CONTEXT.ad_client_id.filter('pc.ad_client_id')}`,

  // refreshKey: {
  //   every: `1 day`
  // },
  
  title: `Product Category`,
  description: `Product Categories`,
  sqlAlias: `pc`,

  joins: {
    Client: {
      relationship: `belongsTo`,
      sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    },
  },
  
  measures: {
    count: {
      type: `count`,
      drillMembers: [name]
    }
  },
  
  dimensions: {
    ad_client_id: {
      sql: `ad_client_id`,
      type: `number`,
      shown: false
    },
    
    m_product_category_id: {
      title: `Product Category ID`,
      description: `Product Category database primary key`,
      sql: `m_product_category_id`,
      type: `number`,
      primaryKey: true,
      shown: true
    },

    isdefault: {
      sql: `isdefault`,
      type: `string`
    },
         
    name: {
      sql: `name`,
      type: `string`
    },
    
    isactive: {
      sql: `isactive`,
      type: `string`
    },
    
    issummary: {
      sql: `issummary`,
      type: `string`
    },
    
    isselfservice: {
      sql: `isselfservice`,
      type: `string`
    },
    
    value: {
      sql: `value`,
      type: `string`
    }
  },

  preAggregations: {
    main: {
      type: `rollup`,
      external: true,
      measureReferences: [count],
      dimensionReferences: [Client.ad_client_id, m_product_category_id, name],
      refreshKey: {
        every: `1 day`,
        incremental: true,
      },
      indexes: {
        ad_client_idx: {
          columns: [Client.ad_client_id]
        },
        m_product_category_idx: {
          columns: [m_product_category_id]
        }
      }
    }
  }
});
