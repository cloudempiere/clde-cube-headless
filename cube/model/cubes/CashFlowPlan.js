import { transformToBoolean } from './helpers';

cube(`Cashflowplan`, {
  sql: 
   `
   SELECT cp.ad_client_id,
   cp.ad_org_id,
   sch.ad_orgonly_id,
   cp.createdby,
   cp.updatedby,
   cp.created,
   cp.updated,
   cp.isactive,
   cp.issotrx,
   cpl.c_cashplanline_id,
   cp.c_cashplan_id,
   cp.DocumentNo,
   cpl.DateTrx,
   cpl.Line,
   COALESCE(cpl.c_bpartner_id,cp.c_bpartner_id) AS c_bpartner_id,
   cpl.c_charge_id,
   CASE WHEN cp.issotrx = 'Y'::bpchar THEN cpl.linetotalamt ELSE (cpl.linetotalamt)*'-1'::INTEGER::NUMERIC END AS cashamt,
   cpl.linetotalamt AS cashamt_abs,
   cp.cashflowtype,
   cp.cashflowtype AS cashflowtype_name_code,
   i.c_invoice_id,
   
   ch.c_chargetype_id,
   cht.name AS c_chargetype_name,

   COALESCE(cp.c_activity_id,cpl.c_activity_id) AS c_activity_id,
   act.name as c_activity_name,   
   
   ev.c_elementvalue_id,
   COALESCE(cha.c_acctschema_id,pha.c_acctschema_id) AS c_acctschema_id,
   COALESCE(ch.name,p.name) AS cashflw_plan_name,
   
   -- MIGRATION: coalesce the CODES, not two translated labels; the single
   -- AccountType cube join resolves the label per security-context language.
   COALESCE(ev2.AccountType, ev.AccountType) AS accounttype_code,
   COALESCE (oi.C_BankAccount_ID,i.C_BankAccount_ID) as C_BankAccount_ID,
   ba.name as c_bankaccount_name,
   sch.name as c_acctschema_name,
   cpl.processed


FROM c_cashplanline  cpl
JOIN c_cashplan cp ON cpl.c_cashplan_id = cp.c_cashplan_id
LEFT JOIN c_invoice i ON i.c_cashplanline_id = cpl.c_cashplanline_id

LEFT JOIN m_product p ON cpl.m_product_id = p.m_product_id
LEFT JOIN c_charge ch ON cpl.c_charge_id = ch.c_charge_id
LEFT JOIN c_chargetype cht ON ch.c_chargetype_id = cht.c_chargetype_id

LEFT JOIN c_acctschema sch ON cpl.ad_org_id = sch.ad_orgonly_id
LEFT JOIN AD_OrgInfo oi ON oi.AD_Org_ID=sch.ad_orgonly_id
LEFT JOIN c_bankaccount ba ON COALESCE (i.C_BankAccount_ID, oi.C_BankAccount_ID) = ba.c_bankaccount_id

LEFT JOIN c_charge_acct cha ON cha.c_charge_id = ch.c_charge_id AND sch.c_acctschema_id = cha.c_acctschema_id
LEFT JOIN m_product_acct pha ON pha.m_product_id = p.m_product_id AND sch.c_acctschema_id = pha.c_acctschema_id

LEFT JOIN c_validcombination vc ON vc.c_acctschema_id = cha.c_acctschema_id AND vc.c_validcombination_id = cha.ch_expense_acct
LEFT JOIN c_validcombination vc2 ON vc2.c_acctschema_id = pha.c_acctschema_id AND vc2.c_validcombination_id = pha.P_Revenue_Acct

LEFT JOIN c_elementvalue ev ON vc.account_id = ev.c_elementvalue_id
LEFT JOIN c_elementvalue ev2 ON vc2.account_id = ev2.c_elementvalue_id

LEFT JOIN C_Activity act ON act.C_Activity_ID = COALESCE(cpl.C_Activity_ID, cp.C_Activity_ID)



WHERE 1=1 AND cpl.isactive='Y' 
order by cpl.DateTrx ASC

    `,

  title: `CashFlow`,
  description: `Cashflow Plan related information`,
  sql_alias: `cflw`,

  joins: {
    AccountType: {
      relationship: `many_to_one`,
      sql: `${CUBE}.accounttype_code = ${AccountType}.value`
    },
    // Translated labels now come from domain-scoped Reference cubes,
    // whose access_policy filters ad_language from the security context.
    CashFlowType: {
      relationship: `many_to_one`,
      sql: `${CUBE}.cashflowtype_name_code = ${CashFlowType}.value`
    },
    Client: {
      relationship: `many_to_one`,
      sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    },
    Organization: {
      relationship: `one_to_many`,
      sql: `${CUBE}.ad_org_id = ${Organization}.ad_org_id`
    },
    Businesspartner: {
      relationship: `one_to_many`,
      sql: `${CUBE}.c_bpartner_id = ${Businesspartner}.c_bpartner_id`
    },
    Product: {
      relationship: `one_to_many`,
      sql: `${CUBE}.m_product_id = ${Product}.m_product_id`
    }
  },


  segments: {
    Expenses: {
      sql: `${CUBE}.AccountType = 'Expense'`
    },
    Revenue: {
      sql: `${CUBE}.AccountType = 'Revenue'`
    }
  },

  measures: {
    count: {
      title: `Total Line Count`,
      sql: `c_cashplanline_id`,
      type: `count`
    },

    cashamt: {
      title: `Cash Amount`,
      description: `Cash Plan Amount, natural`,
      sql: `cashamt`,
      type: `sum`,
    },

    cashin: {
      title: `Cash Going In`,
      description: `Cash Going In in selected period`,
      sql: `cashamt_abs`,
      type: `sum`,
      filters: [
        { sql: `${CUBE}.cashamt > 0` }
      ]
    },

    cashout: {
      title: `Cash Going Out`,
      description: `Cash Going Out in selected period`,
      sql: `cashamt_abs`,
      type: `sum`,
      filters: [
        { sql: `${CUBE}.cashamt < 0` }
      ]
    },

    casheffective: {
      title: `Cash Effective`,
      description: `Cash Period Effictive Ingoing-Outgoing`,
      sql: `${cashin} - ${cashout}`,
      type: `number`,

    },

    balance: {
      sql: `cashamt`,
      type: `sum`,
      rollingWindow: {
        trailing: `unbounded`
      }
    },

    dailybalance: {
      sql: `cashamt`,
      type: `sum`,
      rollingWindow: {
        trailing: `unbounded`,
        leading: `1 day`,
        offset: `start`
      },
    },

    monthlysum: {
      sql: `cashamt`,
      type: `sum`,
      rollingWindow: {
        trailing: `1 month`
      }
    }

  },

  dimensions: {
    ad_client_id: {
      title: `Tenant`,
      sql: `ad_client_id`,
      type: `number`,
      public: false
    },  
    
    Date: { //rename to cash flow date
      title: `Date Plan`,
      sql: `datetrx`,
      type: `time`,
      public: true
    },  

    c_cashplan_id: {
      title: `Cashflow Line Identifier`,
      sql: `c_cashplan_id`,
      type: `number`,
      public: true,
      primary_key: true
    }, 

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Businesspartner).
    // Expose through a view using join_path + prefix.
    //     bpartner: {
    //       title: `Customer Name`,
    //       sql: `${Businesspartner}.c_bpartner_name`,
    //       type: `string`
    //     },

    eventtype: {
      title: `Cash Flow Event`,
      sql: `cashflw_plan_name`,
      type: `string`
    },

    chargetype: {
      title: `chargetype Name`,
      sql: `c_chargetype_name`,
      type: `string`
    },

    activity: {
      title: `Activity Name`,
      sql: `c_activity_name`,
      type: `string`
    },
    
    // MIGRATION v1.x: a dimension may not reference foreign cubes (Organization).
    // Expose through a view using join_path + prefix.
    //     organization: {
    //       title: `Org/Company`,
    //       sql: `${Organization}.ad_org_name`,
    //       type: `string`
    //     },

    accounttype: {
      title: `Account Type`,
      sql: `AccountType`,
      type: `string`
    },

    c_bankaccount_name: {
      title: `Bank Account`,
      sql: `c_bankaccount_name`,
      type: `string`
    },

    c_acctschema_name: {
      title: `Accounting Schema`,
      sql: `c_acctschema_name`,
      type: `string`
    },

    cashplanprocessed: {
      title: `Cashplan Realised`,
      sql: `${transformToBoolean('processed')}`,
      type: `boolean`
    }

    // prodcategory: {
    //   title: `Prod. Category`,
    //   sql: `CASE when ${CUBE}.m_product_id >0 THEN ${Productcategory}.name ELSE 'Charge' END `,
    //   type: `string`
    // },

    
  },

  preAggregations: {
    // default: {
    //   type: `original_sql`,
    //   //   refresh_key: {
    //     sql: `SELECT MAX(updated) FROM c_cashplanline`
    //   }
    // },

  // DEACTIVATED  2022 apr 05

    // balance: {
    //   type: `rollup`,
    //   //   refresh_key: {
    //     every: `1 day`,
    //     incremental: true,
    //     update_window: `7 day`
    //   },
    //   measures: [count, cashamt, balance, monthlysum],
    //   dimensions: [Client.ad_client_id, ad_client_id, bpartner, eventtype, chargetype, activity, organization, accounttype],
    //   useOriginalSqlPreAggregations: true,
    //   timeDimension: Date,
    //   partition_granularity: `year`,
    //   granularity: `month`,
    // }
  }

});
