cube(`Invoicefacts`, {
  sql: 
   `
      SELECT i.ad_client_id,
      i.ad_org_id,
      i.c_invoice_id,
      i.updated,
      i.dateinvoiced,
      il.c_invoiceline_id,
      CASE
        WHEN charat (dt.docbasetype::CHARACTER VARYING,3)::TEXT = 'C'::TEXT THEN (il.pricelist*-1)*il.QtyInvoiced
        ELSE il.pricelist*il.QtyInvoiced
      END AS linepricelist,
      CASE
        WHEN charat (dt.docbasetype::CHARACTER VARYING,3)::TEXT = 'C'::TEXT THEN il.linenetamt*-1
        ELSE il.linenetamt
      END AS linenetamt,
      CASE
        WHEN charat (dt.docbasetype::CHARACTER VARYING,3)::TEXT = 'C'::TEXT THEN il.linetotalamt*-1
        ELSE il.linetotalamt
      END AS linetotalamt,
      CASE
        WHEN charat (dt.docbasetype::CHARACTER VARYING,3)::TEXT = 'C'::TEXT THEN (il.pricelimit*-1)*il.QtyInvoiced
        ELSE il.pricelimit*il.QtyInvoiced
      END AS linepricelimit,
      CASE
        WHEN charat (dt.docbasetype::CHARACTER VARYING,3)::TEXT = 'C'::TEXT THEN il.QtyInvoiced*-1
        ELSE il.QtyInvoiced
      END AS QtyInvoiced,
      il.m_product_id,
      i.c_bpartner_id,
      i.documentno,
      COALESCE(il.AltProductName,ch.name) AS chargename,
      i.salesrep_id,
      il.discount,
      COALESCE (pt.name, 'Empty') as c_paymentterm_name,
      i.docstatus,
      CASE 
        WHEN dt.issotrx='Y' THEN 'true'
        ELSE 'false'
      END as issotrx
    FROM c_invoice i
    JOIN c_invoiceline il ON il.c_invoice_id = i.c_invoice_id
    JOIN c_doctype dt ON i.c_doctype_id = dt.c_doctype_id
    LEFT JOIN c_charge ch ON il.c_charge_id = ch.c_charge_id 
    LEFT JOIN C_PaymentTerm pt ON i.C_PaymentTerm_ID = pt.C_PaymentTerm_ID
    WHERE ${SECURITY_CONTEXT.ad_client_id.filter('i.ad_client_id')} AND (i.docstatus = ANY (ARRAY['CO'::text, 'CL'::text]))
    AND ${FILTER_PARAMS.Invoicefacts.date.filter('i.dateinvoiced')}
    `,

    // refreshKey: {
    //   sql: `SELECT MAX(created) FROM c_invoiceline`
    // },


  title: `Invoice`,
  description: `All Sales invoice related information`,
  sqlAlias: `inv`,

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
    },
    User: {
      relationship: `belongsTo`,
      sql: `${CUBE}.salesrep_id = ${User}.ad_user_id`
    }
  },
  
  measures: {
    linecount: {
      title: `No of Lines`,
      sql: `c_invoiceline_id`,
      type: `count`
    },

    count: {
      title: `Number of Invoices`,
      description: `Number of Invoices placed`,
      sql: `c_invoice_id`,
      type: `countDistinctApprox`
    },

    qtyinvoiced: {
      title: `Qty Sold`,
      sql: `QtyInvoiced`,
      type: `sum`
    },

    linepricelimit: {
      title: `Cost of sold goods`,
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
      title: `Client`,
      sql: `ad_client_id`,
      type: `number`,
      shown: false
    },

    ad_org_id: {
      title: `Org ID`,
      sql: `ad_org_id`,
      type: `number`,
      shown: false
    },

    c_bpartner_id: {
      title: `Bpartner ID`,
      sql: `c_bpartner_id`,
      type: `number`,
      shown: false
    },

    m_product_id: {
      title: `Product ID`,
      sql: `m_product_id`,
      type: `number`,
      shown: false
    },

    salesrep_id: {
      title: `SalesRep ID`,
      sql: `salesrep_id`,
      type: `number`,
      shown: false
    },

    ad_org_name: {
      title: `Organization`,
      sql: `${Organization}.ad_org_name`,
      type: `string`
    },

    c_invoiceline_id: {
      title: `Invoice Line Identifier`,
      sql: `c_invoiceline_id`,
      type: `number`,
      primaryKey: true,
      shown: false
    },

    dateinvoiced: {
      sql: `dateinvoiced`,
      type: `time`
    },

    bpartner: {
      title: `BPartner`,
      sql: `${Businesspartner}.c_bpartner_name`,
      type: `string`
    },

    salesrep: {
      title: `Sales Representative`,
      sql: `${User}.name`,
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

    c_paymentterm_name: {
      sql: `c_paymentterm_name`,
      type: `string`
    },

    issotrx: {
      sql: `issotrx`,
      type: `boolean`
    }

    // documentno: {
    //   title: `Document No`,
    //   sql: `documentno`,
    //   type: `string`
    // },

  },

  segments: {
    Sales: {
      sql: `${CUBE}.issotrx = 'true'`
    },
    Purchase: {
      sql: `${CUBE}.issotrx = 'false'`
    }
  },

  preAggregations: {

    // countsource: {
    //   type: `rollup`,
    //   measureReferences: [count],
    //   dimensionReferences: [Client.ad_client_id, ad_client_id, issotrx]
    // },

    // pterm: {
    //   type: `rollup`,
    //   external: true,
    //   measureReferences: [linenetamt],
    //   dimensionReferences: [Client.ad_client_id, c_paymentterm_name, issotrx, dateinvoiced],
    //   timeDimensionReference: dateinvoiced,
    //   granularity: `day`
    // },

    // def: {
    //   type: `rollup`,
    //   external: true,
    //   refreshKey: {
    //     every: `1 day`,
    //     incremental: true,
    //     updateWindow: `7 day`
    //   },
    //   measureReferences: [linecount, qtyinvoiced, linepricelimit, linepricelist, linenetamt, linetotalamt, marginamt, discount, margin, markup, fraction],
    //   dimensionReferences: [Client.ad_client_id, ad_org_id, c_bpartner_id, m_product_id, salesrep_id, ad_org_name, c_invoiceline_id, bpartner, salesrep, prodcategory, product, c_paymentterm_name],
    //   useOriginalSqlPreAggregations: true,
    //   timeDimensionReference: dateinvoiced,
    //   partitionGranularity: `year`,
    //   granularity: `day`,
    //   scheduledRefresh: false,
    //   indexes: {
    //     ad_client_idx: {
    //       columns: [Client.ad_client_id]
    //     },
    //     c_bpartner_idx: {
    //       columns: [c_bpartner_id]
    //     },
    //     m_product_idx: {
    //       columns: [m_product_id]
    //     },
    //     salesrep_idx: {
    //       columns: [salesrep_id]
    //     },
    //     dateinvoiced_idx: {
    //       columns: [dateinvoiced]
    //     }
    //   }
    // }
  },

});
