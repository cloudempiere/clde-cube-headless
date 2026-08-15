cube(`Productcategory`, {
  sql: `SELECT * FROM m_product_category pc
  WHERE 1=1`,

  // refresh_key: {
  //   every: `1 day`
  // },
  
  title: `Product Category`,
  description: `Product Categories`,
  sql_alias: `pc`,

  joins: {
    Client: {
      relationship: `many_to_one`,
      sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    },
  },
  
  measures: {
    count: {
      type: `count`,
      drill_members: [name]
    }
  },
  
  dimensions: {
    ad_client_id: {
      sql: `ad_client_id`,
      type: `number`,
      public: false
    },
    
    m_product_category_id: {
      title: `Product Category ID`,
      description: `Product Category database primary key`,
      sql: `m_product_category_id`,
      type: `number`,
      primary_key: true,
      public: true
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

      measures: [count],
      dimensions: [Client.ad_client_id, m_product_category_id, name],
      refresh_key: {
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
