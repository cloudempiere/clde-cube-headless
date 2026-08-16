cube(`Approver`, {
  extends: User,
  sql: `select 
  ad_client_id,
  ad_org_id,
  updated,
  ad_user_id,
  value,
  name,
  firstname,
  lastname,
  isactive,
  email,
  phone,
  c_bpartner_search_key,
  c_bpartner_name,
  c_bpartner_name2,
  c_bpartner_created,
  c_bpartner_updated,
  c_bpartner_customer,
  c_bpartner_vendor,
  c_bpartner_employee,
  ad_user_location_name from ${User.sql()} apr`,

  title: `Approver`,
  description: `All Approvers related information`,
  sqlAlias: `apr`,

});

cube(`User`, {
  sql: `
  SELECT 
    u.ad_client_id,
    u.ad_org_id,
    u.updated,
    u.ad_user_id,
    u.value,
    u.name,
    u.firstname,
    u.lastname,
    u.isactive,
    u.email,
    u.phone,
    bp.value AS c_bpartner_search_key,
    bp.name AS c_bpartner_name,
    bp.name2 AS c_bpartner_name2,
    bp.created AS c_bpartner_created,
    bp.updated AS c_bpartner_updated,
    bp.iscustomer AS c_bpartner_customer,
    bp.isvendor AS c_bpartner_vendor,
    bp.isemployee AS c_bpartner_employee,
    bploc.name ad_user_location_name
  FROM ad_user u
  LEFT JOIN c_bpartner bp ON u.c_bpartner_id = bp.c_bpartner_id
  LEFT JOIN c_bpartner_location bploc ON u.c_bpartner_location_id = bploc.c_bpartner_location_id

WHERE ${SECURITY_CONTEXT.ad_client_id.filter('u.ad_client_id')}
`,

// refreshKey: {
//   every: `30 minute`
// },
  
  joins: {
    Client: {
      relationship: `belongsTo`,
      sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    }
  },

  title: `Users`,
  description: `All Users related information`,
  sqlAlias: `usr`,

  measures: {
    count: {
      type: `count`,
      drillMembers: [name]
    }
  },
  
  dimensions: {
    ad_client_id: {
      title: `Client`,
      sql: `ad_client_id`,
      type: `number`,
      shown: false
    }, 

    ad_user_id: {
      title: `User ID`,
      description: `User database primary key`,
      sql: `ad_user_id`,
      type: `number`,
      primaryKey: true,
      shown: true
    },   

    name: {
      sql: `name`,
      type: `string`
    },

    lastname: {
      sql: `lastname`,
      type: `string`
    },

    firstname: {
      sql: `firstname`,
      type: `string`
    },

    value: {
      sql: `value`,
      type: `string`
    },
    
    email: {
      sql: `email`,
      type: `string`
    },
    
    isactive: {
      sql: `isactive`,
      type: `string`
    },
    
    bpartner: {
      sql: `c_bpartner_name`,
      type: `string`
    },

    location: {
      sql: `ad_user_location_name`,
      type: `string`
    }
  },

   //if no dimension, then no ad_user_id, if no measure then no data at all
  // all indexes must be added as hidden dimensions then added to dimensionReference
  preAggregations: {
    // def: {
    //   type: `rollup`,
    //   external: true,
    //   refreshKey: {
    //     every: `1 day`,
    //     incremental: false,
    //     updateWindow: `7 day`
    //   },
    //   measureReferences: [count],
    //   dimensionReferences: [Client.ad_client_id, ad_user_id, name, firstname, lastname, value, email, isactive, bpartner, location],
    //   indexes: {
    //     ad_user_client_idx: {
    //       columns: [Client.ad_client_id]
    //     },
    //     ad_user_idx: {
    //       columns: [ad_user_id]
    //     }
    //   }
    // }
  }
  
});
