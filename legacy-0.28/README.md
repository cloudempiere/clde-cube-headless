# Cube 0.28 model — reference only

The original model, as it stood on Cube 0.28 before the migration to 1.7.19.
Kept because several decisions in the current model only make sense against it,
and because it is the only record of what the 2020 and 2022 revisions did.

**Nothing here runs.** The live project is `cube/`, and Cube reads its model
from `cube/model`.

## Why it moved out of the repository root

`cube.js` and `schema/` used to sit at the top level, where they were inert
only by luck: Cube reads `cube/model`, so nothing loaded them. But starting a
server from the repository root would have picked up this 0.28 `cube.js`
instead of `cube/cube.js` — silently, with a config that predates every
isolation, translation and pre-aggregation decision since.

The root `package.json` had the same problem from the other side: it still
advertised `templateVersion: 0.28.19` and a `dev` script pointing at
`cubejs-server`, a binary never installed at that level.

## What to read it for

- `schema/` — the 0.28 cube definitions, including members later dropped
  because v1.x forbids referencing foreign cubes from a member
- `cube.js` — the 0.28 config, notably `queryRewrite` filtering
  `values: [user.ad_client_id, 0]`. The 2022 rewrite dropped the `0`, making
  system-owned master data invisible; the current model restores it.
