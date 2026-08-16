cube(`Dropshipcustomers`, {
  extends: Businesspartner,
  sql: `select * from ${Businesspartner.sql()} bpdrp where isCustomer = 'Y'`,

  title: `DropShip Customerrs`,
  description: `All Dropship related information`,
  sqlAlias: `bpdrp`,

});

cube(`Vendors`, {
  extends: Businesspartner,
  sql: `select * from ${Businesspartner.sql()} bpvnd where isVendor = 'Y'`,

  title: `Vendor`,
  description: `Vendor related information`,
  sqlAlias: `bpvnd`,

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
      CASE 
        WHEN bp.iscustomer='Y' THEN 'true'
        ELSE 'false'
      END as iscustomer,
      bp.isvendor,
      bp.isemployee AS bpartner_employee,
      bpg.value AS bpartner_group_search_key,
      bpg.name AS bpartner_group_name,
      bpg.description AS bpartner_group_description,
      c.name AS contactname,
      c.email,
      l.postal,
      l.city,
      l.address1,
      l.address2,
      l.address3,
      COALESCE(r.name, l.regionname) AS locationregionname,
      cc.name AS countryname,
      CASE
        WHEN bpl.isbillto = 'Y'::bpchar THEN 'BT'::text
        WHEN bpl.isshipto = 'Y'::bpchar THEN 'ST'::text
        WHEN bpl.ispayfrom = 'Y'::bpchar THEN 'PF'::text
        WHEN bpl.isremitto = 'Y'::bpchar THEN 'RT'::text
        ELSE NULL::text
      END AS addresstype,
      r.c_country_id AS c_region_c_country_id,
      c.department,
      bp.salesrep_id,
      bp.abcanalysisgroup as c_bpartner_abcanalysisgroup,
      l.latitude,
      l.longitude,
      bpl.c_bpartner_location_id,
      bpl.name as c_bpartner_location_name,
      sr.name as c_shippingregion_name
      FROM c_bpartner bp
      LEFT JOIN c_bpartner_location bpl ON bp.c_bpartner_id = bpl.c_bpartner_id
      LEFT JOIN c_bp_group bpg ON bp.c_bp_group_id = bpg.c_bp_group_id
      LEFT JOIN ad_user c ON bp.c_bpartner_id = c.c_bpartner_id 
      LEFT JOIN c_location l ON bpl.c_location_id = l.c_location_id
      LEFT JOIN c_region r ON l.c_region_id = r.c_region_id
      LEFT JOIN c_country cc ON l.c_country_id = cc.c_country_id
      LEFT JOIN c_shippingregion sr ON (sr.c_shippingregion_id=bpl.c_shippingregion_id)
      WHERE ${SECURITY_CONTEXT.ad_client_id.filter('bp.ad_client_id')}
    `,

  //   refreshKey: {
  //     sql: `SELECT MAX(created) FROM c_bpartner`
  //  },

  
  title: `Bpartner`,
  description: `All Bpartner related information`,
  sqlAlias: `bp`,

  joins: {
    Client: {
      relationship: `belongsTo`,
      sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    },
    User: {
      relationship: `belongsTo`,
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
      shown: false
    },

    ad_org_id: {
      sql: `ad_org_id`,
      type: `number`,
      format: `id`,
      shown: false
    },

    c_bpartner_id: {
      title: `Business Partner ID`,
      description: `Business Partner database primary key`,
      sql: `c_bpartner_id`,
      type: `number`,
      format: `id`,
      primaryKey: true,
      shown: true
    },
    
    c_bpartner_name: {
      title: `Company`,
      sql: `c_bpartner_name`,
      type: `string`,
      primaryKey: false,
      shown: true
    },

    c_bpartner_location_id: {
      sql: `c_bpartner_location_id`,
      type: `number`,
      format: `id`,
      // primaryKey: true,
      shown: false
    },

    c_bpartner_location_name: {
      title: `Bpartner Location Name`,
      sql: `c_bpartner_location_name`,
      type: `string`
    },

    value: {
      title: `Value`,
      sql: `value`,
      type: `string`
    },

    region: {
      title: `Location Region`,
      sql: `locationregionname`,
      type: `string`
    },

    contactperson: {
      title: `Contact`,
      sql: `contactname`,
      type: `string`
    },

    bpgroup: {
      title: `BP Group`,
      sql: `bpartner_group_name`,
      type: `string`
    },

    salesrep: {
      title: `Sales Representative`,
      sql: `${User}.name`,
      type: `string`
    },

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

    longitude: {
      title: `Longitude`,
      sql: `longitude`,
      type: `number`
    },

    latitude: {
      title: `Latitude`,
      sql: `latitude`,
      type: `number`
    },

    city: {
      title: `City`,
      sql: `city`,
      type: `string`
    }


  },

  preAggregations: {

    cnt: {
      type: `rollup`,
      external: true,
      measureReferences: [Businesspartner.count],
      dimensionReferences: [Client.ad_client_id, Businesspartner.isCustomer, Businesspartner.salesrep],
      timeDimensionReference: Businesspartner.c_bpartner_created,
      granularity: `day`,
      refreshKey: {
        every: `1 day`,
        incremental: true,
      },
    },

    def: {
      type: `rollup`,
      external: true,
      measureReferences: [Businesspartner.count],
      dimensionReferences: [Client.ad_client_id, Businesspartner.ad_org_id, Businesspartner.c_bpartner_id, Businesspartner.c_bpartner_name, 
        Businesspartner.value, Businesspartner.region, Businesspartner.contactperson, Businesspartner.bpgroup],
      timeDimensionReference: Businesspartner.c_bpartner_created,
      granularity: `day`,
      refreshKey: {
        every: `1 day`,
        incremental: true,
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