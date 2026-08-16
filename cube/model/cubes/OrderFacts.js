import { transformToBoolean } from './helpers';

cube(`Orderfacts`, {
  sql: `
      SELECT 
      o.ad_client_id,
      o.ad_org_id,
      o.created,
      o.updated,
      o.c_order_id,
      o.issotrx,
      o.docstatus,
      ol.c_orderline_id,
      o.DocumentNo,
      CASE
        WHEN charat (dt.docbasetype::CHARACTER VARYING,3)::TEXT = 'C'::TEXT THEN (ol.pricelist*-1)*ol.QtyOrdered
        ELSE ol.pricelist*ol.QtyOrdered
      END AS linepricelist,
      CASE
        WHEN charat (dt.docbasetype::CHARACTER VARYING,3)::TEXT = 'C'::TEXT THEN ol.linenetamt*-1
        ELSE ol.linenetamt
      END AS linenetamt,
      CASE
        WHEN charat (dt.docbasetype::CHARACTER VARYING,3)::TEXT = 'C'::TEXT THEN ol.linetotalamt*-1
        ELSE ol.linetotalamt
      END AS linetotalamt,
      CASE
        WHEN charat (dt.docbasetype::CHARACTER VARYING,3)::TEXT = 'C'::TEXT THEN (ol.pricelimit*-1)*ol.QtyOrdered
        ELSE ol.pricelimit*ol.QtyOrdered
      END AS linepricelimit,
      ol.priceactual,
      COALESCE(ol.qtytoinvoice*ol.priceactual,0) as qtytoinvoiceamt,
      ol.QtyOrdered,
      ol.QtyDelivered,
      ol.qtytoinvoice,
      ol.QtyInvoiced,
      ol.discount,
      COALESCE(sr.lastname,'Empty') as order_salesrep_name,
      COALESCE(cr.lastname,'Empty') as  order_custrep_name,
      COALESCE(cr.lastname,'Empty') as  order_driver_name,
      COALESCE(shr.name,'Empty') as m_shippingregion,
      COALESCE(ol.datepromised,o.datepromised) as datepromised,
      o.dateordered,
      o.dateplanship,
      o.driver_id,
      COALESCE(ords.name,'Empty') as order_source_name,
      COALESCE(stat.name,'Empty') as order_status_name,
      o.deliveryrule       AS deliveryrule_code,
      o.priorityrule as priority,
      o.invoicerule        AS invoicerule_code,
      ol.lostsalesreason   AS lostsalesreason_code,
      ol.orderlinestatus   AS orderlinestatus_code,
      o.c_bpartner_id,
      ol.m_product_id,
      o.dropship_bpartner_id,
      COALESCE(ol.AltProductName,ch.name) AS chargename,
      COALESCE (pt.name, 'Empty') as c_paymentterm_name,
      COALESCE (o.orderage,0) as orderage,
      isdropship
    FROM c_order o
    JOIN c_orderline ol  ON (o.c_order_id=ol.c_order_id)
    LEFT JOIN c_charge ch ON ol.c_charge_id = ch.c_charge_id
    LEFT JOIN C_PaymentTerm pt ON o.C_PaymentTerm_ID = pt.C_PaymentTerm_ID
    JOIN c_doctype dt ON o.c_doctypetarget_id = dt.c_doctype_id
    LEFT JOIN ad_user sr ON o.salesrep_id = sr.ad_user_id
    LEFT JOIN ad_user cr ON o.customerservrep_id = cr.ad_user_id
    LEFT JOIN ad_user dr ON o.driver_id = dr.ad_user_id
    LEFT JOIN m_shipper sh ON o.m_shipper_id = sh.m_shipper_id
    LEFT JOIN c_shippingregion shr ON shr.c_shippingregion_id = o.c_shippingregion_id
    LEFT JOIN c_pos pos ON o.c_pos_id = pos.c_pos_id
    LEFT JOIN c_ordersource ords ON o.c_ordersource_id = ords.c_ordersource_id
    LEFT JOIN c_orderstatus stat ON o.c_orderstatus_id = stat.c_orderstatus_id
    LEFT JOIN w_store ws ON o.w_store_id = ws.w_store_id
    WHERE 1=1 AND o.processed='Y' AND isProposal ='N'
    -- Guard against date typos: 23 orders carry years like 0006 instead of 2006
    -- (documentno PO/SJ/.../0006). Unbounded, monthly partitioning would try to
    -- build 24,240 partitions instead of 294. See docs/ADR-001.
    AND o.dateordered >= DATE '2000-01-01'
    AND o.dateordered <  now() + INTERVAL '2 years' AND ${FILTER_PARAMS.Orderfacts.date.filter('o.dateordered')}
  `,

  // refresh_key: {
  //    sql: `SELECT MAX(created) FROM c_order`
  // },


  joins: {
    // Translated labels come from domain-scoped Reference cubes, whose
    // access_policy filters ad_language from the security context. Replaces
    // four inline rv_ad_reference_trl joins that hardcoded a language.
    DeliveryRule: {
      relationship: `many_to_one`,
      sql: `${CUBE}.deliveryrule_code = ${DeliveryRule}.value`
    },
    InvoiceRule: {
      relationship: `many_to_one`,
      sql: `${CUBE}.invoicerule_code = ${InvoiceRule}.value`
    },
    OrderLineStatus: {
      relationship: `many_to_one`,
      sql: `${CUBE}.orderlinestatus_code = ${OrderLineStatus}.value`
    },
    LostSalesReason: {
      relationship: `many_to_one`,
      sql: `${CUBE}.lostsalesreason_code = ${LostSalesReason}.value`
    },

    Client: {
      relationship: `many_to_one`, //THIS CAUSE PREAGREGGATION DOESN'T WORKED WHY ??? Contenxt was empty ? DO NOT CHANGE THIS
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
    Dropshipcustomers: {
      relationship: `one_to_many`,
      sql: `${CUBE}.dropship_bpartner_id = ${Dropshipcustomers}.c_bpartner_id`
    },
    Product: {
      relationship: `one_to_many`,
      sql: `${CUBE}.m_product_id = ${Product}.m_product_id`
    }
    // RefDelRule: {
    //   relationship: `many_to_one`,
    //   sql: `${CUBE}.deliveryrule = ${Reference}.value`
    // },

    // RefInvRule: {
    //   relationship: `many_to_one`,
    //   sql: `${CUBE}.invoicerule = ${Reference}.value`
    // },

    // RefSalesReason: {
    //   relationship: `many_to_one`,
    //   sql: `${CUBE}.lostsalesreason = ${Reference}.value`
    // }

  },

  title: `Order`,
  description: `All orders related information`,
  sql_alias: `ord`,

  measures: {
    linecount: {
      title: `No of Lines`,
      sql: `c_orderline_id`,
      type: `count`,
    },

    ordercount: {
      title: `Number of Orders`,
      description: `Number of Orders placed`,
      sql: `c_order_id`,
      type: `countDistinctApprox`
    },

    qtyordered: {
      title: `Qty Ordered for the line`,
      sql: `QtyOrdered`,
      type: `sum`
    },

    qtydelivered: {
      title: `Qty delivered for the line`,
      sql: `QtyDelivered`,
      type: `sum`
    },

    qtyinvoiced: {
      title: `Qty Invoiced for the line`,
      sql: `QtyInvoiced`,
      type: `sum`
    },

    qtytoinvoice: {
      title: `Qty Not Invoiced`,
      sql: `qtytoinvoice`,
      type: `sum`
    },

    deliverednotinvoicedamt: {
      title: `Not Invoiced Amount`,
      description: `Order lines delivered but not Invoiced`,
      sql: `COALESCE (qtytoinvoiceamt,0)`,
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

    averagelinetotalamt: {
      title: `Average Transaction Amount`,
      sql: `linetotalamt`,
      type: `avg`
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
      public: false
    },
    
    // MIGRATION v1.x: a dimension may not reference foreign cubes (Organization).
    // Expose through a view using join_path + prefix.
    //     organization: {
    //       title: `Organization`,
    //       sql: `${Organization}.ad_org_name`,
    //       type: `string`
    //     },

    c_order_id: {
      title: `Order`,
      sql: `c_order_id`,
      type: `number`,
      public: false
    },

    c_orderline_id: {
      title: `Order Line Identifier`,
      sql: `c_orderline_id`,
      type: `number`,
      primary_key: true,
      public: true
    },

    m_product_id: {
      title: `Product ID`,
      sql: `m_product_id`,
      type: `number`,
      public: false,
      format: `id`
    },

    c_bpartner_id: {
      title: `Bpartner ID`,
      sql: `c_bpartner_id`,
      type: `number`,
      public: false
    },

    dateordered: {
      title: `Date Ordered`,
      sql: `dateordered`,
      type: `time`
    }, 

    datepromised: {
      title: `Date Promised`,
      sql: `datepromised`,
      type: `time`
    },

    dateplanship: {
      title: `Date Plan Ship`,
      sql: `dateplanship`,
      type: `time`
    },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Businesspartner).
    // Expose through a view using join_path + prefix.
    //     bpartner: {
    //       title: `Bpartner Name`,
    //       sql: `${Businesspartner}.c_bpartner_name`,
    //       type: `string`
    //     },
    
    // MIGRATION v1.x: a dimension may not reference foreign cubes (Dropshipcustomers).
    // Expose through a view using join_path + prefix.
    //     dropshipname: {
    //       title: `Dropship Name`,
    //       sql: `${Dropshipcustomers}.c_bpartner_name`,
    //       type: `string`
    //     },

    isdropship: {
      title: `Transaction is Dropship`,
      sql: `${transformToBoolean('isdropship')}`,
      type: `boolean`
    },

    dropship_bpartner_id: {
      title: `Dropship ID`,
      sql: `dropship_bpartner_id`,
      type: `number`,
      public: false
    },

    salesrep: {
      title: `Sales Representative`,
      sql: `order_salesrep_name`,
      type: `string`
    },

    custrep: {
      title: `Customer Representative`,
      sql: `order_custrep_name`,
      type: `string`
    },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Productcategory).
    // Expose through a view using join_path + prefix.
    //     prodcategory: {
    //       title: `Prod. Category`,
    //       sql: `CASE when ${CUBE}.m_product_id >0 THEN ${Productcategory}.name ELSE 'Charge' END `,
    //       type: `string`
    //     },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Product).
    // Expose through a view using join_path + prefix.
    //     product: {
    //       title: `Product`,
    //       sql: `CASE when ${CUBE}.m_product_id >0 THEN ${Product}.name ELSE chargename END`,
    //       type: `string`
    //     },
    
    shipregion: {
      title: `Ship Region`,
      sql: `m_shippingregion`,
      type: `string`
    },
       
    ordersource: {
      title: `Order Source`,
      sql: `order_source_name`,
      type: `string`
    },

    orderstatus: {
      title: `Order Status`,
      sql: `order_status_name`,
      type: `string`
    }, 

    deliveryrule: {
      title: `Delivery Rule`,
      sql: `deliveryrule_code`,
      type: `string`
    },

    priority: {
      title: `Order Priority`,
      sql: `priority`,
      type: `string`
    },
    
    invoicerule: {
      title: `Invoice Rule`,
      sql: `invoicerule_code`,
      type: `string`
    },

    lostsalesreason: {
      title: `Lost Sales Reason`,
      sql: `lostsalesreason_code`,
      type: `string`
    },

    orderlinestatus: {
      title: `Order Line Status`,
      sql: `orderlinestatus_code`,
      type: `string`
    },

    c_paymentterm_name: {
      sql: `c_paymentterm_name`,
      type: `string`
    },

    issotrx: {
      sql: `${transformToBoolean('issotrx')}`,
      type: `boolean`
    },

    orderage: {
      title: `Order Age`,
      sql: `orderage`,
      type: `number`
    },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Product).
    // Expose through a view using join_path + prefix.
    //     iscatalog: {
    //       title: `Catalog Product`,
    //       sql: `${Product}.iscatalog`,
    //       type: `boolean`
    //     },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Businesspartner).
    // Expose through a view using join_path + prefix.
    //     c_bpartner_abcanalysisgroup: {
    //       title: `BP ABC Group`,
    //       sql: `${Businesspartner}.c_bpartner_abcanalysisgroup`,
    //       type: `string`
    //     }
  },

  segments: {
    Sales: {
      sql: `${CUBE}.issotrx = 'true'`
    },
    Purchase: {
      sql: `${CUBE}.issotrx = 'false'`
    }
  },

  //https://statsbot.co/blog/high-performance-data-analytics-with-cubejs-pre-aggregations/
  preAggregations: {
    /**
     * Incremental, partitioned monthly. Only recent partitions rebuild; the
     * historical ones are built once and never touched again.
     *
     * build_range_start/end BOUND the partitions. Without them Cube derives the
     * range from the data, and 23 rows dated in years 0006-0028 would produce
     * over 24,000 monthly partitions instead of ~140.
     *
     * Those rows are NOT simple typos. Their document numbers carry a trailing
     * month/fiscal-year token running 07/0006..12/0006, 01/0007..06/0007 - a
     * correctly incrementing July-June fiscal counter on a wrong epoch. 384
     * orders (tenant 1000015) carry a malformed token; in 23 of them it was also
     * parsed as a date and written into dateordered, reproducing the token
     * exactly (token 11/0006 -> date 0006-11-13). The cube SQL floor at line 78
     * excludes them, so a rollup and a source read agree - both drop them.
     *
     * build_range_start MUST EQUAL THE CUBE SQL FLOOR. DO NOT RAISE IT.
     *
     * It is tempting to raise it: 2000-2014 is 1% of order lines but 56% of the
     * partitions, so starting at 2015 would more than halve a backfill that
     * otherwise runs for hours. That was tried. It is WRONG, and it fails
     * silently.
     *
     * Cube does NOT fall back to source when a query reaches past
     * build_range_start. It answers from the rollup and drops the uncovered
     * years, with no error and no warning. Measured on tenant 1000015 with
     * build_range_start at 2015:
     *
     *   query   Orderfacts.linecount, 2010-01-01 .. 2026-08-31
     *   correct 4,479,064
     *   got     4,391,856   - 87,208 lines missing (1.95%)
     *   buckets 2015..2026  - 2010-2014 simply absent from the result
     *
     * The rollup was used (dev_pre_aggregations.ord_orders_by_month) and the
     * number looked entirely plausible. Any gap between the cube SQL floor and
     * the rollup floor becomes a silent undercount for every query spanning it.
     * If the backfill cost has to come down, raise the CUBE SQL floor too so
     * the two stay equal - that removes the data from the model honestly,
     * rather than leaving a range the layer answers incorrectly.
     *
     * refresh_key.updateWindow limits the incremental rebuild to the last
     * 3 months, so a daily refresh touches 3 partitions, not 140.
     */
    ordersByMonth: {
      type: `rollup`,
      measures: [Orderfacts.linecount, Orderfacts.ordercount, Orderfacts.qtyordered],
      // Client.ad_client_id, NOT <Cube>.ad_client_id: queryRewrite filters on
      // Client.ad_client_id, and a rollup only matches if the filtered member
      // is one of its dimensions. Using the cube's own column silently
      // disables the rollup for every tenant-scoped query.
      dimensions: [Client.ad_client_id, Orderfacts.issotrx, Orderfacts.orderstatus],
      timeDimension: Orderfacts.dateordered,
      granularity: `day`,
      partition_granularity: `year`,
      build_range_start: { sql: `SELECT DATE '2000-01-01'` },
      build_range_end:   { sql: `SELECT CURRENT_DATE` },
      refresh_key: {
        every: `1 day`,
        incremental: true,
        update_window: `90 day`,
      },
    },

  },

});
