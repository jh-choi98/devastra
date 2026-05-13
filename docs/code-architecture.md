# Code Architecture — DevAtlas

**Scope of this doc:** directory layout, layer responsibilities, dependency rules, naming conventions, external dependencies. For *why* the stack, see `docs/adr.md`. For *what* the entities are, see `docs/data-schema.md`.

## Directory tree

```
/
├── app/                            # Next.js 14 App Router routes
│   ├── (authenticated)/
│   │   ├── page.tsx                # Main map (/) for logged-in users
│   │   ├── settings/page.tsx
│   │   └── onboarding/repos/page.tsx
│   ├── [username]/page.tsx         # Public profile (ISR 1h + on-demand revalidate)
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # Supabase Auth callback handlers
│   │   ├── inngest/route.ts              # Inngest webhook (signature verified)
│   │   ├── og/
│   │   │   ├── profile/[username]/route.tsx
│   │   │   └── recap/[recap_id]/route.tsx
│   │   └── refresh/route.ts              # Manual refresh trigger
│   ├── _components/
│   │   ├── Map/
│   │   │   ├── LivingMap.tsx       # Root SVG canvas
│   │   │   ├── Island.tsx          # One territory island
│   │   │   ├── Landmark.tsx        # Building/icon on island
│   │   │   └── RevealAnimator.tsx  # Framer Motion orchestration
│   │   ├── TerritoryDrawer.tsx
│   │   ├── ShareModal.tsx
│   │   └── Header.tsx              # Refresh / Share / Avatar dropdown
│   ├── layout.tsx
│   ├── not-found.tsx
│   └── globals.css
│
├── lib/                            # Shared utilities; server-only marked where applicable
│   ├── db/
│   │   ├── client.ts               # Drizzle client (server-only)
│   │   ├── schema/
│   │   │   ├── users.ts
│   │   │   ├── repositories.ts
│   │   │   ├── activities.ts
│   │   │   ├── territories.ts
│   │   │   ├── landmarks.ts
│   │   │   ├── sync-jobs.ts
│   │   │   ├── weekly-recaps.ts
│   │   │   └── email-sends.ts
│   │   └── queries/                # Composed query functions per entity
│   ├── github/
│   │   ├── graphql.ts              # GraphQL client + queries (server-only)
│   │   ├── rest.ts                 # REST client (server-only)
│   │   └── token.ts                # JIT refresh logic
│   ├── email/
│   │   ├── client.ts               # Resend client (server-only)
│   │   └── templates/              # React Email components
│   │       ├── WeeklyRecap.tsx
│   │       └── WeeklyRecapEmpty.tsx
│   ├── og/
│   │   ├── ProfileImage.tsx        # @vercel/og component
│   │   └── RecapImage.tsx
│   ├── auth/
│   │   └── supabase.ts             # Supabase client (server + browser variants)
│   ├── posthog.ts                  # Analytics client (server-side ingest)
│   ├── sentry.config.ts
│   └── utils/                      # tz, formatters, zod common schemas
│
├── features/                       # Domain logic; server-only
│   ├── sync/
│   │   ├── runner.ts               # Inngest function definitions
│   │   ├── initial.ts              # Initial sync orchestration
│   │   ├── incremental.ts          # Daily/manual incremental sync
│   │   ├── backfill.ts             # Reclassify existing activities
│   │   └── sources/
│   │       ├── interface.ts        # SourceClient interface
│   │       └── github.ts           # GitHubSourceClient impl
│   ├── territories/
│   │   ├── classifier.ts           # Classifier interface + GitHubClassifier
│   │   ├── scoring.ts              # weight = commit*1 + pr*5 + issue*2
│   │   ├── rules.ts                # Stage thresholds, unlock thresholds (server-only)
│   │   ├── registry.ts             # Territory metadata (name, color, seed) — shared
│   │   └── tech-catalog.ts         # 50-tech matching rules
│   └── recap/
│       ├── generate.ts             # Weekly recap data assembly
│       ├── send.ts                 # Resend dispatch + fan-out
│       └── diff.ts                 # Week-over-week comparison
│
├── middleware.ts                   # CSP, rate limits, locale
├── drizzle.config.ts
├── inngest.config.ts
├── next.config.ts
├── package.json
└── tests/
    ├── unit/                       # Vitest; classifier, scoring, parser
    ├── integration/                # Vitest; sync e2e w/ mocked GitHub, RLS, visibility
    └── e2e/                        # Playwright; single signup-to-reveal smoke
```

## Layers and dependency direction

```
app/  ──┐
        ▼
       features/ ──┐
                   ▼
                  lib/ ──► (Supabase, GitHub, Resend, Inngest, Vercel OG)
```

Rules:
- `app/` may import from `lib/` and `features/`. Never the reverse.
- `features/` may import from `lib/`. Never the reverse.
- `lib/` is leaf-level; modules within `lib/` may import each other only when there is no circular path.
- Client components (under `app/_components/`) may only import from `lib/` modules that are *not* `server-only`. They never import from `features/`.

The `server-only` package is imported at the top of every file under `lib/db/`, `lib/github/`, `lib/email/`, `features/sync/`, `features/territories/rules.ts`, `features/recap/`. This causes a build error if anything in `app/_components/` accidentally imports them.

## Naming conventions

| Concern | Convention |
|---|---|
| Files | kebab-case (`weekly-recap.ts`); React components PascalCase (`LivingMap.tsx`) |
| Drizzle schema modules | one file per entity, plural noun (`users.ts`, `activities.ts`) |
| Inngest events | `<domain>/<action>.<variant>` e.g. `sync/initial.requested`, `recap/email.send` |
| Server Actions | Verb-first function name; co-located in same file as the consuming component when scoped, else under `features/<domain>/actions.ts` |
| Database identifiers | `snake_case` for columns and tables; matches data-schema.md |
| Environment vars | `SCREAMING_SNAKE_CASE`; never imported in client components |

## Testing conventions

- Co-locate unit tests next to source files using `.test.ts` suffix where the test is small and pure.
- Integration tests under `tests/integration/`, named after the flow under test (`initial-sync.test.ts`, `rls-isolation.test.ts`, `public-profile-visibility.test.ts`).
- The single E2E in `tests/e2e/signup-to-reveal.spec.ts` runs against a Playwright instance pointed at a Vercel preview deploy of a feature branch.
- Vitest config uses `vitest --pool=forks` for integration tests that need a real Supabase dev project. The dev project's `.env.test` is git-ignored.

## External dependencies (justification per dep)

| Dependency | Why |
|---|---|
| `next` (14, App Router) | Single full-stack repo with Server Components + Server Actions + ISR; minimum infra |
| `react`, `react-dom` | Required by Next.js |
| `@supabase/supabase-js`, `@supabase/ssr` | Auth + DB + Realtime; ADR-3 |
| `drizzle-orm`, `drizzle-kit` | TypeScript-native ORM with fast cold-start on serverless; ADR-4 |
| `inngest` | Step-based background jobs with at-least-once guarantees, built-in observability, free tier sufficient until Pro at 1k users; ADR-5 |
| `resend`, `@react-email/components` | Transactional email with React templates; cheap free tier; ADR-6 |
| `@vercel/og` | Edge-rendered OG images sharing the same SVG generation code as the live map; ADR-7 |
| `framer-motion` | Reveal animation, drawer slide, badge glow |
| `simplex-noise` | Procedural island shape generation |
| `zod` | Runtime input validation on all Server Actions and route handlers |
| `posthog-js`, `posthog-node` | Funnel analytics; ADR-18 |
| `@sentry/nextjs` | Error monitoring with PII scrubbing |
| `tailwindcss` | Styling |
| `sonner` (or similar) | Toast notifications for in-app events (landmark unlocked, settings saved) |
| `server-only` | Build-time enforcement that server code is never bundled to client |
| `vitest`, `@playwright/test` | Test runners; ADR-21 |

## Configuration & secrets

All secrets live in Vercel environment variables. Local development uses `.env.local` (git-ignored). The following are required:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY              # server-only
DATABASE_URL                            # Drizzle direct connection
GITHUB_OAUTH_CLIENT_ID
GITHUB_OAUTH_CLIENT_SECRET             # server-only
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY                    # server-only
RESEND_API_KEY                          # server-only
SENTRY_DSN
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST
```

## Build & deploy

- **Branching:** PRs against `main`; Vercel preview deploys per PR.
- **Migrations:** `drizzle-kit migrate` run manually against prod Supabase before each `main` deploy. Migration files are committed; deploy step waits on confirmation in PR description.
- **Environments:** Two Supabase projects (dev, prod). One Inngest project with branch-routed environments.
- **Deploy gate:** Vercel cap `$200/month` set as hard ceiling.
