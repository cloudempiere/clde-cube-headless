import { transformToBoolean } from './helpers';

cube(`Bankaccount`, {
  sql: `
  SELECT 
       ba.ad_client_id,
       ba.ad_org_id,
       ba.created,
       ba.updated,
       ba.currentbalance,
       ba.c_bankaccount_id,
       ba.c_bank_id,
       ba.c_currency_id,
       ba.name,
       ba.value,
       ba.isdefault,
       ba.bankaccounttype,
       ba.iban,
       ba.description,
       ba.accountno,
       ba.bankaccounttype AS c_bankaccount_type_name_code
  FROM c_bankaccount ba
  WHERE 1=1
  `,
  
  joins: {
    // Translated labels now come from domain-scoped Reference cubes,
    // whose access_policy filters ad_language from the security context.
    BankAccountType: {
      relationship: `many_to_one`,
      sql: `${CUBE}.c_bankaccount_type_name_code = ${BankAccountType}.value`
    },
    Client: {
      relationship: `many_to_one`,
      sql: `${Bankaccount}.ad_client_id = ${Client}.ad_client_id`
    },
    Organization: {
      relationship: `many_to_one`,
      sql: `${Bankaccount}.ad_org_id = ${Organization}.ad_org_id`
    },
    Bank: {
      relationship: `one_to_many`,
      sql: `${Bankaccount}.c_bank_id = ${Bank}.c_bank_id`
    }
  },

  title: `Bank Account`,
  description: `All Bank Account related information`,
  sql_alias: `bac`,
  
  measures: {
    count: {
      type: `count`,
      sql: `c_bankaccount_id`,
      drill_members: [name]
    },
    
    currentbalance: {
      sql: `currentbalance`,
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
    
    c_bankaccount_id: {
      title: `Bank Account ID`,
      description: `Bank Account database primary key`,
      sql: `c_bankaccount_id`,
      type: `number`,
      primary_key: true,
      public: true
    },

    c_bank_id: {
      title: `Bank ID`,
      description: `Banka database primary key`,
      sql: `c_bank_id`,
      type: `number`,
      public: true
    },

    c_currency_id: {
      title: `Client`,
      sql: `c_currency_id`,
      type: `number`,
      public: false
    },   

    updated: {
      title: `Updated`,
      sql: `updated`,
      type: `time`
    },

    name: {
      sql: `name`,
      type: `string`
    },
    
    value: {
      sql: `value`,
      type: `string`
    },
    
    isdefault: {
      sql: `isdefault`,
      type: `string`
    },
    
    bankaccounttype: {
      title: `Bank Account Type`,
      sql: `c_bankaccount_type_name`,
      type: `string`
    },
    
    isactive: {
      sql: `${transformToBoolean('isactive')}`,
      type: `boolean`
    },
    
    iban: {
      sql: `iban`,
      type: `string`
    },
    
    description: {
      sql: `description`,
      type: `string`
    },
    
    accountno: {
      sql: `accountno`,
      type: `string`
    },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Bank).
    // Expose through a view using join_path + prefix.
    //     c_bank_name: {
    //       title: `Bpartner Name`,
    //       sql: `${Bank}.name`,
    //       type: `string`
    //     },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Organization).
    // Expose through a view using join_path + prefix.
    //     ad_org_name: {
    //       title: `Bpartner Name`,
    //       sql: `${Organization}.ad_org_name`,
    //       type: `string`
    //     }

  },


  preAggregations: {
    // main: {
    // // type: `original_sql`,
    // refresh_key: {
    //   sql: `SELECT MAX(updated) FROM c_bankaccount`
    //   }
    // }
  }

});
