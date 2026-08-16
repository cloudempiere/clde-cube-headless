cube(`Warehouse`, {
    sql: 
    `
    SELECT * from  (
      SELECT m.ad_client_id,
          m.ad_org_id,
          loc.m_warehouse_id,
          ml.m_locator_id,
          'Movement' as ad_table,
          m.M_Movement_id AS record_id,
          ml.m_movementline_uu as line_uuid,
          m.m_movement_uu as doc_uuid,    
          m.MovementDate as movementdate,
          ml.created,
          ml.updated,
          m.documentno,
          m.c_doctype_id,
          dt.name as c_doctype_name,
          dt.docbasetype,
          dt.docbasetype AS c_docbasetype_name_code,
          m.docstatus,
          CASE 
            WHEN m.processed='Y' THEN 'true'
            ELSE 'false'
          END as processed,
          CASE 
            WHEN dt.issotrx='Y' THEN 'true'
            ELSE 'false'
          END as issotrx,
          salesrep_id,
          ml.m_product_id,
          m.c_bpartner_id,
          ml.movementqty as qty,
          m.docstatus AS c_docstatus_name_code,
          '' as warehouseproces,
          m.approvedby
        FROM M_Movement m
        LEFT JOIN m_movementline ml ON m.M_Movement_id = ml.M_Movement_id
        LEFT JOIN m_locator loc ON loc.m_locator_id=ml.m_locator_id
        LEFT JOIN c_doctype dt ON dt.C_Doctype_ID = m.C_Doctype_ID
      
      UNION ALL
        SELECT 
          ioc.ad_client_id,
          ioc.ad_org_id,
          loc.m_warehouse_id,
          iol.m_locator_id,
          'ShipConfirm' as ad_table,
          ioc.m_inoutconfirm_id AS record_id,
          iolc.M_InOutLineConfirm_uu as line_uuid,
          ioc.M_InOutConfirm_uu as doc_uuid,
          ioc.created as movementdate,
          ioc.created,
          ioc.updated,
          ioc.documentno,
          ioc.c_doctype_id,
          dt.name as c_doctype_name,
          dt.docbasetype,
          dt.docbasetype AS c_docbasetype_name_code,
          ioc.docstatus,
          CASE 
            WHEN ioc.processed='Y' THEN 'true'
            ELSE 'false'
          END as processed,
          CASE 
            WHEN dt.issotrx='Y' THEN 'true'
            ELSE 'false'
          END as issotrx,
          ioc.salesrep_id,
          iol.m_product_id,
          io.c_bpartner_id,
          iolc.targetqty as qty,
          ioc.docstatus AS c_docstatus_name_code,
          '' as warehouseproces,
          ioc.salesrep_id as approvedby
        FROM M_InOutConfirm ioc
        LEFT JOIN M_InOutLineConfirm iolc ON ioc.M_InOutConfirm_ID = iolc.M_InOutConfirm_ID
        JOIN M_InOutLine iol ON iol.M_InOutLine_id = iolc.M_InOutLine_id
        JOIN M_InOut io ON io.M_InOut_id = iol.M_InOut_id
        LEFT JOIN m_locator loc ON loc.m_locator_id=iol.m_locator_id
        LEFT JOIN c_doctype dt ON dt.C_Doctype_ID = ioc.C_Doctype_ID
        
      UNION ALL
       SELECT 
          iol.ad_client_id,
          iol.ad_org_id,
          io.m_warehouse_id,
          iol.m_locator_id,
          'Shipment' as ad_table,
          iol.m_inoutline_id AS record_id,
          iol.m_inoutline_uu as line_uuid,
          io.m_inout_uu as doc_uuid, 
          iol.created as movementdate,
          iol.created,
          iol.updated,
          io.documentno,
          io.c_doctype_id,
          dt.name as c_doctype_name,
          dt.docbasetype,
          dt.docbasetype AS c_docbasetype_name_code,
          io.docstatus,
          CASE 
            WHEN io.processed='Y' THEN 'true'
            ELSE 'false'
          END as processed,
          CASE 
            WHEN dt.issotrx='Y' THEN 'true'
            ELSE 'false'  END as issotrx,
          io.salesrep_id,
          iol.m_product_id,
          io.c_bpartner_id,
          iol.movementqty as qty,
          io.docstatus AS c_docstatus_name_code,
          '' as warehouseproces,
          io.salesrep_id as approvedby
        FROM M_InOut io
        JOIN M_InOutLine iol ON io.M_InOut_id = iol.M_InOut_id
        LEFT JOIN c_doctype dt ON dt.C_Doctype_ID = io.C_Doctype_ID
      
      UNION ALL
        SELECT 
          pl.ad_client_id,
          pl.ad_org_id,
          loc.m_warehouse_id,
          pl.m_locator_id,
          'Production' as ad_table,
          pl.M_ProductionLine_id AS record_id,
          pl.M_ProductionLine_uu as line_uuid,
          p.M_Production_uu as doc_uuid,    
          pl.created as movementdate,
          pl.created,
          pl.updated,
          p.documentno,
          p.c_doctype_id,
          dt.name as c_doctype_name,
          dt.docbasetype,
          dt.docbasetype AS c_docbasetype_name_code,
          p.docstatus,
          CASE 
            WHEN p.processed='Y' THEN 'true'
            ELSE 'false'
          END as processed,
          CASE 
            WHEN dt.issotrx='Y' THEN 'true'
            ELSE 'false'
          END as issotrx,
          p.salesrep_id,
          pl.m_product_id,
          p.c_bpartner_id,
          pl.movementqty as qty,
          p.docstatus AS c_docstatus_name_code,
          '' as warehouseproces,
          p.salesrep_id as approvedby
        FROM M_Production p
        JOIN M_ProductionLine pl ON p.M_Production_id = pl.M_Production_id
        LEFT JOIN m_locator loc  ON loc.m_locator_id=p.m_locator_id
        LEFT JOIN c_doctype dt ON dt.C_Doctype_ID = p.C_Doctype_ID
      
      UNION ALL
        SELECT 
          il.ad_client_id,
          il.ad_org_id,
          i.m_warehouse_id,
          il.m_locator_id,
          'Physical Inventory' as ad_table,
          il.M_InventoryLine_id AS record_id,
          il.M_InventoryLine_uu as line_uuid,
          i.M_Inventory_uu as doc_uuid,    
          il.created as movementdate,
          il.created,
          il.updated,
          i.documentno,
          i.c_doctype_id,
          dt.name as c_doctype_name,
          dt.docbasetype,
          dt.docbasetype AS c_docbasetype_name_code,
          i.docstatus,
          CASE 
            WHEN i.processed='Y' THEN 'true'
            ELSE 'false'
          END as processed,
          CASE 
            WHEN dt.issotrx='Y' THEN 'true'
            ELSE 'false' 
          END as issotrx,
          i.salesrep_id,
          il.m_product_id,
          0 as c_bpartner_id,
          il.QtyCount as qty,
          i.docstatus AS c_docstatus_name_code,
          '' as warehouseproces,
          i.salesrep_id as approvedby
        FROM M_Inventory i
        JOIN M_InventoryLine il ON i.M_Inventory_id = il.M_Inventory_id
        LEFT JOIN m_locator loc ON loc.m_locator_id=il.m_locator_id
        LEFT JOIN c_doctype dt ON dt.C_Doctype_ID = i.C_Doctype_ID
        ) sq
        WHERE 1=1 AND ${FILTER_PARAMS.Warehouse.date.filter('movementdate')}
        AND movementdate >= DATE '2000-01-01' AND movementdate < CURRENT_DATE + INTERVAL '1 year'
      `,
  
      // refresh_key: {
      //   every: `5 minute`
      //   //sql: `SELECT MAX(created) FROM ?????`
      // },

    title: `Warehouse`,
    description: `All Client/Tenant related information`,
    sql_alias: `wms`,

    joins: {
    // Restores the join paths for members stripped during migration; the
    // labels are exposed through the Inventory view.
    Warehouselayout: {
      relationship: `many_to_one`,
      sql: `${CUBE}.m_locator_id = ${Warehouselayout}.m_locator_id`
    },
    Product: {
      relationship: `many_to_one`,
      sql: `${CUBE}.m_product_id = ${Product}.m_product_id`
    },
    Businesspartner: {
      relationship: `many_to_one`,
      sql: `${CUBE}.c_bpartner_id = ${Businesspartner}.c_bpartner_id`
    },
    User: {
      relationship: `many_to_one`,
      sql: `${CUBE}.ad_user_id = ${User}.ad_user_id`
    },
    // Translated labels now come from domain-scoped Reference cubes,
    // whose access_policy filters ad_language from the security context.
    DocumentStatus: {
      relationship: `many_to_one`,
      sql: `${CUBE}.c_docstatus_name_code = ${DocumentStatus}.value`
    },
    DocBaseType: {
      relationship: `many_to_one`,
      sql: `${CUBE}.c_docbasetype_name_code = ${DocBaseType}.value`
    },
      Client: {
        relationship: `many_to_one`,
        sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
      },
      Businesspartner: {
        relationship: `many_to_one`,
        sql: `${CUBE}.c_bpartner_id = ${Businesspartner}.c_bpartner_id`
      },
      Product: {
        relationship: `many_to_one`,
        sql: `${CUBE}.m_product_id = ${Product}.m_product_id`
      },
      Warehouselayout: {
        relationship: `many_to_one`,
        sql: `${CUBE}.m_locator_id = ${Warehouselayout}.m_locator_id`
      },
      User: {
        relationship: `many_to_one`,
        sql: `${CUBE}.salesrep_id = ${User}.ad_user_id`
      },
      Approver: {
        relationship: `many_to_one`,
        sql: `${CUBE}.approvedby = ${Approver}.ad_user_id`
      }
    },

    segments: {
        Inbound: {
          sql: `${CUBE}.issotrx = 'false'`
        },
        Outbound: {
          sql: `${CUBE}.issotrx = 'true'`
        }
      },

    measures: {
      linecount: {
        title: `DocumentLine Count`,
        sql: `record_id`,
        type: `count`
      },

      doccount: { // must be standardised to doc_cnt or just count ()
        title: `Document Count`,
        sql: `doc_uuid`,
        type: `countDistinctApprox`
      },

      qty: {
        title: `Quantity`,
        sql: `qty`,
        type: `sum`
      }
    },
  
    dimensions: {
      ad_client_id: {
        sql: `ad_client_id`,
        type: `number`,
        public: false
      },

      ad_org_id: {
        sql: `ad_org_id`,
        type: `number`,
        public: false
      },

      m_warehouse_id: {
        title: `Warehouse ID`,
        sql: `m_warehouse_id`,
        type: `number`,
        public: false
      },

      // warehouse: {
      //   title: `Warehouse`,
      //   sql: `${Warehouselayout}.warehouse`,
      //   type: `number`,
      //   public: true
      // },

      m_locator_id: {
        title: `Locator Identifier`,
        sql: `m_locator_id`,
        type: `number`,
        public: false
      },

      // MIGRATION v1.x: a dimension may not reference foreign cubes (Warehouselayout).
      // Expose through a view using join_path + prefix.
      //       locator: {
      //         title: `Locator`,
      //         sql: `${Warehouselayout}.value`,
      //         type: `boolean`
      //       },

      uuid: {
        sql: `uuid`,
        type: `number`,
        public: false,
        primary_key: true
      },

      movementdate: {
        title: `Document Date`,
        sql: `movementdate`,
        type: `time`,
        public: true
      },
  
      docstatuscode: {
        title: `Document Status Code`,
        sql: `c_docstatus_name`,
        type: `string`
      },

      docstatus: {
        title: `Document Status`,
        sql: `c_docstatus_name`,
        type: `string`
      },

      processed: {
        title: `Processed`,
        sql: `processed`,
        type: `boolean`
      },

      // MIGRATION v1.x: a dimension may not reference foreign cubes (User).
      // Expose through a view using join_path + prefix.
      //       picker: {
      //         title: `Picker`,
      //         sql: `COALESCE(${User}.lastname,'Empty')`,
      //         type: `string`
      //       },

      // MIGRATION v1.x: a dimension may not reference foreign cubes (Approver).
      // Expose through a view using join_path + prefix.
      //       approvedby: {
      //         title: `Approver`,
      //         sql: `COALESCE(${Approver}.lastname,'Empty')`,
      //         type: `string`
      //       },

      direction: {
        title: `Direction`,
        sql: `issotrx`,
        type: `boolean`
      },

      documenttype: {
        title: `Document Type`,
        sql: `c_doctype_name`,
        type: `string`
      },

      c_docbasetype_name: {
        title: `Document Base Type`,
        sql: `c_docbasetype_name`,
        type: `string`
      },

      // MIGRATION v1.x: a dimension may not reference foreign cubes (Product).
      // Expose through a view using join_path + prefix.
      //       product: {
      //         title: `Product`,
      //         sql: `${Product}.name`,
      //         type: `boolean`
      //       },

      // MIGRATION v1.x: a dimension may not reference foreign cubes (Productcategory).
      // Expose through a view using join_path + prefix.
      //       prodcategory: {
      //         title: `Product Category`,
      //         sql: `${Productcategory}.name`,
      //         type: `string`
      //       },

      // MIGRATION v1.x: a dimension may not reference foreign cubes (Businesspartner).
      // Expose through a view using join_path + prefix.
      //       bpartner: {
      //         title: `Customer Name`,
      //         sql: `${Businesspartner}.c_bpartner_name`,
      //         type: `string`
      //       }
  
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
      measures: [Warehouse.linecount, Warehouse.doccount, Warehouse.qty],
      // Client.ad_client_id, NOT <Cube>.ad_client_id: queryRewrite filters on
      // Client.ad_client_id, and a rollup only matches if the filtered member
      // is one of its dimensions. Using the cube's own column silently
      // disables the rollup for every tenant-scoped query.
      dimensions: [Client.ad_client_id],
      timeDimension: Warehouse.movementdate,
      granularity: `day`,
      partition_granularity: `year`,
      build_range_start: { sql: `SELECT DATE '2000-01-01'` },
      build_range_end:   { sql: `SELECT CURRENT_DATE + INTERVAL '1 year'` },
      refresh_key: { every: `1 day`, incremental: true, update_window: `90 day` },
    },


      // DEACTIVATED  2022 apr 05

      // picker: {
      //   type: `rollup`,
      //   //   measures: [Warehouse.linecount, Warehouse.doccount, Warehouse.qty],
      //   dimensions: [Client.ad_client_id, Warehouse.c_docbasetype_name, Warehouse.picker],
      //   timeDimension: Warehouse.movementdate,
      //   partition_granularity: `year`,
      //   granularity: `day`
      // },

      // doct: {
      //   type: `rollup`,
      //   // refresh_key: {
      //   //   every: `1 day`,
      //   //   incremental: true,
      //   //   update_window: `7 day`
      //   // },
      //   measures: [Warehouse.doccount, Warehouse.linecount, Warehouse.qty],
      //   dimensions: [Client.ad_client_id, Warehouse.picker, Warehouse.documenttype],
      //   useOriginalSqlPreAggregations: false,
      //   timeDimension: movementdate,
      //   partition_granularity: `year`,
      //   granularity: `day`,
      //   scheduledRefresh: false,
      //   indexes: {
      //     ad_client_idx: {
      //       columns: [ad_client_id]
      //     },
      //     picker_idx: {
      //       columns: [picker]
      //     },
      //     movementdate_idx: {
      //       columns: [movementdate]
      //     }
      //   }
      // },

    //   deep: {
    //     type: `rollup`,
    //     //     refresh_key: {
    //       every: `1 day`,
    //       incremental: true,
    //       update_window: `7 day`
    //     },
    //     measures: [Warehouse.doccount, Warehouse.linecount, Warehouse.qty],
    //     dimensions: [Client.ad_client_id, ad_org_id, locator, picker, direction, documenttype, product, prodcategory, bpartner ],
    //     useOriginalSqlPreAggregations: true,
    //     timeDimension: movementdate,
    //     partition_granularity: `year`,
    //     granularity: `day`,
    //     scheduledRefresh: false,
    //     indexes: {
    //       main_idx: {
    //         columns: [Client.ad_client_id, ad_org_id]
    //       },
    //       secondary_idx: {
    //         columns: [Client.ad_client_id, picker]
    //       },
    //       tercialy_idx: {
    //         columns: [movementdate]
    //       }
    //     }
    // }
  }
  
  });