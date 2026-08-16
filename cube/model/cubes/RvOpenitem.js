// export const pastdue1_7 = `BETWEEN 1 AND 7`;

// export const TEST_USER_IDS = [1,2,3,4,5];
// export const TEST_USER_IDS = [1,2,3,4,5];
// export const TEST_USER_IDS = [1,2,3,4,5];
// export const TEST_USER_IDS = [1,2,3,4,5];
// export const TEST_USER_IDS = [1,2,3,4,5];
// export const TEST_USER_IDS = [1,2,3,4,5];

cube(`Openitem`, {
  sql: `
  
  
  SELECT 
    i.ad_org_id,
    i.ad_client_id,
    i.documentno,
    i.c_invoice_id,
    i.c_bpartner_id,
    CASE 
      WHEN i.issotrx='Y' THEN 'true'
      ELSE 'false'
    END as issotrx,
    i.dateinvoiced,
    i.dateacct,
    daysbetween(ips.duedate,i.dateinvoiced) AS netdays,
    COALESCE (paymenttermduedate(i.c_paymentterm_id, i.dateinvoiced),ips.duedate) AS duedate,
    COALESCE (paymenttermduedays(i.c_paymentterm_id, i.dateinvoiced, getdate()),daysbetween(getdate(), ips.duedate) ) AS daysdue,
    COALESCE(i.estimatedpaydate::timestamp with time zone, paymenttermduedate(i.c_paymentterm_id, i.dateinvoiced::timestamp with time zone)) AS estimatedpaydate,
    
    CASE
    WHEN charat(dt.docbasetype::character varying, 3)::text = 'C'::text THEN COALESCE (ips.dueamt, i.grandtotal) * -1
    ELSE COALESCE (ips.dueamt, i.grandtotal)
    END AS grandtotal,

    COALESCE (invoiceopen(i.c_invoice_id, ips.c_invoicepayschedule_id),invoiceopen(i.c_invoice_id, 0)) AS openamt,
    
    i.chargeamt,
    i.c_currency_id,
    i.c_conversiontype_id,
    i.c_paymentterm_id,
    i.ispayschedulevalid,
    COALESCE (ips.c_invoicepayschedule_id, NULL) as c_invoicepayschedule_id,
    i.invoicecollectiontype,
    i.c_campaign_id,
    i.c_project_id,
    i.c_activity_id,
    i.ad_orgtrx_id,
    i.ad_user_id,
    i.c_bpartner_location_id,
    i.c_charge_id,
    i.c_doctype_id,
    i.c_doctypetarget_id,
    i.c_dunninglevel_id,
    i.c_payment_id,
    i.created,
    i.createdby,
    i.dateprinted,
    i.docstatus,
    i.dunninggrace,
    i.isactive,
    i.isapproved,
    i.isindispute,
    i.ispaid,
    i.isprinted,
    i.istaxincluded,
    i.istransferred,
    i.paymentrule,
    i.poreference,
    i.salesrep_id,
    i.user1_id,
    i.user2_id,
    COALESCE (p.name, 'Empty') as c_paymentterm_name,
    COALESCE (dl.name, 'No Dunning') as c_dunninglevel_name,
    i.c_bankaccount_id,
    COALESCE (invoiceopen(i.c_invoice_id, ips.c_invoicepayschedule_id),invoiceopen(i.c_invoice_id, 0)) AS pastdueamt,
    i.docstatus AS duedaysrange_code
FROM c_invoice i 
LEFT JOIN c_invoicepayschedule ips ON i.c_invoice_id = ips.c_invoice_id AND i.ispaid ='N'
LEFT JOIN C_DunningLevel dl ON dl.C_DunningLevel_ID=i.C_DunningLevel_ID
LEFT JOIN c_acctschema ac ON ac.ad_client_id = i.ad_client_id AND (ac.ad_orgonly_id = i.ad_org_id)
JOIN c_doctype dt ON i.c_doctype_id = dt.c_doctype_id
JOIN c_paymentterm p  ON i.c_paymentterm_id = p.c_paymentterm_id
WHERE ispaid ='N' AND 1=1
  `,

  // refresh_key: {
  //   every: `1 hour`
  // },
  
  joins: {
    // Translated labels now come from domain-scoped Reference cubes,
    // whose access_policy filters ad_language from the security context.
    OpenItemAging: {
      relationship: `many_to_one`,
      sql: `${CUBE}.duedaysrange_code = ${OpenItemAging}.value`
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
    User: {
      relationship: `one_to_many`,
      sql: `${CUBE}.salesrep_id = ${User}.ad_user_id`
    },
    Bankaccount: {
      relationship: `one_to_many`,
      sql: `${CUBE}.c_bankaccount_id = ${Bankaccount}.c_bankaccount_id`
    }
  },

  segments: {
    OpenItemsSales: {
      sql: `${CUBE}.issotrx = 'true'`
    },
    OpenItemsPurchase: {
      sql: `${CUBE}.issotrx = 'false'`
    }
  },

  title: `Open Items`,
  description: `Business Partner Open Items`,
  sql_alias: `opi`,
  
  measures: {
    count: {
      type: `count`,
      // drill_members: [ispaid, ispayschedulevalid, created, updated, dateprinted, dateordered, estimatedpaydate, 
      //   discountdate, dateinvoiced, duedate, dateacct]
    },
    
    grandtotal: {
      title: `Grand Total`,
      description: `Invoice Grand Total`,
      sql: `ROUND(grandtotal,0)`,
      type: `sum`
    },

    openamt: {
      title: `Open Amount`,
      // description: `Invoice Grand Total`,
      sql: `ROUND(openamt,0)`,
      type: `sum`
    },

    openamtnatural: {
      title: `Open Amount Natural`,
      // description: `Invoice Grand Total`,
      sql: `CASE WHEN issotrx='false' THEN openamt * -1 ELSE openamt END`,
      type: `sum`,
      public: true
    },

    openitembal: {
      title: `Estimated Balance from Open Items`,
      sql: `CASE WHEN issotrx='false' THEN openamt * -1 ELSE openamt END`,
      type: `sum`,
      rollingWindow: {
        trailing: `unbounded`,
        leading: `1 day`,
        offset: `start`
      },
    },

    dueamt: {
      title: `Due Amount`,
      // description: `Due amount in scheme currency`,
      sql: `COALESCE(ROUND(openamt,0),0)`,
      type: `sum`,
      filters: [
        { sql: `${CUBE}.daysdue < 0` }
      ]
    },

    pastdueamt: {
      title: `Past Due Amt`,
      // description: `Past Due Amt `,
      sql: `COALESCE(ROUND(openamt,0),0)`,
      type: `sum`,
      filters: [
          { sql: `${CUBE}.daysdue > 0` }
        ]
      },

    //due measure calculations

    //TODO

    //past due measure calculations

    pastdue1_7: {
      title: `Past Due 1-7`,
      description: `All invoice value over 1 - 7 days`,
      sql: `ROUND(openamt,0)`,
      type: `sum`,
      filters: [
        { sql: `${CUBE}.daysdue BETWEEN 1 AND 7` }
      ]
    },

    pastdue8_30: {
      title: `Past Due 8-30`,
      description: `All invoice value over 8 - 30 days`,
      sql: `ROUND(openamt,0)`,
      type: `sum`,
      filters: [
        { sql: `${CUBE}.daysdue BETWEEN 8 AND 30` }
      ]
    },

    pastdue31_60: {
      title: `Past Due 31-60`,
      description: `All invoice value over 31 - 60 days`,
      sql: `ROUND(openamt,0)`,
      type: `sum`,
      filters: [
        { sql: `${CUBE}.daysdue BETWEEN 31 AND 60` }
      ]
    },

    pastdue61_90: {
      title: `Past Due 61-90`,
      description: `All invoice value over 61 - 90 days`,
      sql: `ROUND(openamt,0)`,
      type: `sum`,
      filters: [
        { sql: `${CUBE}.daysdue BETWEEN 61 AND 90` }
      ]
    },

    pastdue91_180: {
      title: `Past Due 91-180`,
      description: `All invoice value over 91 - 180 days`,
      sql: `ROUND(openamt,0)`,
      type: `sum`,
      filters: [
        { sql: `${CUBE}.daysdue BETWEEN 91 AND 180` }
      ]
    },

    pastdue181_365: {
      title: `Past Due 181-365`,
      description: `All invoice value over 181 - 365 days`,
      sql: `ROUND(openamt,0)`,
      type: `sum`,
      filters: [
        { sql: `${CUBE}.daysdue BETWEEN 181 AND 365` }
      ]
    },

    pastdue366plus: {
      title: `Past Due 365+`,
      description: `All invoice value over 365+ days`,
      sql: `ROUND(openamt,0)`,
      type: `sum`,
      filters: [
        { sql: `${CUBE}.daysdue > 365` }
      ]
    }

  },
  
  dimensions: {
    ad_client_id: {
      title: `Client`,
      sql: `ad_client_id`,
      type: `number`,
      public: false
    },

    ad_org_id: {
      sql: `ad_org_id`,
      type: `number`,
      public: false
    },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Organization).
    // Expose through a view using join_path + prefix.
    //     ad_org_name: {
    //       title: `Bpartner Name`,
    //       sql: `${Organization}.ad_org_name`,
    //       type: `string`
    //     },

    c_invoice_id: {
      sql: `c_invoice_id`,
      type: `number`,
      primary_key: true,
      public: false
    },

    c_bpartner_id: {
      title: `Bpartner ID`,
      sql: `c_bpartner_id`,
      type: `number`,
      public: false
    },

    c_paymentterm_name: {
      sql: `c_paymentterm_name`,
      type: `string`
    },

    c_dunninglevel_name: {
      sql: `c_dunninglevel_name`,
      type: `string`
    },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Businesspartner).
    // Expose through a view using join_path + prefix.
    //     bpartner: {
    //       title: `Bpartner Name`,
    //       sql: `${Businesspartner}.c_bpartner_name`,
    //       type: `string`
    //     },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (User).
    // Expose through a view using join_path + prefix.
    //     salesrep: {
    //       title: `Sales Representative`,
    //       sql: `${User}.name`,
    //       type: `string`
    //     },

    paymentrule: {
      sql: `paymentrule`,
      type: `string`
    },
       
    issotrx: {
      sql: `issotrx`,
      type: `boolean`
    },
    
    estimatedpaydate: {
      sql: `estimatedpaydate`,
      type: `time`
    },
    
    dateinvoiced: {
      sql: `dateinvoiced`,
      type: `time`
    },
    
    duedate: {
      sql: `duedate`,
      type: `time`
    },

    documentno: {
      sql: `documentno`,
      type: `string`
    },

    daysdue: {
      title: `Days Due`,
      // description: `Due amount in scheme currency`,
      sql: `daysdue`,
      type: `number`
    },
    
    duedaysrange: {
      title: `Due Days Range`,
      description: `Range of Due Days`,
      type: `string`,
      public: true,
      case: {
        when: [
            // { sql: `${CUBE}.daysdue BETWEEN 1 AND 7`, label: '{sql: `${CUBE}.daysdue`}' },
            { sql: `${CUBE}.daysdue BETWEEN 1 AND 7`, label: `PD-01-07` },
            { sql: `${CUBE}.daysdue BETWEEN 8 AND 30`, label: `PD-08-30` },
            { sql: `${CUBE}.daysdue BETWEEN 31 AND 60`, label: `PD-31-60` },
            { sql: `${CUBE}.daysdue BETWEEN 61 AND 90`, label: `PD-61-90` },
            { sql: `${CUBE}.daysdue BETWEEN 91 AND 180`, label: `PD-91-180` },
            { sql: `${CUBE}.daysdue BETWEEN 181 AND 365`, label: `PD-181-365` },
            { sql: `${CUBE}.daysdue > 365`, label: `PD-365+` },

            { sql: `${CUBE}.daysdue BETWEEN -7 AND 1`, label: `ND-01-07` },
            { sql: `${CUBE}.daysdue BETWEEN -30 AND -8`, label: `ND-08-30` },
            { sql: `${CUBE}.daysdue BETWEEN -60 AND -31`, label: `ND-31-60` },
            { sql: `${CUBE}.daysdue BETWEEN -90 AND -61`, label: `ND-61-90` },
            { sql: `${CUBE}.daysdue BETWEEN -181 AND -90`, label: `ND-91-180` },
            { sql: `${CUBE}.daysdue BETWEEN -365 AND -181`, label: `ND-181-365` },
            { sql: `${CUBE}.daysdue < -365`, label: `ND-365+` }
            
        ],
        else: { label: `Unknown` }
      }
    },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Bankaccount).
    // Expose through a view using join_path + prefix.
    //     bankaccount: {
    //       title: `Bank Account`,
    //       sql: `${Bankaccount}.name`,
    //       type: `string`,
    //       public: true
    //     }

    // istaxincluded: {
    //   sql: `istaxincluded`,
    //   type: `string`
    // },

    // paymentreference: {
    //   sql: `paymentreference`,
    //   type: `string`
    // },
    
    // invoicecollectiontype: {
    //   sql: `invoicecollectiontype`,
    //   type: `string`
    // },
    
    // ispaid: {
    //   sql: `ispaid`,
    //   type: `string`
    // },

    // isindispute: {
    //   sql: `isindispute`,
    //   type: `string`
    // },
    
    // isapproved: {
    //   sql: `isapproved`,
    //   type: `string`
    // },
    
    // isactive: {
    //   sql: `isactive`,
    //   type: `string`
    // },

    // ispayschedulevalid: {
    //   sql: `ispayschedulevalid`,
    //   type: `string`
    // },
            
    // docstatus: {
    //   sql: `docstatus`,
    //   type: `string`
    // },
    
    // dateacct: {
    //   sql: `dateacct`,
    //   type: `time`
    // },
    
    // dunninggrace: {
    //   sql: `dunninggrace`,
    //   type: `time`
    // }
  },

  preAggregations: {
    /**
     * Bounded incremental rollup - same pattern as Orderfacts.ordersByMonth.
     * Bounding is not optional: unbounded monthly partitioning over dirty
     * dates produced 24,240 partitions on Orderfacts instead of ~294.
     * Only additive measures; ratios are not safe to sum across a rollup.
     */
    byMonth: {
      type: `rollup`,
      measures: [Openitem.count, Openitem.grandtotal, Openitem.openamt, Openitem.dueamt],
      // Client.ad_client_id, NOT <Cube>.ad_client_id: queryRewrite filters on
      // Client.ad_client_id, and a rollup only matches if the filtered member
      // is one of its dimensions. Using the cube's own column silently
      // disables the rollup for every tenant-scoped query.
      dimensions: [Client.ad_client_id],
      timeDimension: Openitem.dateinvoiced,
      granularity: `day`,
      partition_granularity: `year`,
      build_range_start: { sql: `SELECT DATE '2000-01-01'` },
      build_range_end:   { sql: `SELECT CURRENT_DATE + INTERVAL '1 year'` },
      refresh_key: { every: `1 day`, incremental: true, update_window: `90 day` },
    },
    // origsql: {
    //   type: `original_sql`,
    //   //   refresh_key: {
    //     every: `60 minutes`
    //   },
    //   scheduledRefresh: false
    // },

    // TODO
    // def: {
    //   type: `rollup`,
    //   //   refresh_key: {
    //     every: `1 day`,
    //     incremental: true,
    //     update_window: `7 day`
    //   },
    //   measures: [grandtotal, openamt, openamtnatural, openitembal, dueamt, pastdueamt, pastdue1_7, pastdue8_30, pastdue31_60, pastdue61_90, pastdue91_180, pastdue181_365, pastdue366plus],
    //   dimensions: [Client.ad_client_id, Organization.ad_org_id ],
    //   useOriginalSqlPreAggregations: true,
    //   indexes: {
    //     main_idx: {
    //       columns: [Client.ad_client_id, ad_org_id]
    //     },
    //     secondary_idx: {
    //       columns: [Client.ad_client_id, salesrep]
    //     }
    //   }
    // }

  }
});
