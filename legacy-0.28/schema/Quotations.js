
cube(`Quotefacts`, {
    sql: `
        SELECT 
        o.ad_client_id,
        o.ad_org_id,
        ol.updated,
        o.c_order_id,
        ol.c_orderline_id,
        o.DocumentNo,
        CASE
        WHEN  charat (dt.docbasetype::CHARACTER VARYING,3)::TEXT = 'C'::TEXT THEN (ol.pricelist*-1)*ol.QtyOrdered
        ELSE ol.pricelist*ol.QtyOrdered
      END AS linepricelist,
        CASE
        WHEN  charat (dt.docbasetype::CHARACTER VARYING,3)::TEXT = 'C'::TEXT THEN ol.linenetamt*-1
        ELSE ol.linenetamt
      END AS linenetamt,
      CASE
        WHEN  charat (dt.docbasetype::CHARACTER VARYING,3)::TEXT = 'C'::TEXT THEN ol.linetotalamt*-1
        ELSE ol.linetotalamt
      END AS linetotalamt,
      CASE
        WHEN  charat (dt.docbasetype::CHARACTER VARYING,3)::TEXT = 'C'::TEXT THEN (ol.pricelimit*-1)*ol.QtyOrdered
        ELSE ol.pricelimit
      END AS linepricelimit,
        ol.QtyOrdered as qtyquoted,
        ol.discount,
        0::numeric as markup,
        COALESCE(sr.lastname,'Empty') order_salesrep_name,
        COALESCE(cr.lastname,'Empty') as  order_custrep_name,
        COALESCE(shr.name,'Empty') as m_shippingregion,
        o.datepromised,
        o.dateordered as datequoted,
        o.dateplanship,
        o.driver_id,
        COALESCE(ords.name,'Empty') as order_source_name,
        COALESCE(stat.name,'Empty') as order_status_name,
        delrule.name as deliveryrule,
        o.priorityrule as priority,
        invrule.name as invoicerule,
        lost.name as lostsalesreason,
        linestate.name as OrderLineStatus,
        o.c_bpartner_id,
        ol.m_product_id,
        o.DropShip_BPartner_ID,
        dbp.name as dropshipname,
        COALESCE(ol.AltProductName,ch.name) AS chargename,
        COALESCE (pt.name, 'Empty') as c_paymentterm_name,
        o.docstatus,
        o.isquoteconverted
      FROM c_order o
      JOIN c_orderline ol  ON (o.c_order_id=ol.c_order_id)
      LEFT JOIN c_charge ch ON ol.c_charge_id = ch.c_charge_id
      LEFT JOIN C_PaymentTerm pt ON o.C_PaymentTerm_ID = pt.C_PaymentTerm_ID
      JOIN c_doctype dt ON o.c_doctypetarget_id = dt.c_doctype_id AND (dt.docsubtypeso::text = ANY (ARRAY['ON'::text, 'OB'::text]))
      LEFT JOIN c_bpartner dbp ON o.DropShip_BPartner_ID = dbp.c_bpartner_id
      JOIN m_warehouse wh ON (o.m_warehouse_id = wh.m_warehouse_id)
      LEFT JOIN ad_user sr ON o.salesrep_id = sr.ad_user_id
      LEFT JOIN ad_user cr ON o.customerservrep_id = cr.ad_user_id
      LEFT JOIN ad_user dr ON o.driver_id = dr.ad_user_id
      LEFT JOIN m_shipper sh ON o.m_shipper_id = sh.m_shipper_id
      LEFT JOIN c_shippingregion shr ON shr.c_shippingregion_id = o.c_shippingregion_id
      LEFT JOIN c_pos pos ON o.c_pos_id = pos.c_pos_id
      LEFT JOIN c_ordersource ords ON o.c_ordersource_id = ords.c_ordersource_id
      LEFT JOIN c_orderstatus stat ON o.c_orderstatus_id = stat.c_orderstatus_id
      LEFT JOIN w_store ws ON o.w_store_id = ws.w_store_id
      LEFT JOIN ad_ref_list lost ON ol.lostsalesreason = lost.value::bpchar AND lost.ad_reference_id = 1000188::numeric
      JOIN ad_ref_list delrule ON o.deliveryrule = delrule.value::bpchar AND delrule.ad_reference_id = 151::numeric
      JOIN ad_ref_list invrule ON o.invoicerule = invrule.value::bpchar AND invrule.ad_reference_id = 150::numeric
      LEFT JOIN ad_ref_list linestate ON ol.OrderLineStatus = linestate.value::bpchar AND linestate.ad_reference_id = 1000116::numeric
      WHERE ${SECURITY_CONTEXT.ad_client_id.filter('ol.ad_client_id')}  AND (o.docstatus = ANY (ARRAY['CO'::text, 'CL'::text]))
      AND ${FILTER_PARAMS.Quotefacts.date.filter('o.dateordered')}
    `,
    
    joins: {
      Client: {
        relationship: `belongsTo`,
        sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
      },
      Organization: {
        relationship: `belongsTo`,
        sql: `${CUBE}.ad_org_id = ${Organization}.ad_org_id`
      },
      Businesspartner: {
        relationship: `belongsTo`,
        sql: `${CUBE}.c_bpartner_id = ${Businesspartner}.c_bpartner_id`
      },
      Product: {
        relationship: `belongsTo`,
        sql: `${CUBE}.m_product_id = ${Product}.m_product_id`
      }
    },
  
    title: `Quote`,
    description: `All Proposal and quotation related information`,
    sqlAlias: `qt`,
  
    
    measures: {
      linecount: {
        title: `No of Quote Lines`,
        sql: `c_orderline_id`,
        type: `count`,
      },
  
      count: {
        title: `Number of Quotes`,
        description: `Number of Orders placed`,
        sql: `c_order_id`,
        type: `countDistinctApprox`
      },  
  
      qtyquoted: {
        title: `Qty Ordered for the line`,
        sql: `qtyquoted`,
        type: `sum`
      },
  
      linepricelimit: {
        title: `Cogs for Line`,
        description: `linepricelimit (cost of goods) for line`,
        sql: `linepricelimit`,
        type: `sum`
      },
      
      linepricelist: {
        title: `Line Total in Price List price`,
        sql: `linepricelist`,
        type: `sum`
      },   
  
      linenetamt: {
        title: `Line Total excl Vat`,
        description: `linepricelimit (cost of goods) for line`,
        sql: `linenetamt`,
        type: `sum`
      },
  
      linetotalamt: {
        title: `Line Total incl Vat`,
        sql: `linetotalamt`,
        type: `sum`
      },
  
      marginamt: {
        title: `Margin Amt`,
        description: `Calculated margin amount for line`,
        sql: `${linenetamt} - ${linepricelimit}`,
        type: `number`
      },
  
      discount: {
        title: `Discount %`,
        description: `Calculated discount percentage for ordered items`,
        sql: `ROUND(COALESCE((${linepricelist} - ${linenetamt}) / NULLIF(${linepricelist}, 0), 0),2)*100`,
        type: `number`
      },
  
      margin: {
        title: `Margin %`,
        description: `Calculated percentage of margin`,
        sql: `ROUND(COALESCE(100.0 * (${linenetamt} - ${linepricelimit}) / NULLIF(${linenetamt}, 0), 0),2)`,
        type: `number`
      },
   
      markup: {
        title: `Markup %`,
        description: `Calculated percentage of markup`,
        sql: `ROUND(COALESCE(100.0 * (${linenetamt} - ${linepricelimit}) / NULLIF(${linepricelimit}, 0), 0),2)`,
        type: `number`
      },
  
      fraction: { //https://github.com/cube-js/cube.js/issues/180 :(
        title: `Fraction %`,
        description: `Calculated fraction from Total`,
         sql: `ROUND(COALESCE((${linenetamt})*100 / NULLIF(${linenetamt}, 0), 0),2)`,
        type: `number`
        // filters: [
        //   { sql: `${CUBE}.prodcategory = prodcategory` }
        // ]
      }
  
    },
    
    dimensions: {
      ad_client_id: {
        title: `Tenant`,
        sql: `ad_client_id`,
        type: `number`,
        shown: false
      },
      
      organization: {
        title: `Organization`,
        sql: `${Organization}.ad_org_name`,
        type: `string`
      },

      c_order_id: {
        title: `Order`,
        sql: `c_order_id`,
        type: `number`,
        shown: false 
      },
  
      c_bpartner_id: {
        title: `Bpartner ID`,
        sql: `c_bpartner_id`,
        type: `number`,
        shown: false            
      },

      c_orderline_id: {
        title: `Order Line Identifier`,
        sql: `c_orderline_id`,
        type: `number`,
        primaryKey: true,
        shown: false
      },
  
      datequoted: {
        title: `Date Quote`,
        sql: `datequoted`,
        type: `time`,
        shown: true
      },    
  
      datepromised: {
        title: `Date Promised`,
        sql: `datepromised`,
        type: `time`
      },
  
      bpartner: {
        title: `Bpartner Name`,
        sql: `${Businesspartner}.c_bpartner_name`,
        type: `string`
      },
  
      salesrep: {
        title: `Sales Representative`,
        sql: `order_salesrep_name`,
        type: `string`
      },
  
      prodcategory: {
        title: `Prod. Category`,
        sql: `CASE when ${CUBE}.m_product_id >0 THEN ${Productcategory}.name ELSE 'Charge' END `,
        type: `string`
      },
  
      product: {
        title: `Product`,
        sql: `CASE when ${CUBE}.m_product_id >0 THEN ${Product}.name ELSE chargename END`,
        type: `string`
      },  
  
      deliveryrule: {
        title: `Delivery Rule`,
        sql: `deliveryrule`,
        type: `string`
      },
  
      priority: {
        title: `Order Priority`,
        sql: `priority`,
        type: `string`
      },
      
      invoicerule: {
        title: `Invoice Rule`,
        sql: `invoicerule`,
        type: `string`
      },
  
      lostsalesreason: {
        title: `Lost Sales Reason`,
        sql: `lostsalesreason`,
        type: `string`
      },

      c_paymentterm_name: {
        sql: `c_paymentterm_name`,
        type: `string`
      },

      isquoteconverted: {
        sql: `isquoteconverted`,
        type: `boolean`
      },

      yearmonth: {
        title: `Month in Year`,
        sql: `TO_CHAR(datequoted,'Mon')`,
        type: `string`
      },
  
      yearmonthno: {
        title: `Month in Year, Number`,
        sql: `'Month-'||TO_CHAR(datequoted,'MM')`,
        type: `string`
      }
  
    },

    //https://statsbot.co/blog/high-performance-data-analytics-with-cubejs-pre-aggregations/
    preAggregations: {

    // DEACTIVATED  2022 apr 05   

    //   salesrep: { //salesrep by source
    //   type: `rollup`,
    //   external: true,
    //   refreshKey: {
    //     every: `1 day`,
    //     incremental: true,
    //     updateWindow: `7 day`
    //   },
    //   measureReferences: [count, linenetamt, linepricelimit, marginamt, qtyquoted],
    //   dimensionReferences: [Client.ad_client_id, salesrep],
    //   useOriginalSqlPreAggregations: true,
    //   timeDimensionReference: datequoted,
    //   partitionGranularity: `year`,
    //   granularity: `day`,
    //   scheduledRefresh: true,
    //   indexes: {
    //     main_idx: {
    //       columns: [Client.ad_client_id]
    //     },
    //     secondary_idx: {
    //       columns: [salesrep]
    //     },
    //     tercialy_idx: {
    //       columns: [datequoted]
    //     }
    //   }
    // },
  
    // quoted: { //datequoted
    //   type: `rollup`,
    //   external: true,
    //   refreshKey: {
    //     every: `1 day`,
    //     incremental: true,
    //     updateWindow: `7 day`
    //   },
    //   measureReferences: [linecount, count, linenetamt, linepricelimit, marginamt, qtyquoted],
    //   dimensionReferences: [Client.ad_client_id, organization, product, prodcategory, salesrep, bpartner, datequoted],
    //   timeDimensionReference: datequoted,
    //   partitionGranularity: `year`,
    //   granularity: `day`,
    //   scheduledRefresh: true,
    //   useOriginalSqlPreAggregations: true,
    //   indexes: {
    //     date_idx: {
    //       columns: [datequoted]
    //     }
    //   }
    // },
  
    // promised: {
    //   type: `rollup`,
    //   external: true,
    //   refreshKey: {
    //     every: `1 day`,
    //     incremental: true,
    //     updateWindow: `7 day`
    //   },
    //   measureReferences: [linecount, count, linenetamt, linepricelimit, marginamt, qtyquoted],
    //   dimensionReferences: [Client.ad_client_id, organization, product, prodcategory, salesrep, bpartner, datepromised],
    //   timeDimensionReference: datequoted,
    //   partitionGranularity: `year`,
    //   granularity: `day`,
    //   scheduledRefresh: true,
    //   useOriginalSqlPreAggregations: true,
    //   // indexes: {
    //   //   date_idx: {
    //   //     columns: [datepromised]
    //   //   }
    //   // }
    // }
  }

  });
  