cube(`Warehouselayout`, {
  sql: `
  SELECT 
        l.ad_client_id, 
        l.ad_org_id,
        l.updated,
        l.m_locator_id, 
        l.value,
        wh.name as m_warehouse_name
        FROM m_locator l
  left join m_warehouse wh ON (l.m_warehouse_id=wh.m_warehouse_id)
  WHERE 1=1`,
  
  joins: {
    Client: {
      relationship: `many_to_one`,
      sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    }
  },

  measures: {
    count: {
      type: `count`,
      sql: `m_locator_id`,
      drill_members: []
    }
  },
  
  dimensions: {
    m_locator_id: {
      title: `Locator ID`,
      description: `Locator database primary key`,
      sql: `m_locator_id`,
      type: `number`,
      primary_key: true,
      public: true
    },

    ad_client_id: {
      title: `Client`,
      sql: `ad_client_id`,
      type: `number`,
      public: false
    },    

    m_warehouse_name: {
      sql: `m_warehouse_name`,
      type: `string`
    },
    
    name: {
      sql: `value`,
      type: `string`
    }
  },

  //preAggregations: {
    // main: {
    // type: `original_sql`,
    // // // refresh_key: {
    // //   sql: `SELECT MAX(updated) FROM c_bank`
    // //   }
    //  }
  //}
  
  preAggregations: {
    // main: {
    //   type: `rollup`,
    //   //   measures: [count],
    //   dimensions: [m_locator_id],
    //   indexes: {
    //     m_locator_idx: {
    //       columns: [m_locator_id]
    //     }
    //   }
    // }
  }

});
