cube(`Factacct`, {
  sql: `
  SELECT 
    fa.ad_client_id,
    fa.ad_org_id,
    fa.isactive,
    fa.created,
    fa.createdby,
    fa.updated,
    fa.updatedby,
    fa.dateacct,
    to_char(fa.dateacct, 'YYYY-MM'::text) AS finyear_mth,
    to_char(fa.dateacct, '"FY"YYYY'::text) AS finyear,
    fa.c_project_id,
    fa.c_acctschema_id,
    fa.account_id,
    ev.value as accountvalue,
    atype.name as c_elementvalue_acctype_name,
    ev.accounttype,
    ev.name as c_elementvalue_name,
    fa.amtacctdr,
    fa.amtacctcr,
    sch.name as c_acctschema_name
  FROM fact_acct fa
  JOIN c_elementvalue ev ON (fa.account_id=ev.c_elementvalue_id)
  JOIN c_acctschema sch ON (fa.c_acctschema_id=sch.c_acctschema_id)
  JOIN rv_ad_reference_trl atype ON ev.accounttype = atype.value::bpchar AND atype.ad_reference_id = 117::numeric AND ${SECURITY_CONTEXT.ad_language.filter('atype.ad_language')}
  WHERE ${SECURITY_CONTEXT.ad_client_id.filter('fa.ad_client_id')} AND ${FILTER_PARAMS.Factacct.date.filter('fa.dateacct')}
  `,
  
  joins: {
    Client: {
      relationship: `belongsTo`,
      sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    }
  },
 
  segments: {
    ActualAccunting: {
      sql: `${CUBE}.postingtype = 'A'`
    },
    NotActAccounting: {
      sql: `${CUBE}.postingtype != 'A'`
    }
  },

  measures: {
    count: {
      type: `count`
    },

    amtacctdr: {
      type: `sum`,
      sql: `amtacctdr`
    },

    amtacctcr: {
      type: `sum`,
      sql: `amtacctcr`
    },

    netamt: { //netamt
      sql: `amtacctdr-amtacctcr`,
      type: `sum`,
      rollingWindow: {
        trailing: `unbounded`
      }
    },

    openingbalance: { //acctbalance
      sql: `${netamt}`,
      type: `number`,
      rollingWindow: {
        trailing: `unbounded`,
        offset: `start`
      }
    },

    acctbalance: { //endbalance
     // sql: `${netamt}`,
      sql: `${openingbalance} + (${amtacctdr}-${amtacctcr})`,
      type: `number`,
      // rollingWindow: {
      //   trailing: `1 day`,
      //   offset: `end`
      // }
    }

    //we need previous 12 months here - till we can't get it in metabase

  },
  
  dimensions: {
    ad_client_id: {
      title: `Client/Tenant`,
      sql: `ad_client_id`,
      type: `number`,
      shown: false
    },

    ad_org_id: {
      title: `Client/Tenant`,
      sql: `ad_org_id`,
      type: `number`,
      shown: false
    },

    c_acctschema_id: {
      title: `Accounting Schema`,
      sql: `c_acctschema_id`,
      type: `number`,
      shown: false
    },

    c_acctschema_name: {
      title: `Accounting Schema`,
      sql: `c_acctschema_name`,
      type: `string`,
      shown: true
    },

    account_id: {
      sql: `account_id`,
      type: `number`,
      primaryKey: true,
      shown: false
    },

    dateacct: {
      title: `Accounting Date`,
      sql: `dateacct`,
      type: `time`
    },

    account: {
      title: `Account Key`,
      sql: `accountvalue`,
      type: `string`
    },

    accounttype: {
      title: `Account Type`,
      sql: `accounttype`,
      type: `string`
    },

    c_elementvalue_name: {
      title: `Account Name`,
      sql: `c_elementvalue_name`,
      type: `string`
    },

    c_elementvalue_acctype_name: {
      title: `Account Type`,
      sql: `c_elementvalue_acctype_name`,
      type: `string`
    }
  
    //we need hierarchycal leveling here


  },

  preAggregations: {

    // base: {
    //   type: `originalSql`,
    //   refreshKey: {
    //     sql: `SELECT MAX(updated) FROM fact_acct`
    //   }
    // },


    // def: {
    //   type: `rollup`,
    //   external: true,
    //   refreshKey: {
    //     every: `1 day`,
    //     incremental: true,
    //     updateWindow: `7 day`
    //   },
    //   measureReferences: [amtacctdr, amtacctcr, netamt, openingbalance, acctbalance],
    //   dimensionReferences: [Client.ad_client_id, ad_org_id, c_acctschema_id, accounttype, account, c_elementvalue_name, c_elementvalue_acctype_name],
    //   timeDimensionReference: dateacct,
    //   partitionGranularity: `month`,
    //   granularity: `day`,
    //  }
  }
});


  //     scheduledRefresh: false,
  //     indexes: {
  //       ad_client_id_idx: {
  //         columns: [ad_client_id]
  //       },
  //       dateacct_idx: {
  //         columns: [dateacct]
  //       },
  //       accounttype_idx: {
  //         columns: [accounttype]
  //       }
  //     }
  //   }