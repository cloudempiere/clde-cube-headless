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
          1=1 OR b.ad_client_id=0)`,
  
  joins: {
    Client: {
      relationship: `many_to_one`,
      sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    }
  },


  title: `Bank`,
  description: `All Banks defined in the system`,
  sql_alias: `ba`,
  
  measures: {
    count: {
      type: `count`,
      drill_members: [name]
    }
  },
  
  dimensions: {
    ad_client_id: {
      title: `Client`,
      sql: `${CUBE}.ad_client_id`,
      type: `number`,
      public: true
    },

    c_bank_id: {
      title: `Bank ID`,
      description: `Banka database primary key`,
      sql: `c_bank_id`,
      type: `number`,
      primary_key: true,
      public: true
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
  //     //   type: `original_sql`,
  //   refresh_key: {
  //      sql: `SELECT MAX(updated) FROM c_bank`
  //     //every: `1 day`
  //     }
  //   }
  // }

  

  preAggregations: {
    // main: {
    //   type: `rollup`,
    //   //   measures: [count],
    //   dimensions: [c_bank_id],
    //   indexes: {
    //     c_bankstatement_idx: {
    //       columns: [c_bank_id]
    //     }
    //   }
    // }
  }


});
