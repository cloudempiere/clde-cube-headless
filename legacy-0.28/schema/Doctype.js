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
      relationship: `belongsTo`,
      sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    },

    Reference: {
      relationship: `belongsTo`,
      sql: `${CUBE}.DocBaseType = ${Reference}.value`
    }
  },


  title: `Document Type`,
  description: `Document Type related information`,
  sqlAlias: `doct`,

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
      shown: true
    },

    c_doctype_id: {
      title: `DocumentType ID`,
      description: `DocumentType database primary key`,
      sql: `c_doctype_id`,
      type: `number`,
      primaryKey: true,
      shown: true
    },

    ad_client_name: {
      title: `Client`,
      sql: `name`,
      type: `string`,
      primaryKey: true,
      shown: false
    },

    docbasetype: {
      title: `Product Category`,
      sql: `${Reference}.value`,
      type: `string`
    },
  },

  preAggregations: {
    // main: {
    //   type: `rollup`,
    //   external: true,
    //   measureReferences: [count],
    //   dimensionReferences: [Doctype.c_doctype_id],
    //   indexes: {
    //     c_doctype_idx: {
    //       columns: [Doctype.c_doctype_id]
    //     }
    //   }
    // }
  }

});
