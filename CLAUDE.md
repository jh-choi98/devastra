# CLAUDE.md — DevAtlas

Rules for any AI coding session in this repo. Read `/docs/` first, then treat this file as a
compliance checklist. Not a tutorial.

## Before any non-trivial task

Read all five docs in order:
1. `/docs/prd.md` — what we build and why
2. `/docs/flow.md` — user journeys and state transitions
3. `/docs/data-schema.md` — entities, fields, constraints
4. `/docs/code-architecture.md` — directory layout, layers, conventions, env vars
5. `/docs/adr.md` — non-obvious decisions that constrain implementation

Also read `/docs/tech-catalog.md` before touching `features/territories/tech-catalog.ts`.

## Language policy

All code, comments, identifiers, commit messages, and any new documentation must be in English.
Korean is acceptable only in conversational responses to the user — never in files committed to the repo.

## Server-only discipline

Every file under the following paths MUST begin with `import 'server-only'` as its first import:

- `lib/db/` (all files)
- `lib/github/` (all files)
- `lib/email/` (all files)
- `lib/og/` (all files)
- `features/sync/` (all files)
- `features/recap/` (all files)
- `features/territories/rules.ts`

Client components under `app/_components/` MUST NOT import from any of these paths. The
`server-only` package causes a build error on accidental client-side imports — do not remove it.

## Schema as source of truth

Drizzle schemas in `lib/db/schema/` are authoritative. `docs/data-schema.md` describes intent.
If the two disagree, update the doc to match the code (not the other way around), then note the
discrepancy in the PR description.

## Source-agnostic columns

`activities.source`, `activities.external_id`, `repositories.source`,
`repositories.external_repo_id` are intentionally generic (ADR-16). Never reintroduce
`github_repo_id`, `github_event_id`, or any `github_*` column name in these two tables.
`users.github_*` fields are intentional exceptions — identity remains single-source for MVP.

## `raw` JSONB restriction (ADR-9)

`activities.raw` must contain ONLY: `file_paths`, `additions`, `deletions`, `github_url`.

Never write commit messages, diffs, PR titles, PR bodies, or any other prose into `raw`. PR titles
for the territory drawer are fetched on-demand from the GitHub API at view time — they are never
stored locally. Violating this silently grows the breach surface and is hard to undo.

## Private repo guard (ADR-11)

`MVP_INCLUDE_PRIVATE = false` is hardcoded in `features/sync/sources/github.ts`. Never remove or
flip this constant without an explicit user instruction and a dedicated PR that audits every
affected code path. The OAuth flow intentionally requests only `read:user` + `user:email` — do not
expand scopes without the same deliberate review.

## Time zone discipline (ADR-14)

All DB columns store UTC. All aggregation windows (`growth_30d`, `week_start`) are computed in UTC.
Time zone conversion happens at the display layer only. Do not add per-user tz awareness to queries
or Inngest cron triggers.

## Idempotency (ADR-5)

Every Inngest step must be safe to re-run. Use UPSERT (`onConflictDoUpdate`) on all writes to
`activities`, `repositories`, `territories`, `landmarks`, `weekly_recaps`. Unique constraints in
`docs/data-schema.md` define the idempotency keys — do not bypass them with INSERT-then-ignore.

## Dependency direction

```
app/  →  features/  →  lib/  →  (external services)
```

`app/` may import `lib/` and `features/`. `features/` may import `lib/`. Nothing imports from
`app/`. Client components (`app/_components/`) may only import `lib/` modules that are not
`server-only`. They never import from `features/`.

## Cross-doc consistency

When you add or change a field, event name, file path, or invariant described in one doc, search
the other four docs for references and update them in the same PR. Stale cross-references in docs
are a primary source of future implementation bugs.

## Naming conventions (summary)

- Files: kebab-case (`weekly-recap.ts`); React components PascalCase (`LivingMap.tsx`)
- DB identifiers: `snake_case` for columns and tables
- Inngest events: `<domain>/<action>.<variant>` (e.g. `sync/initial.requested`)
- Env vars: `SCREAMING_SNAKE_CASE`; never imported in client components

## Tech catalog

`features/territories/tech-catalog.ts` MUST match `/docs/tech-catalog.md` exactly. If you add or
change a `tech_key`, update both files in the same commit. The doc is the source of truth for
naming and detection logic; the TypeScript file is the implementation.

## Territory types

The six valid `territory_type` values are:
`frontend_land` | `backend_fortress` | `data_pipeline_zone` | `testing_lab` | `devops_harbor` | `docs_library`

These appear in `activity_territories`, `territories`, and `landmarks`. Never introduce a seventh
without updating schema, catalog, map renderer, and this file.

## Stage thresholds

`[0, 50, 200, 500, 1500]` on `territories.total_weight` → stages 1–5. Defined in
`features/territories/rules.ts`. Never duplicate these literals elsewhere; import from that file.

## Landmark unlock threshold

Weight ≥ 5 per `tech_key` unlocks a landmark (`landmarks.first_unlocked_at` set once). This is
also defined in `features/territories/rules.ts`.

## Open questions

- Resend bounce webhook: exact route path and secret-header verification not yet decided.
- Supabase Vault key rotation procedure: documented as manual for MVP; automation deferred.
- Reserved username list: lives in `lib/utils/reserved-usernames.ts` (to be created in Phase 3).
