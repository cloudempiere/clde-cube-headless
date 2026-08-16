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
      delrule.name as deliveryrule,
      o.priorityrule as priority,
      invrule.name as invoicerule,
      lost.name as lostsalesreason,
      linestate.name as orderlinestatus,
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
    
    LEFT JOIN rv_ad_reference_trl lost ON ol.lostsalesreason = lost.value::bpchar AND lost.ad_reference_id = 1000188::numeric AND lost.ad_language='sk_SK'
    JOIN rv_ad_reference_trl delrule ON o.deliveryrule = delrule.value::bpchar AND delrule.ad_reference_id = 151::numeric AND delrule.ad_language='sk_SK'
    JOIN rv_ad_reference_trl invrule ON o.invoicerule = invrule.value::bpchar AND invrule.ad_reference_id = 150::numeric AND invrule.ad_language='sk_SK'
    LEFT JOIN rv_ad_reference_trl linestate ON ol.orderlinestatus = linestate.value::bpchar AND linestate.ad_reference_id = 1000116::numeric AND linestate.ad_language='sk_SK'
    WHERE ${SECURITY_CONTEXT.ad_client_id.filter('o.ad_client_id')} AND o.processed='Y' AND isProposal ='N' AND ${FILTER_PARAMS.Orderfacts.date.filter('o.dateordered')}

    limit 100
  `,

  // refreshKey: {
  //    sql: `SELECT MAX(created) FROM c_order`
  // },


  joins: {
    Client: {
      relationship: `belongsTo`, //THIS CAUSE PREAGREGGATION DOESN'T WORKED WHY ??? Contenxt was empty ? DO NOT CHANGE THIS
      sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    },
    Organization: {
      relationship: `hasMany`,
      sql: `${CUBE}.ad_org_id = ${Organization}.ad_org_id`
    },
    Businesspartner: {
      relationship: `hasMany`,
      sql: `${CUBE}.c_bpartner_id = ${Businesspartner}.c_bpartner_id`
    },
    Dropshipcustomers: {
      relationship: `hasMany`,
      sql: `${CUBE}.dropship_bpartner_id = ${Dropshipcustomers}.c_bpartner_id`
    },
    Product: {
      relationship: `hasMany`,
      sql: `${CUBE}.m_product_id = ${Product}.m_product_id`
    }
    // RefDelRule: {
    //   relationship: `belongsTo`,
    //   sql: `${CUBE}.deliveryrule = ${Reference}.value`
    // },

    // RefInvRule: {
    //   relationship: `belongsTo`,
    //   sql: `${CUBE}.invoicerule = ${Reference}.value`
    // },

    // RefSalesReason: {
    //   relationship: `belongsTo`,
    //   sql: `${CUBE}.lostsalesreason = ${Reference}.value`
    // }

  },

  title: `Order`,
  description: `All orders related information`,
  sqlAlias: `ord`,

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

    c_orderline_id: {
      title: `Order Line Identifier`,
      sql: `c_orderline_id`,
      type: `number`,
      primaryKey: true,
      shown: true
    },

    m_product_id: {
      title: `Product ID`,
      sql: `m_product_id`,
      type: `number`,
      shown: false,
      format: `id`
    },

    c_bpartner_id: {
      title: `Bpartner ID`,
      sql: `c_bpartner_id`,
      type: `number`,
      shown: false
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

    bpartner: {
      title: `Bpartner Name`,
      sql: `${Businesspartner}.c_bpartner_name`,
      type: `string`
    },
    
    dropshipname: {
      title: `Dropship Name`,
      sql: `${Dropshipcustomers}.c_bpartner_name`,
      type: `string`
    },

    isdropship: {
      title: `Transaction is Dropship`,
      sql: `${transformToBoolean('isdropship')}`,
      type: `boolean`
    },

    dropship_bpartner_id: {
      title: `Dropship ID`,
      sql: `dropship_bpartner_id`,
      type: `number`,
      shown: false
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

    orderlinestatus: {
      title: `Order Line Status`,
      sql: `orderlinestatus`,
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

    iscatalog: {
      title: `Catalog Product`,
      sql: `${Product}.iscatalog`,
      type: `boolean`
    },

    c_bpartner_abcanalysisgroup: {
      title: `BP ABC Group`,
      sql: `${Businesspartner}.c_bpartner_abcanalysisgroup`,
      type: `string`
    }
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
    linecnt: {
      type: `rollup`,
      external: true,
      measureReferences: [Orderfacts.linecount],
      dimensionReferences: [Client.ad_client_id, Orderfacts.custrep, Orderfacts.issotrx],
      timeDimensionReference: Orderfacts.dateordered,
      partitionGranularity: `month`,
      granularity: `day`,
      refreshKey: {
        every: `1 day`,
        incremental: true,
      },
      // scheduledRefresh: true
    }, 
  }
});
