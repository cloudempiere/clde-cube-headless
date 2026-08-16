cube(`Bankstatement`, {
  sql: `SELECT * FROM c_bankstatement bst`,
  
  title: `Bank Statement`,
  description: `Bank Statement details`,
  sqlAlias: `bst`,
  

  joins: {
    Client: {
      relationship: `belongsTo`,
      sql: `${Bankstatement}.ad_client_id = ${Client}.ad_client_id`
    },
    Bankaccount: {
      relationship: `belongsTo`,
      sql: `${Bankstatement}.c_bankaccount_id = ${Bankaccount}.c_bankaccount_id`
      }
    },
  
  measures: {
    count: {
      sql: `c_bankstatement_id`,
      type: `count`,
      drillMembers: [statementdate]
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
      shown: false
    },    
    
    c_bankstatement_id: {
      title: `Bank Statement ID`,
      description: `Bank Statement database primary key`,
      sql: `c_bankstatement_id`,
      type: `number`,
      primaryKey: true,
      shown: true
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
    
    bankaccount: {
      sql: `${Bankaccount}.name`,
      type: `string`
    },

    bankaccounttype: {
      sql: `${Bankaccount}.bankaccounttype`,
      type: `string`
    },

    // c_bank_id: {
    //   title: `Bank ID`,
    //   description: `Bank database primary key`,
    //   sql: `c_bank_id`,
    //   type: `number`,
    //   shown: true
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
  //   type: `originalSql`,
  //   external: true,
  //   refreshKey: {
  //     sql: `SELECT MAX(updated) FROM c_bankstatement`
  //     }
  //   }
  // }

});
