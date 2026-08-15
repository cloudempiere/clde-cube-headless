cube(`Product`, {
  sql: `SELECT p.ad_client_id, p.created, p.updated,p.m_product_id,p.NAME,p.sku,p.ispurchased,p.isreturnable,p.isactive,p.VALUE,
  p.producttype,p.abcanalysisgroup as m_product_abcanalysisgroup,p.ismanufactured,p.manufacturerpartno,p.discontinued,p.islisted,p.discontinuedby,
  p.listedat,p.discontinuedat,p.m_product_category_id, 
  CASE WHEN av.value='Y' THEN 'true' ELSE 'false' END as iscatalog
  FROM m_product p
  LEFT JOIN M_AttributeInstance ai ON (p.M_AttributeSetInstance_ID=ai.M_AttributeSetInstance_ID) AND ai.M_Attribute_ID=1000105
  LEFT JOIN M_AttributeValue av ON (aV.M_AttributeValue_ID=aI.M_AttributeValue_ID)
  WHERE 1=1  
  
  `,

//   refresh_key: {
//     sql: `SELECT MAX(created) FROM m_product`
//  },

  title: `Product`,
  description: `Product details`,
  sql_alias: `prod`,
  
  joins: {
      Client: {
        relationship: `many_to_one`,
        sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    },
      Productcategory: {
        relationship: `many_to_one`,
        sql: `${CUBE}.m_product_category_id = ${Productcategory}.m_product_category_id`
      } 
  },
  
  measures: {
    count: {
      type: `count`,
      drill_members: [name]
    },

    uniqueproducts: {
      title: `Unique Products`,
      description: `Counts unique products`,
      sql: `m_product_id`,
      type: `countDistinctApprox`
    }
  },
  
  dimensions: {
    ad_client_id: {
      sql: `ad_client_id`,
      type: `number`,
      public: false
    },
    
    m_product_id: {
      title: `Product ID`,
      description: `Product database primary key`,
      sql: `m_product_id`,
      type: `number`,
      primary_key: true,
      public: true,
      format: `id`
    },

    m_product_category_id: {
      sql: `m_product_category_id`,
      type: `number`,
      public: false,
      format: `id`
    },

    name: {
      sql: `name`,
      type: `string`
    },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Productcategory).
    // Expose through a view using join_path + prefix.
    //     categoryname: {
    //       sql: `${Productcategory}.name`,
    //       type: `string`
    //     },
    
    ispurchased: {
      sql: `ispurchased`,
      type: `boolean`
    },
    
    isactive: {
      sql: `isactive`,
      type: `boolean`
    },

    iscatalog: {
      sql: `iscatalog`,
      type: `boolean`
    },
      
    value: {
      sql: `value`,
      type: `string`
    },
    
    producttype: {
      sql: `producttype`,
      type: `string`
    },
    
    m_product_abcanalysisgroup: {
      sql: `COALESCE(m_product_abcanalysisgroup,'C')`,
      type: `string`
    },
    
    ismanufactured: {
      sql: `ismanufactured`,
      type: `boolean`
    },

    created: {
      sql: `created`,
      type: `time`
    }
  
  },

//if no dimension, then no m_product_id, if no measure then no data at all
  // all indexes must be added as hidden dimensions then added to dimensionReference
  preAggregations: {
    // main: {
    //   type: `rollup`,
    //   //   refresh_key: {
    //     every: `1 hour`,
    //     incremental: false,
    //     update_window: `7 day`
    //   },
    //   measures: [count],
    //   dimensions: [Client.ad_client_id, m_product_id, m_product_category_id, name, categoryname, ispurchased, isactive, value, producttype, m_product_abcanalysisgroup, ismanufactured],
    //   indexes: {
    //     ad_client_idx: {
    //       columns: [Client.ad_client_id]
    //     },
    //     m_product_idx: {
    //       columns: [m_product_id]
    //     },
    //     m_product_category_idx: {
    //       columns: [m_product_category_id]
    //     }
    //   }
    // }
  },

});

