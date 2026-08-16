cube(`Dropshipcustomers`, {
  extends: Businesspartner,
  sql: `select * from ${Businesspartner.sql()} bpdrp where isCustomer = 'Y'`,

  title: `DropShip Customerrs`,
  description: `All Dropship related information`,
  sql_alias: `bpdrp`,

});

cube(`Vendors`, {
  extends: Businesspartner,
  sql: `select * from ${Businesspartner.sql()} bpvnd where isVendor = 'Y'`,

  title: `Vendor`,
  description: `Vendor related information`,
  sql_alias: `bpvnd`,

});

cube(`Businesspartner`, {
  sql: 
   `
    SELECT 
      bp.ad_client_id,  
      bp.c_bpartner_id, 
      bp.ad_org_id,
      bp.value,
      bp.name as c_bpartner_name,
      bp.isactive,
      bp.created,
      bp.updated,
      bp.iscustomer,
      bp.isvendor,
      bp.isemployee AS bpartner_employee,
      bpg.value AS bpartner_group_search_key,
      bpg.name AS bpartner_group_name,
      bpg.description AS bpartner_group_description,
      bp.salesrep_id,
      bp.abcanalysisgroup as c_bpartner_abcanalysisgroup
      FROM c_bpartner bp
      LEFT JOIN c_bp_group bpg ON bp.c_bp_group_id = bpg.c_bp_group_id
      WHERE 1=1
    `,

  //   refresh_key: {
  //     sql: `SELECT MAX(created) FROM c_bpartner`
  //  },

  
  title: `Bpartner`,
  description: `All Bpartner related information`,
  sql_alias: `bp`,

  joins: {
    Client: {
      relationship: `many_to_one`,
      sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    },
    User: {
      relationship: `many_to_one`,
      sql: `${CUBE}.salesrep_id = ${User}.ad_user_id`
    }
  },

  measures: {
    count: {
      title: `Total Count`,
      sql: `c_bpartner_id`,
      type: `count`
    }
  },

  dimensions: {
    ad_client_id: {
      sql: `ad_client_id`,
      type: `number`,
      format: `id`,
      public: false
    },

    ad_org_id: {
      sql: `ad_org_id`,
      type: `number`,
      format: `id`,
      public: false
    },

    c_bpartner_id: {
      title: `Business Partner ID`,
      description: `Business Partner database primary key`,
      sql: `c_bpartner_id`,
      type: `number`,
      format: `id`,
      primary_key: true,
      public: true
    },
    
    c_bpartner_name: {
      title: `Company`,
      sql: `c_bpartner_name`,
      type: `string`,
      primary_key: false,
      public: true
    },



    value: {
      title: `Value`,
      sql: `value`,
      type: `string`
    },



    bpgroup: {
      title: `BP Group`,
      sql: `bpartner_group_name`,
      type: `string`
    },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (User).
    // Expose through a view using join_path + prefix.
    //     salesrep: {
    //       title: `Sales Representative`,
    //       sql: `${User}.name`,
    //       type: `string`
    //     },

    c_bpartner_created: {
      title: `BP Created`,
      sql: `created`,
      type: `time`
    },

    isCustomer: {
      title: `Customer`,
      sql: `iscustomer`,
      type: `boolean`
    },

    c_bpartner_abcanalysisgroup: {
      title: `ABC analysis group`,
      sql: `COALESCE(c_bpartner_abcanalysisgroup,'C')`,
      type: `string`
    },





  },

  preAggregations: {

    cnt: {
      type: `rollup`,

      measures: [Businesspartner.count],
      // salesrep was stripped in migration (it referenced the User cube) and is
      // now exposed via a view. A pre-aggregation may not reference it: the
      // model still COMPILES but any query on this cube fails at runtime with
      // "Cannot resolve: salesrep".
      dimensions: [Client.ad_client_id, Businesspartner.isCustomer],
      timeDimension: Businesspartner.c_bpartner_created,
      granularity: `day`,
      // No incremental: these are master-data cubes (c_bpartner 128,930 rows,
      // m_product_category 1,488) that rebuild fully in seconds. Cube rejects
      // incremental on a non-partitioned rollup, and the rejection aborts the
      // WHOLE refresh scheduler run - so this one flag stopped every other
      // pre-aggregation in the model from refreshing on schedule.
      refresh_key: {
        every: `1 day`,
      },
    },

    def: {
      type: `rollup`,

      measures: [Businesspartner.count],
      // region and contactperson dropped: they belonged to the location and
      // contact grain and now live on Bpartnerlocation. A pre-aggregation
      // naming a removed member breaks the whole CUBE, not just the rollup.
      dimensions: [Client.ad_client_id, Businesspartner.ad_org_id, Businesspartner.c_bpartner_id, Businesspartner.c_bpartner_name,
        Businesspartner.value, Businesspartner.bpgroup],
      timeDimension: Businesspartner.c_bpartner_created,
      granularity: `day`,
      // No incremental: these are master-data cubes (c_bpartner 128,930 rows,
      // m_product_category 1,488) that rebuild fully in seconds. Cube rejects
      // incremental on a non-partitioned rollup, and the rejection aborts the
      // WHOLE refresh scheduler run - so this one flag stopped every other
      // pre-aggregation in the model from refreshing on schedule.
      refresh_key: {
        every: `1 day`,
      },
      indexes: {
        ad_client_idx: {
          columns: [Client.ad_client_id]
        },
        c_bpartner_idx: {
          columns: [c_bpartner_id]
        }
      }
    }
  }
});