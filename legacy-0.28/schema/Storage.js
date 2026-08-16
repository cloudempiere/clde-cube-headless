cube(`Storage`, {
  sql: `
    
    SELECT 
      t.ad_client_id,
      t.ad_org_id,
      t.m_transaction_id,
      l.m_warehouse_id,
      t.m_locator_id,
      t.created,
      t.updated,
      t.m_product_id,
      t.movementdate,
      t.movementqty
    FROM m_transaction t
    JOIN m_locator l ON l.m_locator_id = t.m_locator_id
    --where t.ad_client_id=11
    --WHERE ${SECURITY_CONTEXT.ad_client_id.filter('t.ad_client_id')} 
    
    where t.ad_client_id=1000036 AND ${FILTER_PARAMS.Storage.date.filter('t.movementdate')} AND ${FILTER_PARAMS.Storage.date.filter('t.m_product_id')}

    --where t.movementdate > '2020-04-25' 
    --where t.M_Product_ID=1116440  
    --OR t.M_Product_ID=1116428
`,

// refreshKey: {
//   every: `1 day`
// },


joins: {
  Client: {
    relationship: `belongsTo`,
    sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
  }
  // Product: {
  //   relationship: `belongsTo`,
  //   sql: `${CUBE}.m_product_id = ${Product}.m_product_id`
  // }
},

  title: `Storage`,
  description: `Storage Level caclulated from Material Transactions`,
  sqlAlias: `strg`,

  measures: {
    movementqty: {
      sql: `movementqty`,
      type: `sum`
    },

    // qtyabs: {
    //   sql: `ABS(movementqty)`,
    //   type: `sum`
    // },

    // qtywhbal: {
    //   title: `Qty WH Balance`,
    //   sql: `movementqty`,
    //   type: `sum`,
    //   rollingWindow: {
    //     trailing: `unbounded`,
    //     offset: `start`
    //   }
    // },

    qtylocbal: {
      title: `Qty Balance`,
      sql: `COALESCE (movementqty,0)`,
      type: `sum`,
      rollingWindow: {
        trailing: `unbounded`,
        offset: `end`
      },
      // filters: [
      //   { sql: `${CUBE}.movementqty > 0` }
      // ]
    }
  },

  dimensions: {
    ad_client_id: {
      title: `Tenant`,
      sql: `ad_client_id`,
      type: `string`
    },    

    ad_org_id: {
      title: `Org/Company`,
      sql: `ad_org_id`,
      type: `number`
    },

    m_transaction_id: {
      title: `Transaction ID`,
      sql: `m_transaction_id`,
      type: `number`,
      primaryKey: true
    },

    movementdate: {
      title: `Storage Date`,
      sql: `movementdate`,
      type: `time`,
      shown: true,
      primaryKey: false
    },

    m_warehouse_id: {
      title: `Warehouse`,
      sql: `m_warehouse_id`,
      type: `number`
    },

    m_locator_id: {
      title: `Locator`,
      sql: `m_locator_id`,
      type: `number`
    },

    m_product_id: {
      title: `Product ID`,
      sql: `m_product_id`,
      type: `number`
    }

    // product: {
    //   title: `Product`,
    //   sql: `${Product}.name`,
    //   type: `string`
    // }
  },

  preAggregations: {
    // balance: {
    //   type: `rollup`,
    //   external: true,
    //   refreshKey: {
    //     every: `1 day`,
    //     incremental: true,
    //     updateWindow: `7 day`
    //   },
    //   measureReferences: [movementqty, qtylocbal],
    //   dimensionReferences: [Client.ad_client_id, m_product_id],
    //   timeDimensionReference: movementdate,
    //   partitionGranularity: `month`,
    //   granularity: `day`,
    //   indexes: {
    //     main_idx: {
    //       columns: [Client.ad_client_id]
    //     },
    //     m_product_idx: {
    //       columns: [m_product_id]
    //     },
    //     movementdate_idx: {
    //       columns: [movementdate]
    //     }
    //   }
    // }
  }

});

// TESTING QUERY

// {
//   "measures": [
//     "Storage.qty",
//     "Storage.qtywhbal",
//     "Storage.qtylocbal"
//   ],
  
//   "timeDimensions": [
//     {
//       "dimension": "Storage.movementdate",
//       "dateRange":["2015-05-03T00:00:00Z","2015-06-30T00:00:00Z"],
//       "granularity": "day"
//     }
//   ],
//   "dimensions": [],
  
//   "filters": [],
//   "order": {
//     "Storage.movementdate": "asc"
//   },
//  "renewQuery": "true"
// }

