# Documentation

## Architecture Decision Records

| ADR | Title | Status | Date |
|---|---|---|---|
| [ADR-001](ADR-001-cube-semantic-layer.md) | Adopt Cube Core as the semantic layer, self-hosted, gated on a commercial trigger | Proposed | 2026-08-15 |

## Implementation plans

| Plan | Covers |
|---|---|
| [2026-08-15-cube-migration](superpowers/plans/2026-08-15-cube-migration.md) | Local setup on macOS, migration of a validated vertical slice, deny-by-default isolation, Superset over the SQL API, self-hosted deployment |

## Working references

Created by the plan, in `cube/`:

- `cube/MIGRATION.md` — 2020 → 1.x rename table, removals, known defects, remaining-cube order
- `cube/DEPLOY.md` — replica setup, host sizing, deploy and post-deploy checks
- `cube/scripts/cases/README.md` — how measure validation cases work

## Status

ADR-001 is **Proposed**. Humans accept ADRs. No code has been written against
this plan yet; the existing `schema/` and `index.js` remain the 2020 production
model and are not modified by it.
