# Code Architecture — DevAstra

**Scope of this doc:** directory layout, layer responsibilities, dependency rules, naming conventions, external dependencies. For *why* the stack, see `docs/adr.md`. For *what* the entities are, see `docs/data-schema.md`. For *what* each screen does, see `docs/screens.md`.

## Directory tree

```
/
├── app/                                # Next.js 14 App Router
│   ├── (authenticated)/
│   │   ├── page.tsx                    # Main constellation (/) for logged-in users
│   │   ├── settings/page.tsx
│   │   └── onboarding/repos/page.tsx
│   ├── [username]/page.tsx             # Public profile (ISR 1h + on-demand revalidate)
│   ├── account-deleted/page.tsx        # Post-delete transitional page
│   ├── unsubscribe/page.tsx            # Email unsubscribe landing (token-based)
│   ├── auth/
│   │   └── callback/page.tsx           # OAuth handshake bridge
│   ├── privacy/page.tsx                # Renders docs/legal/privacy.md
│   ├── terms/page.tsx                  # Renders docs/legal/terms.md
│   ├── error.tsx                       # Generic 500 fallback
│   ├── not-found.tsx                   # 404 page
│   ├── sitemap.ts                      # Dynamic sitemap; daily cache
│   ├── robots.ts                       # robots.txt generator
│   ├── api/
│   │   ├── auth/callback/route.ts
│   │   ├── health/route.ts             # Uptime probe (DB ping + 200 OK)
│   │   ├── inngest/route.ts            # Inngest webhook (signature verified)
│   │   ├── og/
│   │   │   ├── profile/[username]/route.tsx
│   │   │   └── recap/[recap_id]/route.tsx
│   │   ├── refresh/route.ts            # Manual refresh trigger (migrating to Server Action)
│   │   ├── unsubscribe/route.ts        # POST endpoint, idempotent unsubscribe action
│   │   └── webhooks/
│   │       └── resend/route.ts         # Bounce webhook (signature verified)
│   └── _components/
│       ├── Constellation/              # Renderer — WebGL primary + SVG fallback (ADR-61, ADR-62)
│       │   ├── Constellation.tsx       # 3-way switch by `renderer` prop (server-fed env)
│       │   ├── ConstellationSVG.tsx    # Legacy SVG renderer (kept during rollout; retired in follow-up PR)
│       │   ├── ConstellationWebGL.tsx  # WebGL wrapper: feature-detect → Skeleton + Scene OR Skeleton + banner
│       │   ├── Skeleton.tsx            # HTML/SVG, SSR-safe: background + boundary lines + cluster labels
│       │   ├── Scene.tsx               # R3F <Canvas> root; dynamic({ ssr: false })
│       │   ├── state.ts                # ConstellationContext (selected/hover/cinematic/reducedMotion)
│       │   ├── layers/                 # SkyBackground / MilkyWay / FieldStars / TerritoryBoundaries
│       │   │                           # / Connections / TechStars / ClusterAura / Labels
│       │   ├── post/                   # BloomLayer / VignetteLayer (postprocessing)
│       │   ├── camera/                 # ParallaxRig (mouse micro-tilt)
│       │   ├── overlay/                # A11yOverlay (DOM invisible buttons) / TooltipHost
│       │   ├── cinematics/             # FirstEverCinematic / RevealSequence / SparkSequence / StageUpRipple
│       │   ├── shaders/                # TS string literals (.frag.ts, .vert.ts); no .glsl loader
│       │   ├── StarTooltip.tsx         # Desktop hover tooltip
│       │   └── star-positions.ts       # Reads {x, y} from tech-catalog (SPDX-License-Identifier: MIT)
│       ├── ClusterDrawer/              # Drawer (replaces TerritoryDrawer)
│       │   ├── ClusterDrawer.tsx
│       │   ├── StarRow.tsx
│       │   ├── WhyExpansion.tsx        # "Why is this lit?" per-star detail
│       │   ├── MisclassificationModal.tsx
│       │   └── RecentPRs.tsx           # GitHub on-demand fetch
│       ├── StateBanners/
│       │   ├── SyncFailedBanner.tsx
│       │   ├── SystemStatusBanner.tsx
│       │   ├── GitHubDisconnectedBanner.tsx
│       │   ├── WelcomeBackStrip.tsx
│       │   ├── ThisWeekStrip.tsx
│       │   └── HintTooltip.tsx
│       ├── SpecialMoments/
│       │   ├── FirstTimeReveal.tsx
│       │   ├── FirstEverStarCinematic.tsx
│       │   └── StageUpMoment.tsx
│       ├── ConfirmModal.tsx
│       ├── Header.tsx                  # Refresh / Share / Avatar dropdown
│       ├── LandingDemo.tsx
│       ├── PosthogIdentifier.tsx
│       ├── PrivateProfile.tsx
│       ├── PublicStickyBar.tsx
│       ├── RefreshButton.tsx
│       ├── SignInButton.tsx
│       └── ShareModal.tsx
│
├── lib/                                # Shared utilities; server-only marked where applicable
│   ├── db/
│   │   ├── client.ts                   # Drizzle client (server-only); prepare: false for pooler
│   │   ├── encryption.ts               # pgcrypto via Vault key (server-only)
│   │   ├── schema/                     # one file per entity
│   │   └── queries/
│   │       ├── _helpers.ts             # withUserScope() RLS-bypass guard rail (ADR-46)
│   │       └── *.ts                    # composed query functions per entity
│   ├── github/
│   │   ├── graphql.ts                  # GraphQL client + queries (server-only)
│   │   ├── rest.ts                     # REST client (server-only)
│   │   └── token.ts                    # JIT refresh logic
│   ├── email/
│   │   ├── client.ts                   # Resend client (server-only)
│   │   ├── unsubscribe-token.ts        # Signed JWT with version claim
│   │   └── templates/                  # React Email components
│   │       ├── WeeklyRecapActive.tsx
│   │       ├── WeeklyRecapEmpty.tsx
│   │       └── WeeklyRecapFirstWeek.tsx
│   ├── og/
│   │   ├── ConstellationImage.tsx      # @vercel/og component (layered-circles glow)
│   │   ├── ProfileImage.tsx            # Wraps ConstellationImage for profile share
│   │   ├── RecapImage.tsx              # Wraps ConstellationImage with weekly diff overlay
│   │   ├── shared.tsx                  # Edge-safe palette + types
│   │   └── version.ts                  # OG_RENDER_VERSION constant (ADR-52)
│   ├── auth/
│   │   ├── supabase-server.ts          # Server client (cookies)
│   │   ├── supabase-browser.ts         # Browser client
│   │   ├── middleware.ts               # Session refresh in middleware.ts
│   │   ├── session.ts                  # requireUser() / getOptionalUser()
│   │   └── actions.ts                  # signIn(), signOut() Server Actions
│   ├── posthog.ts                      # Analytics client; cookieless mode (ADR-60)
│   ├── sentry.config.ts                # beforeSend scrub (ADR-49)
│   └── utils/
│       ├── reserved-usernames.ts       # System paths + protected names list
│       ├── username-redirect.ts        # users → username_history resolution
│       └── time/                       # tz, formatters, common helpers
│
├── features/                           # Domain logic; server-only EXCEPT constellation/render (isomorphic)
│   ├── constellation/
│   │   └── render/                     # Pure isomorphic render math; shared by WebGL + SVG OG renderers (ADR-62, ADR-63)
│   │       ├── anchors.ts              # Cluster anchor positions per viewport
│   │       ├── palette.ts              # SPDX-License-Identifier: MIT — tech_key → spectral color (deterministic)
│   │       ├── voronoi.ts              # SPDX-License-Identifier: MIT — 6-cell boundary polygons from anchors
│   │       ├── labels.ts               # SPDX-License-Identifier: MIT — label visibility selection rule
│   │       ├── mst.ts                  # SPDX-License-Identifier: MIT — MST edges per cluster
│   │       ├── magnitude.ts            # SPDX-License-Identifier: MIT — weight → render size/intensity curve
│   │       ├── field-stars.ts          # SPDX-License-Identifier: MIT — deterministic background star generation
│   │       ├── coords.ts               # svg-px ↔ world-coord conversion
│   │       └── types.ts                # WorldCoord, AnchorMap, SpectralColor
│   ├── sync/
│   │   ├── runner.ts                   # Inngest function definitions
│   │   ├── initial.ts                  # Initial sync (capped at 1 year, ADR-50)
│   │   ├── incremental.ts              # Daily / manual incremental sync
│   │   ├── manual.ts                   # Manual refresh trigger
│   │   ├── backfill.ts                 # Re-classify existing activities (Settings repo toggle)
│   │   ├── denorm.ts                   # Rebuild territories + landmarks from activities
│   │   ├── cinematic-detection.ts      # Detect lit_star_count 0→≥1 (ADR-38)
│   │   ├── cleanup.ts                  # Stuck-job cron + housekeeping
│   │   ├── events.ts                   # Inngest event type definitions
│   │   └── sources/
│   │       ├── interface.ts            # SourceClient interface
│   │       └── github.ts               # GitHubSourceClient impl (MVP_INCLUDE_PRIVATE = false)
│   ├── territories/                    # MIT-licensed extractable modules
│   │   ├── classifier.ts               # SPDX-License-Identifier: MIT
│   │   ├── tech-catalog.ts             # SPDX-License-Identifier: MIT
│   │   ├── rules.ts                    # SPDX-License-Identifier: MIT
│   │   ├── scoring.ts                  # SPDX-License-Identifier: MIT
│   │   ├── registry.ts                 # SPDX-License-Identifier: MIT
│   │   ├── star-positions.ts           # SPDX-License-Identifier: MIT (cluster + {x,y})
│   │   ├── tech-catalog-public.ts      # Client-safe catalog re-export
│   │   └── global-stats.ts             # Daily batch job for tech_global_stats (post-MVP UI gate)
│   ├── recap/
│   │   ├── generate.ts                 # Builds weekly_recaps row
│   │   ├── slot-builder.ts             # Composes 3-slot highlights JSONB shape
│   │   ├── subject-line.ts             # Dynamic subject (stage_up > new_star > brightest)
│   │   ├── diff.ts                     # Week-over-week + since-last-visit diffs
│   │   ├── send.ts                     # Resend dispatch + fan-out
│   │   └── time.ts                     # UTC week boundaries (ADR-14)
│   └── feedback/
│       └── misclassification.ts        # Rate-limited Server Action insert (ADR-40)
│
├── docs/
│   ├── prd.md
│   ├── flow.md
│   ├── screens.md
│   ├── data-schema.md
│   ├── code-architecture.md            # this file
│   ├── tech-catalog.md
│   ├── adr.md
│   ├── security-checklist.md
│   ├── dev-setup.md
│   └── legal/
│       ├── privacy.md
│       └── terms.md
│
├── public/
│   └── textures/                       # Static assets (ADR-62)
│       ├── milky-way.webp              # 4K baked Milky Way panorama (NASA Gaia / ESO crop)
│       ├── milky-way@2x.webp           # high-DPR variant
│       └── milky-way-fallback.jpg      # OG renderer (edge runtime fetch)
│
├── drizzle/migrations/                 # SQL migrations + RLS + triggers
├── middleware.ts                       # CSP, rate limits, session refresh
├── drizzle.config.ts
├── inngest.config.ts                   # (if used; otherwise inline in features/sync/runner.ts)
├── next.config.ts
├── package.json
├── CLAUDE.md                           # AI-agent compliance checklist
├── README.md
├── LICENSE-MIT                         # For files marked SPDX-License-Identifier: MIT
├── LICENSE-PROPRIETARY                 # Default for everything else
├── SECURITY.md
├── CONTRIBUTING.md
└── tests/
    ├── unit/                           # Vitest; classifier, scoring, parser, username-redirect, unsubscribe-token
    ├── integration/                    # Vitest; sync e2e w/ mocked GitHub, RLS isolation, public visibility, email templates (snapshots)
    └── e2e/                            # Playwright; signup-to-reveal smoke + constellation render snapshot
```

## Layers and dependency direction

```
app/  ──┐
        ▼
       features/ ──┐
                   ▼
                  lib/ ──► (Supabase, GitHub, Resend, Inngest, Vercel OG, PostHog, Sentry)
```

Rules:

- `app/` may import from `lib/` and `features/`. Never the reverse.
- `features/` may import from `lib/`. Never the reverse.
- `lib/` is leaf-level; modules within `lib/` may import each other only when there is no circular path.
- Client components (under `app/_components/`) may only import from `lib/` modules that are *not* `server-only`. They never import from `features/`, **with one exception:** `features/constellation/render/*` is isomorphic pure math and may be imported by both client (`app/_components/Constellation/`) and server (`lib/og/ConstellationImage.tsx`). This is the only path crossing the `features/` boundary into client space. Files under `features/constellation/render/` do NOT carry `server-only` for this reason.

The `server-only` package is imported at the top of every file under `lib/db/`, `lib/github/`, `lib/email/`, `lib/og/`, `features/sync/`, `features/recap/`, `features/feedback/`, `features/territories/rules.ts`, `features/territories/scoring.ts`, `features/territories/classifier.ts`, `features/territories/star-positions.ts`, `features/territories/global-stats.ts`. This causes a build error if anything in `app/_components/` accidentally imports them. **`features/constellation/render/*` is the documented exception** and intentionally does NOT carry `server-only`.

## RLS bypass policy (CRITICAL)

`lib/db/client.ts` connects with `DATABASE_URL` (postgres role) → **bypasses RLS**. The application layer is the sole filter.

**Mitigation:** all reads against per-user tables (`activities`, `territories`, `landmarks`, `email_sends`, `weekly_recaps`, `misclassification_feedback`, `sync_jobs`) MUST flow through `lib/db/queries/_helpers.ts` `withUserScope(userId)`. The helper enforces a `WHERE user_id = $userId` clause and exists specifically as a guard rail. Direct table access without this scope is a security bug, not a style issue (see `docs/adr.md` ADR-46).

Public-facing reads use the `users_public_view` (defined in `0001_rls_and_triggers.sql`) which filters `is_public = true`.

## Open-source module boundaries

The following modules carry an `SPDX-License-Identifier: MIT` header as the first line (ADR-27, ADR-55, ADR-62):

```
features/territories/classifier.ts
features/territories/tech-catalog.ts
features/territories/rules.ts
features/territories/scoring.ts
features/territories/registry.ts
features/territories/star-positions.ts
features/constellation/render/palette.ts          # added with ADR-62
features/constellation/render/voronoi.ts          # added with ADR-63
features/constellation/render/labels.ts           # added with ADR-63
features/constellation/render/mst.ts              # added with ADR-62
features/constellation/render/magnitude.ts        # added with ADR-62
features/constellation/render/field-stars.ts      # added with ADR-62
app/_components/Constellation/star-positions.ts
```

WebGL renderer modules under `app/_components/Constellation/{Scene,layers,post,camera,overlay,cinematics,shaders}.tsx,.ts` are **proprietary** by default (CLAUDE.md L73). MIT is reserved for shared pure-math modules that have extraction value as standalone npm packages; WebGL composition is product-specific.

All other code is proprietary (covered by `LICENSE-PROPRIETARY`). MVP does NOT publish these as npm packages; boundaries are designed for future extraction. See `docs/adr.md` ADR-55.

## Naming conventions

| Concern | Convention |
|---|---|
| Files | kebab-case (`weekly-recap.ts`); React components PascalCase (`Constellation.tsx`) |
| Drizzle schema modules | one file per entity, plural noun (`users.ts`, `landmarks.ts`) |
| Inngest events | `<domain>/<action>.<variant>` e.g. `sync/initial.requested`, `recap/email.send` |
| Server Actions | Verb-first function name; co-located in same file as the consuming component when scoped, else under `features/<domain>/actions.ts` |
| Database identifiers | `snake_case` for columns and tables; matches `docs/data-schema.md` |
| Environment vars | `SCREAMING_SNAKE_CASE`; never imported in client components |
| Internal vs UI naming | DB/code names are pre-pivot (territory, landmark). UI surface and copy use constellation language (cluster, star). Don't rename DB fields. |

## Testing conventions

- Co-locate unit tests next to source files using `.test.ts` suffix where the test is small and pure.
- Integration tests under `tests/integration/`, named after the flow under test (`initial-sync.test.ts`, `rls-isolation.test.ts`, `public-profile-visibility.test.ts`, `email-templates.test.ts`).
- Email template snapshot tests render React Email to HTML and diff against a committed snapshot.
- One Playwright E2E in `tests/e2e/signup-to-reveal.spec.ts` runs against a Vercel preview deploy of a feature branch.
- **Visual regression for the constellation:** Playwright screenshots against `/dev/map` mock scenarios (empty / sparse / dense / stage-up / first-ever), diffed at 3% threshold against committed baselines in `tests/visual/baseline/`. Requires `ENABLE_DEV_MAP=1` on the test environment.
- **A11y for the constellation:** `@axe-core/playwright` runs against `/dev/map` and verifies the DOM overlay buttons (cluster cells + hero lit stars) are keyboard-focusable and have ARIA labels — see `docs/adr.md` ADR-63.
- **Pure render math tests:** every module under `features/constellation/render/*` has co-located unit tests verifying determinism (`palette.test.ts`, `voronoi.test.ts`, `labels.test.ts`, `mst.test.ts`, `magnitude.test.ts`, `field-stars.test.ts`).
- Vitest config uses `vitest --pool=forks` for integration tests that need a real Supabase dev project. The dev project's `.env.test` is git-ignored.

## External dependencies (justification per dep)

| Dependency | Why |
|---|---|
| `next` (14, App Router) | Single full-stack repo with Server Components + Server Actions + ISR; minimum infra |
| `react`, `react-dom` | Required by Next.js |
| `@supabase/supabase-js`, `@supabase/ssr` | Auth + DB + Realtime; ADR-3 |
| `drizzle-orm`, `drizzle-kit` | TypeScript-native ORM with fast cold-start on serverless; ADR-4 |
| `postgres` (postgres-js) | Drizzle driver; `prepare: false` for transaction-mode pooler (ADR-51) |
| `inngest` | Step-based background jobs with at-least-once guarantees, built-in observability, free tier sufficient until Pro at 1k users; ADR-5 |
| `resend`, `@react-email/components` | Transactional email with React templates; cheap free tier; ADR-6 |
| `@vercel/og` | Edge-rendered OG images sharing the same SVG generation code as the live constellation; ADR-7 |
| `framer-motion` | Drawer slide / banner animations / SVG-renderer reveal (legacy path) |
| `three` | WebGL 3D math + GL context for constellation Scene (ADR-62) |
| `@react-three/fiber` | React reconciler for three.js; lifecycle + hooks integration (ADR-62) |
| `@react-three/drei` | R3F helpers — `<Html>` overlay for labels, useTexture, perf helpers (ADR-62) |
| `@react-three/postprocessing` | UnrealBloom + Vignette passes; HDR composer (ADR-62) |
| `simplex-noise` | Procedural noise for Milky Way warp + Voronoi jitter (already installed) |
| `d3-voronoi` | Optional; 6-cell boundary polygon computation (may be replaced by ~50 lines hand-rolled — see ADR-63) |
| `@axe-core/playwright` | a11y automated tests against `/dev/map` and main constellation (ADR-63) |
| `size-limit` (or `@next/bundle-analyzer`) | CI gate on `/` page JS chunk ≤ 350KB gz (ADR-62 budget) |
| `zod` | Runtime input validation on all Server Actions and route handlers |
| `posthog-js`, `posthog-node` | Funnel analytics; cookieless mode (ADR-60); core 6 events |
| `@sentry/nextjs` | Error monitoring with `beforeSend` token/header scrub (ADR-49) |
| `tailwindcss` | Styling |
| `sonner` (or similar) | Toast notifications for in-app events |
| `jose` | JWT generation + verification for unsubscribe tokens (ADR-48) |
| `server-only` | Build-time enforcement that server code is never bundled to client |
| `vitest`, `@playwright/test` | Test runners; ADR-21 |
| `@vercel/speed-insights` | Web Vitals capture in production (ADR-58) |

## Configuration & secrets

All secrets live in Vercel environment variables. Local development uses `.env.local` (git-ignored). The following are required:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY              # server-only
DATABASE_URL                            # Drizzle runtime — transaction-mode pooler (:6543)
DIRECT_URL                              # Drizzle Kit migrations only — direct (:5432)
GITHUB_OAUTH_CLIENT_ID
GITHUB_OAUTH_CLIENT_SECRET             # server-only
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY                    # server-only
RESEND_API_KEY                          # server-only
RESEND_WEBHOOK_SECRET                   # server-only; verifies bounce webhook
UNSUBSCRIBE_TOKEN_SECRET                # server-only; signs unsubscribe JWTs
UNSUBSCRIBE_TOKEN_VERSION               # increment to revoke all outstanding tokens
SENTRY_DSN
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST
OG_RENDER_VERSION                       # cache-busting token; bump on any global render change
APP_HOSTNAME_ALLOWLIST                  # comma-separated; used by OAuth origin check (ADR-47)
CONSTELLATION_RENDERER                  # 'webgl' (default if unset) | 'svg'; server-side read, instant rollback (ADR-62)
ENABLE_DEV_MAP                          # '1' enables /dev/map in non-dev environments; used by CI / Vercel preview for visual regression (ADR-63)
```

## Build & deploy

- **Branching:** PRs against `main`; Vercel preview deploys per PR.
- **CI gate (on PR):** type check + lint + format check + unit tests + integration tests. E2E runs manually before main merge.
- **Migrations:** `drizzle-kit migrate` run manually against prod Supabase **before** code merge (ADR-57). Migration files are committed; the PR description must include a `migration: yes/no` line and confirmation that prod has been migrated.
- **Add-only rule:** pivot and feature migrations are add-only (new columns with defaults, new tables). Drops require a dedicated PR and explicit user instruction (ADR-51).
- **Environments:** Two Supabase projects (dev, prod). One Inngest project with branch-routed environments.
- **Deploy gate:** Vercel cap `$200/month` set as hard ceiling; alerts at `$100` / `$150`.
- **Test routes:** `app/api/test/*` are NODE_ENV-guarded at the top of each route. Production deploys must verify a `notFound()` is returned (ADR-47).

## Observability

- **Funnel + product analytics:** PostHog cloud; 6 core events; cookieless mode; URL masking on `/{username}` paths.
- **Performance:** Vercel Speed Insights (auto-captured LCP, CLS, INP). Targets: LCP <2.5s, CLS <0.1, INP <200ms.
- **Error monitoring:** Sentry with `beforeSend` automatic scrub of `authorization`, `cookie`, token-pattern strings (ADR-49). Constellation WebGL renderer reports three custom events to support rollout (ADR-62):
  - `constellation.webgl.init_success` — boolean, fired once per Scene mount
  - `constellation.webgl.init_failure` — fired with `reason` tag (`unsupported` | `error`); triggers Skeleton + banner fallback
  - `constellation.webgl.context_lost` — counter; mobile background-tab recovery signal
  Scene is wrapped in a React Error Boundary that catches runtime crashes and reports to Sentry with `constellation.webgl.scene_crash`; the boundary falls back to Skeleton + retry banner.
- **Uptime:** UptimeRobot pings `/api/health` (HEAD or GET) every 5 min.
- **Cost:** manual monthly review of Vercel + Supabase + Inngest + Resend dashboards; Vercel hard cap as backstop.

## Migration & deploy procedure

1. Author migration in `drizzle/migrations/`. Schema is split by feature in `lib/db/schema/*.ts`; add new tables in their own file.
2. Test against dev Supabase: `DATABASE_URL=<dev_pooler> drizzle-kit migrate`.
3. Open PR. CI runs full check suite.
4. Before merge: run `DATABASE_URL=<prod_pooler> drizzle-kit migrate` against prod (ADR-57).
5. Confirm in PR description: `migration: applied`.
6. Merge → Vercel deploys.
7. Rollback path: add-only migrations are forward-compatible; if a feature is broken, code revert is the rollback (no schema rollback required — ADR-56).
