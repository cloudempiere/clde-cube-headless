cube(`Bankstatement`, {
  sql: `SELECT * FROM c_bankstatement bst`,
  
  title: `Bank Statement`,
  description: `Bank Statement details`,
  sql_alias: `bst`,
  

  joins: {
    Client: {
      relationship: `many_to_one`,
      sql: `${Bankstatement}.ad_client_id = ${Client}.ad_client_id`
    },
    Bankaccount: {
      relationship: `many_to_one`,
      sql: `${Bankstatement}.c_bankaccount_id = ${Bankaccount}.c_bankaccount_id`
      }
    },
  
  measures: {
    count: {
      sql: `c_bankstatement_id`,
      type: `count`,
      drill_members: [statementdate]
    },
    
    beginningbalance: {
      sql: `beginningbalance`,
      type: `sum`
    },
    
    endingbalance: {
      sql: `endingbalance`,
      type: `sum`
    }
  },
  
  dimensions: {
    ad_client_id: {
      title: `Client`,
      sql: `ad_client_id`,
      type: `number`,
      public: false
    },    
    
    c_bankstatement_id: {
      title: `Bank Statement ID`,
      description: `Bank Statement database primary key`,
      sql: `c_bankstatement_id`,
      type: `number`,
      primary_key: true,
      public: true
    },

    updated: {
      title: `Updated`,
      sql: `updated`,
      type: `time`
    },

    docstatus: {
      sql: `docstatus`,
      type: `string`
    },

    description: {
      sql: `description`,
      type: `string`
    },
    
    // MIGRATION v1.x: a dimension may not reference foreign cubes (Bankaccount).
    // Expose through a view using join_path + prefix.
    //     bankaccount: {
    //       sql: `${Bankaccount}.name`,
    //       type: `string`
    //     },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Bankaccount).
    // Expose through a view using join_path + prefix.
    //     bankaccounttype: {
    //       sql: `${Bankaccount}.bankaccounttype`,
    //       type: `string`
    //     },

    // c_bank_id: {
    //   title: `Bank ID`,
    //   description: `Bank database primary key`,
    //   sql: `c_bank_id`,
    //   type: `number`,
    //   public: true
    // },
    
    isapproved: {
      sql: `isapproved`,
      type: `string`
    },

    statementdate: {
      sql: `statementdate`,
      type: `time`
    }

  },

  // preAggregations: {
  //   main: {
  //   type: `original_sql`,
  //   //   refresh_key: {
  //     sql: `SELECT MAX(updated) FROM c_bankstatement`
  //     }
  //   }
  // }

});
