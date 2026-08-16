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
       bat.name AS c_bankaccount_type_name
  FROM c_bankaccount ba
  LEFT JOIN rv_ad_reference_trl bat ON ba.bankaccounttype = bat.value::bpchar AND bat.ad_reference_id = 216::NUMERIC AND ${SECURITY_CONTEXT.ad_language.filter ('bat.ad_language') }
  WHERE ${SECURITY_CONTEXT.ad_client_id.filter('ba.ad_client_id')}
  `,
  
  joins: {
    Client: {
      relationship: `belongsTo`,
      sql: `${Bankaccount}.ad_client_id = ${Client}.ad_client_id`
    },
    Organization: {
      relationship: `belongsTo`,
      sql: `${Bankaccount}.ad_org_id = ${Organization}.ad_org_id`
    },
    Bank: {
      relationship: `hasMany`,
      sql: `${Bankaccount}.c_bank_id = ${Bank}.c_bank_id`
    }
  },

  title: `Bank Account`,
  description: `All Bank Account related information`,
  sqlAlias: `bac`,
  
  measures: {
    count: {
      type: `count`,
      sql: `c_bankaccount_id`,
      drillMembers: [name]
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
      shown: false
    },    
    
    c_bankaccount_id: {
      title: `Bank Account ID`,
      description: `Bank Account database primary key`,
      sql: `c_bankaccount_id`,
      type: `number`,
      primaryKey: true,
      shown: true
    },

    c_bank_id: {
      title: `Bank ID`,
      description: `Banka database primary key`,
      sql: `c_bank_id`,
      type: `number`,
      shown: true
    },

    c_currency_id: {
      title: `Client`,
      sql: `c_currency_id`,
      type: `number`,
      shown: false
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

    c_bank_name: {
      title: `Bpartner Name`,
      sql: `${Bank}.name`,
      type: `string`
    },

    ad_org_name: {
      title: `Bpartner Name`,
      sql: `${Organization}.ad_org_name`,
      type: `string`
    }

  },


  preAggregations: {
    // main: {
    // external: true,
    // type: `originalSql`,
    // refreshKey: {
    //   sql: `SELECT MAX(updated) FROM c_bankaccount`
    //   }
    // }
  }

});
