cube(`Reference`, {
  sql: `
  SELECT 
    rl.ad_client_id,
    rl.updated,
    rl.ad_org_id,
    rl.ad_reference_id,    
    rl.ad_ref_list_id,
    rlt.ad_language,
    rl.value,
    rlt.name as listname,
    r.name as refname
  FROM ad_ref_list_trl  rlt
  JOIN ad_ref_list rl  ON rlt.ad_ref_list_id=rl.ad_ref_list_id
  JOIN ad_reference r ON r.ad_reference_id=rl.ad_reference_id
  WHERE ${SECURITY_CONTEXT.ad_language.filter('rlt.ad_language')}
  `,

  // refreshKey: {
  //   every: `1 hour`
  // },
  
  joins: {
    Client: {
      relationship: `belongsTo`,
      sql: `${Reference}.ad_client_id = ${Client}.ad_client_id`
    }
  },
  

  title: `References`,
  description: `All Reference related information`,
  sqlAlias: `ref`,

   measures: {
    count: {
      type: `count`,
      drillMembers: []
    }

  },
  
  dimensions: {
    ad_client_id: {
      title: `Tenant`,
      sql: `ad_client_id`,
      type: `number`,
      shown: false
    },

    ad_reference_id: {
      sql: `ad_reference_id`,
      type: `number`,
      primaryKey: true,
      shown: true
    },

    ad_ref_list_id: {
      sql: `ad_ref_list_id`,
      type: `number`,
      shown: true
    },

    ad_language: {
      title: `Tenant`,
      sql: `ad_language`,
      type: `string`
    },

    listname: {
      title: `Reference List Name`,
      sql: `listname`,
      type: `string`
    },

    refname: {
      title: `Reference List Name`,
      sql: `refname`,
      type: `string`
    }  
  },

  preAggregations: {
    // main: {
    //   type: `rollup`,
    //   external: true,
    //   measureReferences: [count],
    //   dimensionReferences: [Client.ad_client_id, ad_reference_id, ad_ref_list_id, ad_language, listname, refname],
    //   indexes: {
    //     ad_user_client_idx: {
    //       columns: [Client.ad_client_id]
    //     },
    //     ad_reference_idx: {
    //       columns: [ad_reference_id]
    //     },
    //     ad_reflist_idx: {
    //       columns: [ad_ref_list_id]
    //     }
    //   }
    // }
  }
  
});
