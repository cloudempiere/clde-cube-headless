cube(`Doctype`, {
  sql: 
  `
    SELECT 
      dt.ad_client_id,
      dt.updated,
      dt.c_doctype_id,
      dt.docbasetype,
      dt.name
    FROM c_doctype dt
    `,


  joins: {
    Client: {
      relationship: `many_to_one`,
      sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    },

    Reference: {
      relationship: `many_to_one`,
      sql: `${CUBE}.DocBaseType = ${Reference}.value`
    }
  },


  title: `Document Type`,
  description: `Document Type related information`,
  sql_alias: `doct`,

  measures: {
    count: {
      title: `Total Count`,
      sql: `ad_client_id`,
      type: `count`
    }
  },

  dimensions: {
    ad_client_id: {
      sql: `ad_client_id`,
      type: `number`,
      public: true
    },

    c_doctype_id: {
      title: `DocumentType ID`,
      description: `DocumentType database primary key`,
      sql: `c_doctype_id`,
      type: `number`,
      primary_key: true,
      public: true
    },

    ad_client_name: {
      title: `Client`,
      sql: `name`,
      type: `string`,
      primary_key: true,
      public: false
    },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Reference).
    // Expose through a view using join_path + prefix.
    //     docbasetype: {
    //       title: `Product Category`,
    //       sql: `${Reference}.value`,
    //       type: `string`
    //     },
  },

  preAggregations: {
    // main: {
    //   type: `rollup`,
    //   //   measures: [count],
    //   dimensions: [Doctype.c_doctype_id],
    //   indexes: {
    //     c_doctype_idx: {
    //       columns: [Doctype.c_doctype_id]
    //     }
    //   }
    // }
  }

});
