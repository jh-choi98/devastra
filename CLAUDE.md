# CLAUDE.md — DevAstra

Rules for any AI coding session in this repo. Read `/docs/` first, then treat this file as a
compliance checklist. Not a tutorial.

## Before any non-trivial task

Read all six docs in order:
1. `/docs/prd.md` — what we build and why; the four value pillars
2. `/docs/flow.md` — user journeys, state transitions, and sub-flows (A–K)
3. `/docs/screens.md` — every screen and overlay with field/action specs
4. `/docs/data-schema.md` — entities, fields, constraints, RLS
5. `/docs/code-architecture.md` — directory layout, layers, conventions, env vars
6. `/docs/adr.md` — non-obvious decisions that constrain implementation

Before touching `features/territories/tech-catalog.ts`, read `/docs/tech-catalog.md`.
Before touching anything legal, read `/docs/legal/privacy.md` and `/docs/legal/terms.md`.
Before launch, verify `/docs/security-checklist.md` items.

## Language policy

All code, comments, identifiers, commit messages, and documentation must be in English.
Korean is acceptable only in conversational responses to the user — never in files committed to the repo.

## Constellation UI vs internal DB naming

The DB and feature code retain pre-pivot names: `territory`, `landmark`, `territory_type`. The product UI surface uses constellation language: cluster, star, brightness, expanded. **Do not rename DB columns.** When writing UI copy or component names, use constellation terms. When writing schema, queries, or domain code, use the existing names. The mapping (see `docs/screens.md` §C and §D):

| DB / code | UI surface |
|---|---|
| `territories` table, `territory_type` | cluster, cluster domain |
| `landmarks` table, `tech_key` | star, tech name |
| `landmarks.weight` | brightness |
| `landmarks.first_unlocked_at` | first lit |
| `territories.stage` (1–5) | "expanded" verb; "Stage N" as secondary disclosure only |
| `territories.growth_30d` | recent growth |
| `territories.stage_changed_at` | recent expansion |

## Server-only discipline

Every file under the following paths MUST begin with `import 'server-only'` as its first import:

- `lib/db/` (all files)
- `lib/github/` (all files)
- `lib/email/` (all files)
- `lib/og/` (all files)
- `features/sync/` (all files)
- `features/recap/` (all files)
- `features/feedback/` (all files)
- `features/territories/rules.ts`
- `features/territories/scoring.ts`
- `features/territories/classifier.ts`
- `features/territories/star-positions.ts`
- `features/territories/global-stats.ts`

Client components under `app/_components/` MUST NOT import from any of these paths. The
`server-only` package causes a build error on accidental client-side imports — do not remove it.

**Documented exception: `features/constellation/render/*`** is isomorphic pure math (palette / Voronoi / labels / MST / magnitude / field-stars / coords). Both the WebGL client renderer and the SVG OG server renderer import from it (ADR-62). Files under this path do NOT carry `server-only`. This is the one place where `features/` crosses into client space; do not generalize the exception.

## SPDX license headers (ADR-27, ADR-55, ADR-62)

The following modules MUST begin with `// SPDX-License-Identifier: MIT` as the first line (above `server-only` if both apply):

- `features/territories/classifier.ts`
- `features/territories/tech-catalog.ts`
- `features/territories/rules.ts`
- `features/territories/scoring.ts`
- `features/territories/registry.ts`
- `features/territories/star-positions.ts`
- `features/constellation/render/palette.ts`
- `features/constellation/render/voronoi.ts`
- `features/constellation/render/labels.ts`
- `features/constellation/render/mst.ts`
- `features/constellation/render/magnitude.ts`
- `features/constellation/render/field-stars.ts`
- `app/_components/Constellation/star-positions.ts`

WebGL renderer files under `app/_components/Constellation/{Scene,layers,post,camera,overlay,cinematics,shaders}.tsx,.ts` are **proprietary** by default. MIT is reserved for shared pure-math modules with extraction value as standalone npm packages; WebGL composition is product-specific.

All other code is proprietary (covered by `LICENSE-PROPRIETARY`). When in doubt about a new file, default to no SPDX header — it is proprietary.

## RLS bypass and the user_id guard rail (ADR-46)

`lib/db/client.ts` connects with `DATABASE_URL` (postgres role). **This bypasses RLS.** The application layer is the sole filter.

All reads against per-user tables (`activities`, `territories`, `landmarks`, `email_sends`, `weekly_recaps`, `misclassification_feedback`, `sync_jobs`) MUST use `lib/db/queries/_helpers.ts` `withUserScope(userId)`. The helper enforces `WHERE user_id = $userId`. Direct table access without this scope is a security bug.

Public-facing reads use the `users_public_view` (RLS-enforced).

## Schema as source of truth

Drizzle schemas in `lib/db/schema/` are authoritative. `docs/data-schema.md` describes intent.
If the two disagree, update the doc to match the code (not the other way around), then note the
discrepancy in the PR description.

## Migrations are add-only (ADR-51)

New columns must have safe defaults; new tables are independent. No drops, no column renames, no type changes without an explicit user instruction and a dedicated PR. Rollback procedure is **code revert only** (ADR-56) — schema rollback requires a separate cleanup PR.

`drizzle-kit migrate` runs manually against prod **before** code merge (ADR-57). Confirm `migration: applied` in the PR description before merging.

`DATABASE_URL` = transaction-mode pooler (port 6543). `DIRECT_URL` = direct (port 5432), used only by `drizzle-kit`. The `postgres-js` driver requires `prepare: false` because transaction-mode pooler does not support session-bound prepared statements.

## Source-agnostic columns

`activities.source`, `activities.external_id`, `repositories.source`,
`repositories.external_repo_id` are intentionally generic (ADR-16). Never reintroduce
`github_repo_id`, `github_event_id`, or any `github_*` column name in these two tables.
`users.github_*` fields are intentional exceptions — identity remains single-source for MVP.

## `raw` JSONB restriction (ADR-9)

`activities.raw` must contain ONLY: `file_paths`, `additions`, `deletions`, `github_url`.

Never write commit messages, diffs, PR titles, PR bodies, or any other prose into `raw`. PR titles for the cluster drawer are fetched on-demand from the GitHub API at view time — they are never stored locally. Violating this silently grows the breach surface and is hard to undo.

## Private repo guard (ADR-11)

`MVP_INCLUDE_PRIVATE = false` is hardcoded in `features/sync/sources/github.ts`. Never remove or flip this constant without an explicit user instruction and a dedicated PR that audits every affected code path. The OAuth flow intentionally requests only `read:user` + `user:email` — do not expand scopes without the same deliberate review.

## Time zone discipline (ADR-14)

All DB columns store UTC. All aggregation windows (`growth_30d`, `week_start`) are computed in UTC. Time zone conversion happens at the display layer only. Do not add per-user tz awareness to queries or Inngest cron triggers.

## Idempotency (ADR-5)

Every Inngest step must be safe to re-run. Use UPSERT (`onConflictDoUpdate`) on all writes to `activities`, `repositories`, `territories`, `landmarks`, `weekly_recaps`. Unique constraints in `docs/data-schema.md` define the idempotency keys — do not bypass them with INSERT-then-ignore.

## Dependency direction

```
app/  →  features/  →  lib/  →  (external services)
```

`app/` may import `lib/` and `features/`. `features/` may import `lib/`. Nothing imports from `app/`. Client components (`app/_components/`) may only import `lib/` modules that are not `server-only`. They never import from `features/`, **with one documented exception:** `features/constellation/render/*` is isomorphic pure render math, imported by both `app/_components/Constellation/` (client) and `lib/og/ConstellationImage.tsx` (server). See `docs/code-architecture.md` § Layers and dependency direction.

## Test/mock route guards (ADR-47, ADR-63)

Every file under `app/api/test/*` MUST begin with:

```ts
import { notFound } from 'next/navigation'
if (process.env.NODE_ENV === 'production') notFound()
```

This is a security control, not a style preference. A leaked mock-OAuth route in production allows arbitrary user impersonation.

**`app/dev/map/page.tsx`** is variant (ADR-63) — it must be reachable from CI / Vercel preview deploys for Playwright visual regression even when production-built. Use:

```ts
import { notFound } from 'next/navigation'
if (process.env.ENABLE_DEV_MAP !== '1') notFound()
```

`ENABLE_DEV_MAP=1` is set in CI and Vercel preview environments only. Production deploys leave it unset → 404. The underlying principle from ADR-47 (dev-only routes must guard against production access) is preserved; only the mechanism differs for this single route.

## Cross-doc consistency

When you add or change a field, event name, file path, or invariant described in one doc, search the other six docs for references and update them in the same PR. Stale cross-references in docs are a primary source of future implementation bugs.

## Compass principles (`memory/project_devastra_compass.md`)

Every UI / copy decision is checked against the four value pillars:

1. **Growth feeling** — "what brightened", not "how many commits"
2. **Portfolio value** — shareable identity
3. **Motivation through collection** — without rankings
4. **Self-understanding** — users see their actual habits

Forbidden:

- "Level up!", "+XP", "Achievement unlocked!" copy
- Toasts for star unlocks (use strip + pulse instead)
- "You are top N%" framing (rare star labels describe the *star*, not the person)
- LLM-generated narrative in core flow
- Modal alerts that block the constellation
- Banners that hide the cached constellation when sync fails
- Persistent cluster-color aura washes in the steady-state canvas (cluster color appears only on `cinematic/stage-up > drawer-selected > hover` — see `docs/adr.md` ADR-61)
- Tech-star colors driven by cluster (tech stars use the spectral palette in `features/constellation/render/palette.ts`)
- All-caps, letter-spaced, cluster-colored labels (labels are small blue-white sans-serif — `docs/screens.md` §C)
- Unbounded ambient motion (twinkle is OK on field stars only at ±10% amplitude; tech stars do not twinkle; all ambient motion is disabled under `prefers-reduced-motion: reduce`)

Permitted (amended 2026-05-14 by `docs/adr.md` ADR-61):

- **Field stars** (background, decorative, ~2000 desktop / ~1000 mobile) — they are "sky background," NOT "decorative tech stars." No labels, no hover, no click, deterministic seed.
- **Bounded ambient motion** — field-star twinkle, mouse-driven parallax micro-tilt, Milky Way opacity breathing. All decoupled from per-star semantic identity. All respect `prefers-reduced-motion`.
- **Milky Way nebulosity** — warm sepia/ochre baked texture + procedural noise warp, positioned to pass through cluster anchors (data-coupled, not pure decoration).

## Constellation visual language (ADR-61)

Stellarium atmosphere-OFF mode is the primary visual reference. Cluster identity is conveyed by **spatial grouping + Voronoi boundary lines + connection lines + small map-style labels** — never by persistent color. The default canvas reads as an observational star atlas, not a colorful skill dashboard. See `docs/screens.md` §C and `docs/adr.md` ADR-61 / ADR-62 / ADR-63 for the full spec.

## Constellation renderer feature flag (ADR-62)

`CONSTELLATION_RENDERER` is a **server-side** env var (NOT `NEXT_PUBLIC_*`). Read in server components and passed as a prop into the client tree. Default `'webgl'`. Set to `'svg'` in the Vercel dashboard to roll back without redeploy. After stable rollout, the env-var read and the `ConstellationSVG.tsx` legacy renderer will be removed in a dedicated follow-up PR.

## /dev/map env-var guard (ADR-63)

`/dev/map` is gated by `process.env.ENABLE_DEV_MAP !== '1'` (NOT `NODE_ENV`), so production-build Playwright visual regression can access it on CI / Vercel preview. Production deploys leave the env var unset → 404. ADR-47's principle (dev-only routes guard against production access) is preserved; only the mechanism is variant for this one route.

## Naming conventions (summary)

- Files: kebab-case (`weekly-recap.ts`); React components PascalCase (`Constellation.tsx`)
- DB identifiers: `snake_case` for columns and tables
- Inngest events: `<domain>/<action>.<variant>` (e.g. `sync/initial.requested`)
- Env vars: `SCREAMING_SNAKE_CASE`; never imported in client components (note: `CONSTELLATION_RENDERER` and `ENABLE_DEV_MAP` are server-side reads, never bundled)

## Tech catalog

`features/territories/tech-catalog.ts` MUST match `/docs/tech-catalog.md` exactly. If you add or change a `tech_key`, update both files in the same commit. The doc is the source of truth for naming, detection logic, and `{x, y}` star position.

## Territory types

The six valid `territory_type` values are:
`frontend_land` | `backend_fortress` | `data_pipeline_zone` | `testing_lab` | `devops_harbor` | `docs_library`

These appear in `activity_territories`, `territories`, and `landmarks`. Never introduce a seventh without updating schema, catalog, constellation renderer, and this file.

UI labels for these are short and neutral: Frontend / Backend / Data / Testing / DevOps / Docs.

## Stage thresholds (ADR-2, ADR-37)

`[0, 50, 200, 500, 1500]` on `territories.total_weight` → stages 1–5. Defined in `features/territories/rules.ts`. Never duplicate these literals elsewhere; import from that file. UI surfaces stage transitions as "cluster expanded" (verb), not "Stage N up".

## Landmark unlock threshold

Weight ≥ 5 per `tech_key` unlocks a landmark / lights a star (`landmarks.first_unlocked_at` set once). Defined in `features/territories/rules.ts`.

## First-ever star cinematic detection (ADR-38)

Detection happens in `features/sync/cinematic-detection.ts` during sync. Sets `users.first_star_cinematic_pending = true` when `lit_star_count` transitions 0 → ≥1. Client checks the flag on `/` page load; cinematic plays once; flag transitions to `pending = false, seen = true`. **Do not infer cinematic eligibility from current state** — only the pending flag triggers it.

## Long-absence threshold (ADR-39)

`NOW() - users.last_login_at > 28 days` triggers the welcome-back overlay on the next authenticated `/` page render. `last_login_at` is updated on every authenticated `/` page render (`/` page only, not any authenticated page).

## Open questions

- Reserved username list: lives in `lib/utils/reserved-usernames.ts`.
- Visual design pass: tech catalog `{x, y}` coordinates + cluster center positions per viewport + spark/ripple/aura motion keyframes.
- Initial implementation PR order: see plan tracked in session memory.
