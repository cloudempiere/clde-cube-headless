export const transformToBoolean = (column) =>
  `CASE WHEN ${column} = 'Y' THEN 'true' WHEN ${column}='N' THEN 'false' END`;