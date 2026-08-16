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
      primaryKey: true,
      shown: true
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
      dbt.name as c_docbasetype_name,
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
      ds.name as c_docstatus_name,
      COALESCE(dr.lastname,'Empty') as  driver_name,
      CASE 
      WHEN io.isshipped='Y' THEN 'true'
      ELSE 'false'  END as isshipped,
      COALESCE (srio.name, srbpl.name) as shippingregion,
      io.shipdate,
      dvr.name as deliveryviarule,
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
    JOIN rv_ad_reference_trl ds ON io.docstatus = ds.value::bpchar AND ds.ad_reference_id = 131::numeric AND ${SECURITY_CONTEXT.ad_language.filter('ds.ad_language')}
    JOIN rv_ad_reference_trl dbt ON dt.docbasetype = dbt.value::bpchar AND dbt.ad_reference_id = 183::numeric AND ${SECURITY_CONTEXT.ad_language.filter('dbt.ad_language')}
    JOIN rv_ad_reference_trl dvr ON io.DeliveryViaRule = dvr.value::bpchar AND dvr.ad_reference_id = 152::numeric AND ${SECURITY_CONTEXT.ad_language.filter('dvr.ad_language')}

    LEFT JOIN LATERAL (SELECT SUM(ROUND(COALESCE(ol.PriceActual*iol.MovementQty,0), 2)) AS totallines FROM M_InOutLine iol JOIN C_OrderLine ol ON ol.C_OrderLine_ID = iol.C_OrderLine_ID 
    WHERE iol.M_InOut_ID =io.M_InOut_ID) as prices ON true AND ${SECURITY_CONTEXT.ad_client_id.filter('io.ad_client_id')} AND ${FILTER_PARAMS.Logisticfacts.date.filter('io.shipdate')}
      `,

      // refreshKey: {
      //    sql: `SELECT MAX(created) FROM M_InOut`
      // },

      joins: {
        Client: {
          relationship: `belongsTo`,
          sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
        },
        Organization: {
          relationship: `hasMany`,
          sql: `${CUBE}.ad_org_id = ${Organization}.ad_org_id`
        },
        Businesspartner: {
          relationship: `belongsTo`,
          sql: `${CUBE}.c_bpartner_location_id = ${Businesspartner}.c_bpartner_location_id`
        },
        Dropshipcustomers: {
          relationship: `belongsTo`,
          sql: `${CUBE}.dropship_location_id = ${Dropshipcustomers}.c_bpartner_location_id`
        }
        // Shipprice: {
        //   relationship: `hasOne`,
        //   sql: `${CUBE}.m_inout_id = ${Shipprice}.m_inout_id`
        // }
      },

      title: `Logistic Fact`,
      description: `Logistic Plannning related information`,
      sqlAlias: `log`,


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
          shown: false
        },

        ad_org_id: {
          title: `Organization ID`,
          sql: `ad_org_id`,
          type: `number`,
          shown: false
        },

        m_inout_id: {
          title: `Shipent ID`,
          description: `Shipment database primary key`,
          sql: `m_inout_id`,
          type: `number`,
          primaryKey: true,
          shown: true
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

        shippingregion: {
          title: `Shipping Region`,
          sql: `(CASE WHEN isdropship='Y' THEN ${Dropshipcustomers}.c_shippingregion_name ELSE ${Businesspartner}.c_shippingregion_name END)`,
          type: `string`
        },

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
        
        longitude: {
          title: `Longitude`,
          sql: `COALESCE ((CASE WHEN isdropship='Y' THEN ${Dropshipcustomers}.longitude::numeric ELSE ${Businesspartner}.longitude::numeric END),48.21372380)`,
          type: `number`
        },
    
        latitude: {
          title: `Latitude`,
          sql: `COALESCE ((CASE WHEN isdropship='Y' THEN ${Dropshipcustomers}.latitude::numeric ELSE ${Businesspartner}.latitude::numeric END),48.21372380)`,
          type: `number`
        },

        city: {
          title: `City`,
          sql: `${Businesspartner}.city`,
          type: `string`
        },

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

        bpartner: {
          title: `Bpartner Name`,
          sql: `CASE WHEN isdropship='Y' THEN ${Dropshipcustomers}.c_bpartner_name ELSE ${Businesspartner}.c_bpartner_name END`,
          type: `string`
        },

        c_bpartner_location_id: {
          title: `Bpartner Location ID`,
          sql: `c_bpartner_location_id`,
          type: `string`
        },

        c_bpartner_location_name: {
          title: `Bpartner Location Name`,
          sql: `CASE WHEN isdropship='Y' THEN ${Dropshipcustomers}.c_bpartner_location_name ELSE ${Businesspartner}.c_bpartner_location_name END`,
          type: `string`
        },

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

    // shipcntday: {
    //   type: `rollup`,
    //   external: true,
    //   measureReferences: [Logisticfacts.shipmentcount],
    //   dimensionReferences: [Client.ad_client_id, Logisticfacts.deliveryviarule],
    //   timeDimensionReference: Logisticfacts.shipdate,
    //   partitionGranularity: `month`,
    //   granularity: `day`,
    //   scheduledRefresh: false
    // },


    // shipcn: {
    //   type: `rollup`,
    //   external: true,
    //   measureReferences: [Logisticfacts.shipmentcount],
    //   dimensionReferences: [Client.ad_client_id, Logisticfacts.c_docbasetype_name, Logisticfacts.driver_name, Logisticfacts.issotrx],
    //   timeDimensionReference: Logisticfacts.shipdate,
    //   partitionGranularity: `month`,
    //   granularity: `day`,
    //   scheduledRefresh: false      
    // },

    // def: {
    //   type: `rollup`,
    //   external: true,
    //   // refreshKey: {
    //   //   every: `1 day`,
    //   //   incremental: true,
    //   //   updateWindow: `7 day`
    //   // },
    //   measureReferences: [shipmentcount, freightstopunloads, freightlinenetamt, freightweight],
    //   dimensionReferences: [Client.ad_client_id, ad_org_id, driver_name, shippingregion, isshipped, c_docbasetype_name, documenttype, city, deliveryviarule, issotrx, bpartner, pickuptypes, m_shipper_name ],
    //   useOriginalSqlPreAggregations: true,
    //   timeDimensionReference: shipdate,
    //   partitionGranularity: `month`,
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