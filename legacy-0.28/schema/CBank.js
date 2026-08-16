cube(`Bank`, {
  sql: `SELECT 
        b.ad_client_id, 
        b.c_bank_id, 
        b.updated, 
        b.description, 
        b.swiftcode, 
        b.name, b.routingno
        FROM c_bank b
        WHERE (  
          ${SECURITY_CONTEXT.ad_client_id.filter('b.ad_client_id')} OR b.ad_client_id=0)`,
  
  joins: {
    Client: {
      relationship: `belongsTo`,
      sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    }
  },


  title: `Bank`,
  description: `All Banks defined in the system`,
  sqlAlias: `ba`,
  
  measures: {
    count: {
      type: `count`,
      drillMembers: [name]
    }
  },
  
  dimensions: {
    ad_client_id: {
      title: `Client`,
      sql: `${CUBE}.ad_client_id`,
      type: `number`,
      shown: true
    },

    c_bank_id: {
      title: `Bank ID`,
      description: `Banka database primary key`,
      sql: `c_bank_id`,
      type: `number`,
      primaryKey: true,
      shown: true
    },

    updated: {
      title: `Updated`,
      sql: `updated`,
      type: `time`
    },

    description: {
      sql: `description`,
      type: `string`
    },
    
    swiftcode: {
      sql: `swiftcode`,
      type: `string`
    },
    
    name: {
      sql: `name`,
      type: `string`
    },
    
    routingno: {
      sql: `routingno`,
      type: `string`
    }
  },

  // preAggregations: {
  //   main: {
  //     external: true,
  //   type: `originalSql`,
  //   refreshKey: {
  //      sql: `SELECT MAX(updated) FROM c_bank`
  //     //every: `1 day`
  //     }
  //   }
  // }

  

  preAggregations: {
    // main: {
    //   type: `rollup`,
    //   external: true,
    //   measureReferences: [count],
    //   dimensionReferences: [c_bank_id],
    //   indexes: {
    //     c_bankstatement_idx: {
    //       columns: [c_bank_id]
    //     }
    //   }
    // }
  }


});
