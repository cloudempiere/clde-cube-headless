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
  WHERE ${SECURITY_CONTEXT.ad_client_id.filter('l.ad_client_id')}`,
  
  joins: {
    Client: {
      relationship: `belongsTo`,
      sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    }
  },

  measures: {
    count: {
      type: `count`,
      sql: `m_locator_id`,
      drillMembers: []
    }
  },
  
  dimensions: {
    m_locator_id: {
      title: `Locator ID`,
      description: `Locator database primary key`,
      sql: `m_locator_id`,
      type: `number`,
      primaryKey: true,
      shown: true
    },

    ad_client_id: {
      title: `Client`,
      sql: `ad_client_id`,
      type: `number`,
      shown: false
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
    // type: `originalSql`,
    // external: true,
    // // refreshKey: {
    // //   sql: `SELECT MAX(updated) FROM c_bank`
    // //   }
    //  }
  //}
  
  preAggregations: {
    // main: {
    //   type: `rollup`,
    //   external: true,
    //   measureReferences: [count],
    //   dimensionReferences: [m_locator_id],
    //   indexes: {
    //     m_locator_idx: {
    //       columns: [m_locator_id]
    //     }
    //   }
    // }
  }

});
