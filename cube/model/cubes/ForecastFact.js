cube(`Forecast`, {
  sql: 
  ` 
  SELECT 
      fl.ad_client_id, 
      fl.ad_org_id, 
      fl.created, 
      fl.updated, 
      f.name,
      f.c_calendar_id,
      f.c_year_id,
      fl.c_period_id,
      f.m_forecast_id,
      fl.m_forecastline_id,
      fl.m_product_id,
      COALESCE(fl.qty,0) as qty,
      COALESCE(fl.qtycalculated,0) as qtycalculated,
      fl.m_warehouse_id,
      fl.salesrep_id,
      p.periodno,
      p.startdate,
      p.enddate
  FROM m_forecast f
  JOIN m_forecastline fl ON f.m_forecast_id=fl.m_forecast_id
  JOIN c_period p ON p.c_period_id = fl.c_period_id
  WHERE 1=1 
  AND ${FILTER_PARAMS.Forecast.date.filter('p.startdate')}
  `,

  // refresh_key: {
  //   sql: `SELECT MAX(created) FROM m_forecast`
  // },

  title: `Forecast`,
  description: `All Forecast related information`,
  sql_alias: `frc`,


  joins: {
    Client: {
      relationship: `many_to_one`,
      sql: `${CUBE}.ad_client_id = ${Client}.ad_client_id`
    },

    Organization: {
      relationship: `one_to_many`,
      sql: `${CUBE}.ad_org_id = ${Organization}.ad_org_id`
    },

    Product: {
      relationship: `one_to_many`,
      sql: `${CUBE}.m_product_id = ${Product}.m_product_id`
    },

    User: {
      relationship: `one_to_many`,
      sql: `${CUBE}.salesrep_id = ${User}.ad_user_id`
    }
  },

  measures: {
    count: {
      title: `Total Count`,
      sql: `m_forecastline_id`,
      type: `count`
    },
    
    qty: {
      title: `Quantity`,
      sql: `qty`,
      type: `sum`
    },

    qtycalculated: {
      title: `Quantity Calculated`,
      sql: `qtycalculated`,
      type: `sum`
    }
  },

  dimensions: {
    ad_client_id: {
      title: `Client ID`,
      description: `Client database primary key`,
      sql: `ad_client_id`,
      type: `number`,
      public: true
    },

    ad_org_id: {
      title: `Org ID`,
      sql: `ad_org_id`,
      type: `number`,
      public: false
    },

    m_forecastline_id: {
      title: `Forecast Line ID`,
      sql: `m_forecastline_id`,
      type: `number`,
      primary_key: true,      
      public: false
    },

    m_forecast_id: {
      title: `Forecast ID`,
      sql: `m_forecast_id`,
      type: `number`,
      public: false
    },

    m_product_id: {
      title: `Product ID`,
      sql: `m_product_id`,
      type: `number`,
      public: false
    },

    salesrep_id: {
      title: `SalesRep ID`,
      sql: `salesrep_id`,
      type: `number`,
      public: false
    },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Organization).
    // Expose through a view using join_path + prefix.
    //     ad_org_name: {
    //       title: `Organization`,
    //       sql: `${Organization}.ad_org_name`,
    //       type: `string`
    //     },

    startdate: {
      sql: `startdate`,
      type: `time`
    },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (User).
    // Expose through a view using join_path + prefix.
    //     salesrep: {
    //       title: `Sales Representative`,
    //       sql: `${User}.name`,
    //       type: `string`
    //     },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Productcategory).
    // Expose through a view using join_path + prefix.
    //     prodcategory: {
    //       title: `Prod. Category`,
    //       sql: `${Productcategory}.name`,
    //       type: `string`
    //     },

    // MIGRATION v1.x: a dimension may not reference foreign cubes (Product).
    // Expose through a view using join_path + prefix.
    //     product: {
    //       title: `Product`,
    //       sql: `${Product}.name`,
    //       type: `string`
    //     }

  },

  preAggregations: {
    // main: {
    //   type: `rollup`,
    //   //   measures: [count],
    //   dimensions: [m_forecast_id],
    //   indexes: {
    //     m_forecast_idx: {
    //       columns: [m_forecast_id]
    //     }
    //   }
    // }
  }

}
);
