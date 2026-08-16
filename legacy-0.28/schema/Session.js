cube(`Session`, {
  sql: 
  ` SELECT s.ad_session_id,
      0::numeric AS ad_client_id,
      s.ad_client_id AS ad_tenant_id,
      0::numeric(10,0) AS ad_org_id,
      s.isactive,
      s.created,
      s.createdby,
      s.updated,
      s.updatedby,
      substr(s.websession::text, 1, 40) AS websession,
      substr(s.remote_addr::text, 1, 60) AS remote_addr,
      substr(s.remote_host::text, 1, 120) AS remote_host,
      substr(r.name::text, 1, 60) AS rolename,
      s.logindate,
      s.ad_session_uu,
      substr(s.servername::text, 1, 80) AS servername,
      substr(c.name::text, 1, 60) AS clientname,
      substr(o.name::text, 1, 60) AS orgname,
      substr(u.name::text, 1, 60) AS loginname,
      to_char(now() - s.created::timestamp with time zone, 'HH24:MI:SS'::text) AS duration,
      s.processed,
      r.businessfunction,
      r.allowedlogininterface
  FROM ad_session s
    JOIN ad_user u ON s.createdby = u.ad_user_id
    LEFT JOIN ad_role r ON s.ad_role_id = r.ad_role_id
    JOIN ad_client c ON s.ad_client_id = c.ad_client_id
    LEFT JOIN ad_org o ON s.ad_org_id = o.ad_org_id
  `,

  // refreshKey: {
  //   sql: `SELECT MAX(created) FROM ad_session`
  // },

  title: `Session`,
  description: `All Session related information`,
  sqlAlias: `ses`,

  measures: {
    count: {
      title: `Total Count`,
      sql: `ad_session_id`,
      type: `count`
    }
  },

  dimensions: {
    ad_client_id: {
      title: `Client ID`,
      description: `Client database primary key`,
      sql: `ad_client_id`,
      type: `number`,
      shown: true
    },

    ad_session_id: {
      title: `Session ID`,
      description: `Session primary key`,
      sql: `ad_session_id`,
      type: `number`,
      shown: false
    },

    clientname: {
      title: `Client Nane`,
      description: `Client Name`,
      sql: `clientname`,
      type: `string`,
      shown: true
    },

    servername: {
      title: `Server Name`,
      description: `Server name`,
      sql: `servername`,
      type: `string`,
      shown: true
    },

    logindate: {
      title: `Login Date`,
      description: `User Login Date`,
      sql: `logindate`,
      type: `time`,
      shown: true
    }
  }

});
