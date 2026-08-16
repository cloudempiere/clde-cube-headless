cube(`Shipprice`, {
  sql: `select m_inout_id, totallinesx from m_inout io
        JOIN LATERAL get_inout_totallines(io.M_InOut_ID,0) totallinesx ON true
        `,

  measures: {
    totallinesx: {
      sql: `totallinesx`,
      type: `sum`
    }
  },

  dimensions: {
    m_inout_id: {
      title: `Shipent ID`,
      description: `Shipment database primary key`,
      sql: `m_inout_id`,
      type: `number`,
      primary_key: true,
      public: true
    }
  }

});

cube(`Logisticfacts`, {
    sql: 
     `
      SELECT 
      io.ad_client_id,
      io.ad_org_id,
      io.m_inout_id,
      io.m_warehouse_id,
      'Shipment' as ad_table,
      io.movementdate AS docdate,
      io.created,
      io.updated,
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
      CASE
        WHEN io.deliveryviarule='S' AND io.driver_id is not NULL THEN 'true'
        ELSE 'false'  END as isFreightPlanned,
      io.salesrep_id,
      io.c_bpartner_id,
      CASE WHEN io.IsDropShip='Y' THEN io.dropship_location_id
      ELSE io.c_bpartner_location_id END as c_bpartner_location_id,
      CASE WHEN io.isdropship='Y' THEN 'true'
      ELSE 'false' END as isdropship,
      io.dropship_location_id,
      io.docstatus AS c_docstatus_name_code,
      COALESCE(dr.lastname,'Empty') as  driver_name,
      CASE 
      WHEN io.isshipped='Y' THEN 'true'
      ELSE 'false'  END as isshipped,
      COALESCE (srio.name, srbpl.name) as shippingregion,
      io.shipdate,
      io.DeliveryViaRule AS deliveryviarule_code,
      io.M_ShipperPickupTypes_ID,
      pstio.name as pickuptypes,
      ROUND(io.weight,1) as weight,
      prices.totallines,
      shpr.name as m_shipper_name

    FROM M_InOut io    
    LEFT JOIN c_bpartner_location bpl ON bpl.c_bpartner_location_id = io.c_bpartner_location_id
    LEFT JOIN M_Shipper shpr ON shpr.M_Shipper_id = io.M_Shipper_id
    LEFT JOIN ad_user dr ON io.driver_id = dr.ad_user_id
    LEFT JOIN c_shippingregion srio ON (srio.c_shippingregion_id=io.c_shippingregion_id)
    LEFT JOIN c_shippingregion srbpl ON (srbpl.c_shippingregion_id=bpl.c_shippingregion_id)
    LEFT JOIN M_ShipperPickupTypes pstio ON (pstio.M_ShipperPickupTypes_ID=io.M_ShipperPickupTypes_ID)
    LEFT JOIN c_doctype dt ON dt.C_Doctype_ID = io.C_Doctype_ID

    LEFT JOIN LATERAL (SELECT SUM(ROUND(COALESCE(ol.PriceActual*iol.MovementQty,0), 2)) AS totallines FROM M_InOutLine iol JOIN C_OrderLine ol ON ol.C_OrderLine_ID = iol.C_OrderLine_ID 
    WHERE iol.M_InOut_ID =io.M_InOut_ID) as prices ON true AND 1=1 AND ${FILTER_PARAMS.Logisticfacts.date.filter('io.shipdate')}
    WHERE io.shipdate >= DATE '2000-01-01' AND io.shipdate < CURRENT_DATE + INTERVAL '1 year'
      `,

      // refresh_key: {
      //    sql: `SELECT MAX(created) FROM M_InOut`
      // },

      joins: {
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
    DeliveryViaRule: {
      relationship: `many_to_one`,
      sql: `${CUBE}.deliveryviarule_code = ${DeliveryViaRule}.value`
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
          relationship: `many_to_one`,
          sql: `${CUBE}.c_bpartner_location_id = ${Businesspartner}.c_bpartner_location_id`
        },
        Dropshipcustomers: {
          relationship: `many_to_one`,
          sql: `${CUBE}.dropship_location_id = ${Dropshipcustomers}.c_bpartner_location_id`
        }
        // Shipprice: {
        //   relationship: `one_to_one`,
        //   sql: `${CUBE}.m_inout_id = ${Shipprice}.m_inout_id`
        // }
      },

      title: `Logistic Fact`,
      description: `Logistic Plannning related information`,
      sql_alias: `log`,


      measures: {
        shipmentcount: {
          title: `Shipping Count`,
          sql: `m_inout_id`,
          type: `count`
        },

        freightstopunloads: {
          title: `Unload Count`,
          description: `Number of delivered shipments at customer location`,
          sql: `c_bpartner_location_id`,
          type: `countDistinctApprox`
        },

        freightlinenetamt: {
          title: `Shipment Value`,
          description: `Value of shipment`,
          sql: `totallines`,
          type: `sum`
        },

        freightweight: {
          title: `Shipment Weight`,
          description: `Weight of Shipment`,
          sql: `weight`,
          type: `sum`
        }

        // shipprice: {
        //   sql: `${ShipPriceTotallines}`,
        //   type: `sum`
        // }

        // noofpackages: {
        //   title: `No of packages`,
        //   Description: `Number of Shipped packages`,
        //   sql: `grandtotal`,
        //   type: `number`
        // },

        // ShipmentsPastPeriod: {
        //   title: `Past Period`,
        //   sql: `m_inout_id`,
        //   type: `count`,
        //   filters: [
        //     { sql: `${CUBE}.shipdate-1`}
        //   ]
        // }

        // averagelinenetamt: {
        //   title: `Average Sales`,
        //   description: `Average Price of Shipment`,
        //   sql: `weight`,
        //   type: `avg`
        // }

      },
      
      dimensions: {

      //subquery
        // freighttotallines: {
        //   sql: `${Shipprice.totallines}`,
        //   type: `number`,
        //   subQuery: true
        // },

        ad_client_id: {
          title: `Client/Tenant`,
          sql: `ad_client_id`,
          type: `number`,
          public: false
        },

        ad_org_id: {
          title: `Organization ID`,
          sql: `ad_org_id`,
          type: `number`,
          public: false
        },

        m_inout_id: {
          title: `Shipent ID`,
          description: `Shipment database primary key`,
          sql: `m_inout_id`,
          type: `number`,
          primary_key: true,
          public: true
        },

        documentno: {
          title: `DocumentNo`,
          sql: `documentno`,
          type: `string`
        },

        driver_name: {
          title: `Driver`,
          sql: `driver_name`,
          type: `string`
        },

        // MIGRATION v1.x: a dimension may not reference foreign cubes (Dropshipcustomers, Businesspartner).
        // Expose through a view using join_path + prefix.
        //         shippingregion: {
        //           title: `Shipping Region`,
        //           sql: `(CASE WHEN isdropship='Y' THEN ${Dropshipcustomers}.c_shippingregion_name ELSE ${Businesspartner}.c_shippingregion_name END)`,
        //           type: `string`
        //         },

        isshipped: {
          title: `Shipped`,
          sql: `isshipped`,
          type: `boolean`
        },

        shipdate: {
          title: `Date Plan Ship`,
          sql: `shipdate`,
          type: `time`
        },

        c_docbasetype_name: {
          title: `Document Base Type`,
          sql: `c_docbasetype_name`,
          type: `string`
        },

        documenttype: {
          title: `Document Type`,
          sql: `c_doctype_name`,
          type: `string`
        },
        
        // MIGRATION v1.x: a dimension may not reference foreign cubes (Dropshipcustomers, Businesspartner).
        // Expose through a view using join_path + prefix.
        //         longitude: {
        //           title: `Longitude`,
        //           sql: `COALESCE ((CASE WHEN isdropship='Y' THEN ${Dropshipcustomers}.longitude::numeric ELSE ${Businesspartner}.longitude::numeric END),48.21372380)`,
        //           type: `number`
        //         },
    
        // MIGRATION v1.x: a dimension may not reference foreign cubes (Dropshipcustomers, Businesspartner).
        // Expose through a view using join_path + prefix.
        //         latitude: {
        //           title: `Latitude`,
        //           sql: `COALESCE ((CASE WHEN isdropship='Y' THEN ${Dropshipcustomers}.latitude::numeric ELSE ${Businesspartner}.latitude::numeric END),48.21372380)`,
        //           type: `number`
        //         },

        // MIGRATION v1.x: a dimension may not reference foreign cubes (Businesspartner).
        // Expose through a view using join_path + prefix.
        //         city: {
        //           title: `City`,
        //           sql: `${Businesspartner}.city`,
        //           type: `string`
        //         },

        deliveryviarule: {
          title: `Delivery Via Rule`,
          sql: `deliveryviarule`,
          type: `string`
        },

        issotrx: {
          sql: `issotrx`,
          type: `boolean`
        },


        isdropship: {
          title: `Transaction is Dropship`,
          sql: `isdropship`,
          type: `boolean`
        },

        // MIGRATION v1.x: a dimension may not reference foreign cubes (Dropshipcustomers, Businesspartner).
        // Expose through a view using join_path + prefix.
        //         bpartner: {
        //           title: `Bpartner Name`,
        //           sql: `CASE WHEN isdropship='Y' THEN ${Dropshipcustomers}.c_bpartner_name ELSE ${Businesspartner}.c_bpartner_name END`,
        //           type: `string`
        //         },

        c_bpartner_location_id: {
          title: `Bpartner Location ID`,
          sql: `c_bpartner_location_id`,
          type: `string`
        },

        // MIGRATION v1.x: a dimension may not reference foreign cubes (Dropshipcustomers, Businesspartner).
        // Expose through a view using join_path + prefix.
        //         c_bpartner_location_name: {
        //           title: `Bpartner Location Name`,
        //           sql: `CASE WHEN isdropship='Y' THEN ${Dropshipcustomers}.c_bpartner_location_name ELSE ${Businesspartner}.c_bpartner_location_name END`,
        //           type: `string`
        //         },

        pickuptypes: {
          title: `Shipper Pickup Types`,
          sql: `pickuptypes`,
          type: `string`
        },

        isfreightplanned: {
          title: `Document is planned in Freight Plan`,
          sql: `isFreightPlanned`,
          type: `boolean`
        },

        m_shipper_name: {
          title: `Shipper`,
          description: `Name of the Shipper (can be external, internal)`,
          sql: `m_shipper_name`,
          type: `string`
        }


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
      measures: [Logisticfacts.shipmentcount, Logisticfacts.freightstopunloads, Logisticfacts.freightlinenetamt, Logisticfacts.freightweight],
      // Client.ad_client_id, NOT <Cube>.ad_client_id: queryRewrite filters on
      // Client.ad_client_id, and a rollup only matches if the filtered member
      // is one of its dimensions. Using the cube's own column silently
      // disables the rollup for every tenant-scoped query.
      dimensions: [Client.ad_client_id],
      timeDimension: Logisticfacts.shipdate,
      granularity: `day`,
      partition_granularity: `year`,
      build_range_start: { sql: `SELECT DATE '2000-01-01'` },
      build_range_end:   { sql: `SELECT CURRENT_DATE + INTERVAL '1 year'` },
      refresh_key: { every: `1 day`, incremental: true, update_window: `90 day` },
    },

    // shipcntday: {
    //   type: `rollup`,
    //   //   measures: [Logisticfacts.shipmentcount],
    //   dimensions: [Client.ad_client_id, Logisticfacts.deliveryviarule],
    //   timeDimension: Logisticfacts.shipdate,
    //   partition_granularity: `year`,
    //   granularity: `day`,
    //   scheduledRefresh: false
    // },


    // shipcn: {
    //   type: `rollup`,
    //   //   measures: [Logisticfacts.shipmentcount],
    //   dimensions: [Client.ad_client_id, Logisticfacts.c_docbasetype_name, Logisticfacts.driver_name, Logisticfacts.issotrx],
    //   timeDimension: Logisticfacts.shipdate,
    //   partition_granularity: `year`,
    //   granularity: `day`,
    //   scheduledRefresh: false      
    // },

    // def: {
    //   type: `rollup`,
    //   //   // refresh_key: {
    //   //   every: `1 day`,
    //   //   incremental: true,
    //   //   update_window: `7 day`
    //   // },
    //   measures: [shipmentcount, freightstopunloads, freightlinenetamt, freightweight],
    //   dimensions: [Client.ad_client_id, ad_org_id, driver_name, shippingregion, isshipped, c_docbasetype_name, documenttype, city, deliveryviarule, issotrx, bpartner, pickuptypes, m_shipper_name ],
    //   useOriginalSqlPreAggregations: true,
    //   timeDimension: shipdate,
    //   partition_granularity: `year`,
    //   granularity: `day`,
    //   //scheduledRefresh: false,
    //   indexes: {
    //     main_idx: {
    //       columns: [Client.ad_client_id]
    //     },
    //     secondary_idx: {
    //       columns: [shipdate]
    //     }
    //   }
    // }

  }

});