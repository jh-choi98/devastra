# Local Development Setup — DevAstra

**Scope of this doc:** what you need installed and configured to run DevAstra locally. For _what_ the project is, see `docs/prd.md`. For _how_ the code is organized, see `docs/code-architecture.md`. For _deploy procedure_, see `docs/code-architecture.md` §Migration & deploy procedure.

## Required tools

| Tool         | Version           | Notes                                                      |
| ------------ | ----------------- | ---------------------------------------------------------- |
| Node.js      | 20+               | `node --version` to verify                                 |
| npm          | bundled with Node | or pnpm — scripts below use `npm`                          |
| Docker       | any recent        | required only for local Supabase (optional)                |
| Supabase CLI | latest            | `npm install -g supabase` — only if running local Supabase |

## Clone and install

```bash
git clone <repo-url> devastra
cd devastra
npm install
cp .env.example .env.local
```

**Never commit `.env.local`.** It is git-ignored. `.env.example` contains only placeholder values and is safe to commit.

## Environment variables

Populate `.env.local` with the values below. All secrets are server-side unless prefixed `NEXT_PUBLIC_`.

### Core platform

| Variable                        | Where to get it                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase dashboard → Project Settings → API → Project URL                                                                                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → `anon`/`public` key                                                                              |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase dashboard → Project Settings → API → `service_role` key                                                                               |
| `DATABASE_URL`                  | Supabase dashboard → Project Settings → Database → Connection string, **Transaction-mode pooler** (port `6543`). Runtime queries use this.     |
| `DIRECT_URL`                    | Supabase dashboard → Project Settings → Database → Connection string, **Direct connection** (port `5432`). Used only by `drizzle-kit migrate`. |
| `NEXT_PUBLIC_BASE_URL`          | Public app origin used for sitemap, robots, canonical links, and social metadata. Production: `https://devastra.app` or the active deploy URL. |
| `NEXT_PUBLIC_APP_URL`           | Public app origin used for user-facing share links. Defaults to `NEXT_PUBLIC_BASE_URL` when unset.                                              |

### GitHub OAuth

| Variable                     | Where to get it                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_OAUTH_CLIENT_ID`     | GitHub → Settings → Developer settings → OAuth Apps → your app                                                                                          |
| `GITHUB_OAUTH_CLIENT_SECRET` | same OAuth App page → "Generate a new client secret"                                                                                                    |
| `APP_HOSTNAME_ALLOWLIST`     | Comma-separated list. Local dev: `localhost:3000`. Production: `devastra.app,www.devastra.app`. Used by OAuth origin validation (`docs/adr.md` ADR-47). |

### Background jobs

| Variable              | Where to get it                            |
| --------------------- | ------------------------------------------ |
| `INNGEST_EVENT_KEY`   | Inngest dashboard → your app → Event Keys  |
| `INNGEST_SIGNING_KEY` | Inngest dashboard → your app → Signing Key |

### Email

| Variable                    | Where to get it                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`            | Resend dashboard → API Keys → Create API Key                                                   |
| `RESEND_WEBHOOK_SECRET`     | Resend dashboard → Webhooks → your endpoint → Signing Secret (for bounce webhook verification) |
| `UNSUBSCRIBE_TOKEN_SECRET`  | Generate locally: `openssl rand -base64 64`. **Server-only.** Used to sign unsubscribe JWTs.   |
| `UNSUBSCRIBE_TOKEN_VERSION` | Numeric string, e.g. `1`. Bump to invalidate all outstanding tokens (`docs/adr.md` ADR-48).    |

### OG image cache

| Variable            | Where to get it                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `OG_RENDER_VERSION` | String tag, e.g. `devastra-1`. Bump on any global renderer / product-language change to invalidate cached OG images (`docs/adr.md` ADR-52). |

For local visual checks, the profile OG route exposes a mock constellation outside production:

```bash
open "http://localhost:3000/api/og/profile/demo?test=1"
```

Use this after changes to the share modal or `lib/og/ConstellationImage.tsx` to confirm the static 1200×630 share image still follows the current dark-sky constellation style.

For X / LinkedIn preview-card checks, make sure `NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_BASE_URL` points at an externally reachable origin. Social platforms scrape the public profile page and its absolute `og:image`; they do not receive the downloaded 2400×1260 PNG as an uploaded attachment from the share URL. After deploys that change OG metadata or imagery, refresh LinkedIn's cache with Post Inspector and X's cache with Card Validator.

### Constellation renderer (ADR-62, ADR-63)

| Variable                 | Where to get it                                                                                                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONSTELLATION_RENDERER` | Optional. `webgl` (default if unset) or `svg`. **Server-side only** — never `NEXT_PUBLIC_*`. Local dev typically leaves unset. Set to `svg` in Vercel dashboard for instant production rollback to the legacy renderer without redeploy. Read by server components, passed as prop. |
| `ENABLE_DEV_MAP`         | Optional. Set to `1` to expose `/dev/map` in non-dev environments (CI / Vercel preview only). Production deploys leave it unset → 404 (`docs/adr.md` ADR-63).                                                                                                                       |

### Observability

| Variable                   | Where to get it                                                         |
| -------------------------- | ----------------------------------------------------------------------- |
| `SENTRY_DSN`               | Sentry → your project → Settings → SDK Setup → DSN                      |
| `NEXT_PUBLIC_POSTHOG_KEY`  | PostHog → Project Settings → Project API key                            |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog → Project Settings → API host (e.g. `https://us.i.posthog.com`) |

### GitHub OAuth App callback URL

When creating the GitHub OAuth App, set the callback URL to:

- **Local:** `http://localhost:3000/auth/callback`
- **Production:** `https://devastra.app/auth/callback`

You can register multiple callback URLs in a single OAuth App, separated by comma in the GitHub UI (or by creating separate OAuth Apps for dev vs prod).

## Pooler vs direct connection

DevAstra uses Supabase's transaction-mode connection pooler at runtime (`DATABASE_URL`, port `6543`) and direct connection only for migrations (`DIRECT_URL`, port `5432`). See `docs/adr.md` ADR-51.

The `postgres-js` driver is configured with `prepare: false` (in `lib/db/client.ts`) because transaction-mode poolers do not support session-bound prepared statements. **Do not remove this flag.**

Do not point runtime `DATABASE_URL` at the direct `:5432` connection. Local real-GitHub E2E can open many concurrent requests during onboarding + Inngest sync; direct/session-mode connections can exhaust the Supabase client limit. Direct `:5432` is for Drizzle migrations and one-off schema checks only.

## Supabase Vault setup

GitHub OAuth tokens are encrypted with a Supabase Vault secret named `devastra_token_encryption_key` (ADR-10). This value is **not** an `.env.local` variable and is not copied from the Supabase API settings. Create it once per Supabase project in the SQL editor:

```sql
select vault.create_secret(
  encode(gen_random_bytes(32), 'base64'),
  'devastra_token_encryption_key',
  'GitHub token encryption key for DevAstra'
);
```

The app reads the decrypted secret by name from Vault inside server-only DB code. If encrypted GitHub tokens already exist, do not rename this secret without a migration plan that re-encrypts existing rows.

## Running the dev server

```bash
npm run dev
```

App is available at `http://localhost:3000`.

## Running Drizzle migrations

Drizzle schema lives in `lib/db/schema/`. Migrations are generated from the TypeScript schema and applied to the target database. See `docs/adr.md` ADR-51 (add-only policy) and ADR-57 (manual gate before merge).

```bash
# Generate SQL migration files from schema changes
npm run db:generate

# Apply pending migrations to the dev Supabase project (uses DIRECT_URL)
npm run db:migrate
```

`DIRECT_URL` in `.env.local` determines the target database for migrations. Point it at your Supabase dev project's direct connection string. If you temporarily export `DIRECT_URL` in a terminal, unset it after the migration and avoid pasting production URLs inline into shared logs.

**Production migration procedure** (do this before merging the PR that introduces the schema change):

```bash
# Set DIRECT_URL to the production direct connection string in your private shell first.
npm run db:migrate
unset DIRECT_URL
```

Then add `migration: applied` to the PR description and merge. Vercel deploys after merge.

## Running the Inngest dev server

Inngest requires a local dev server to receive and run background jobs during local development.

**Terminal 1 — Next.js dev server:**

```bash
npm run dev
```

**Terminal 2 — Inngest dev server:**

```bash
npx inngest-cli dev
```

The Inngest dev server starts at `http://localhost:8288` and auto-discovers your Inngest functions by polling `http://localhost:3000/api/inngest`. No additional configuration is required — the SDK connects to the local dev server automatically when `INNGEST_DEV=1` or when `NODE_ENV=development`.

## Local real-GitHub E2E preflight

Before running the local OAuth/sync flow against a real GitHub account, confirm:

1. Supabase Auth Site URL is `http://localhost:3000`.
2. Supabase Auth redirect URLs include `http://localhost:3000/auth/callback`.
3. GitHub OAuth App callback URL is `http://localhost:3000/auth/callback`.
4. `APP_HOSTNAME_ALLOWLIST` includes `localhost:3000`.
5. `DATABASE_URL` is the Supabase transaction pooler (`:6543`), not direct `:5432`.
6. `DIRECT_URL` is set only when running Drizzle migrations.
7. The Vault secret `devastra_token_encryption_key` exists.
8. Next.js dev server and Inngest dev server are both running.

Then test: sign in with GitHub → select repos → build constellation → wait for Inngest initial sync → refresh constellation → open Settings → open the public profile if enabled. Inngest `206` step responses are normal while a function is still running; first sync can take minutes on accounts with many repos.

## Running tests

### Unit tests (Vitest)

```bash
npx vitest run tests/unit
```

Covers: classifier rule engine, scoring formula, stage-threshold calc, GitHub parser, `username-redirect` resolver, `unsubscribe-token` verifier, `withUserScope` query helper.

### Integration tests (Vitest)

```bash
npx vitest run tests/integration
```

Runs against a real Supabase dev project. Requires `.env.test` (git-ignored) with credentials for the test Supabase project. Uses `--pool=forks` to isolate DB state between tests.

Includes RLS isolation, public-profile visibility, weekly-recap generation, OAuth callback flow, and React Email template snapshot diffs.

### E2E tests (Playwright)

```bash
npx playwright test tests/e2e
```

Two specs:

- `signup-to-reveal.spec.ts` — smoke test for signup → repo selection → first reveal completion.
- `constellation-render.spec.ts` — screenshot diff of the steady-state main page against a committed baseline image.

Set `BASE_URL` in the environment to point at the target URL (Vercel preview deploy URL) before running.

## Dev constellation map

`/dev/map` is guarded by `ENABLE_DEV_MAP=1` so production deployments keep it hidden. To open it locally:

```bash
ENABLE_DEV_MAP=1 npm run dev
```

Then visit:

- `http://localhost:3000/dev/map` — dense default constellation
- `http://localhost:3000/dev/map?scenario=brightness` — five-step brightness ladder (`faint → emerging → steady → bright → radiant`) for star and edge visual review
- `http://localhost:3000/dev/map?scenario=sparse` — sparse user framing
- `http://localhost:3000/dev/map?scenario=stage-up` — stage-up cinematic preset
- `http://localhost:3000/dev/map?scenario=first-ever` — first-star cinematic preset

Use `layers=` to isolate rendering layers, e.g. `?scenario=brightness&layers=sky,haze,fieldstars,midstars,connections,techstars,labels`.

## Previewing React Email templates

```bash
npx react-email dev
```

Opens a preview server (default port `3000` or next available) showing rendered versions of:

- `lib/email/templates/WeeklyRecapActive.tsx`
- `lib/email/templates/WeeklyRecapEmpty.tsx`
- `lib/email/templates/WeeklyRecapFirstWeek.tsx`

Each template can be previewed with mock data — see the `*.preview.tsx` files alongside the templates.

## Local Supabase (optional)

If you prefer a fully local environment without a Supabase cloud project:

```bash
supabase start     # starts Postgres + Auth + Realtime via Docker
supabase db push   # applies migrations to local project
```

Local credentials printed by `supabase start` map to env vars as:

- `NEXT_PUBLIC_SUPABASE_URL` → `API URL` (usually `http://localhost:54321`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `anon key`
- `SUPABASE_SERVICE_ROLE_KEY` → `service_role key`
- `DATABASE_URL` → set to the local pgbouncer URL if available; otherwise use the direct Postgres URL (port `54322`) and accept the lower connection ceiling for dev.
- `DIRECT_URL` → direct Postgres URL (port `54322`)

**Supabase Vault note (ADR-10).** Local Supabase does not initialize Vault by default. For local development you can either (a) skip Vault and stub `lib/db/encryption.ts` to use a development-only secret loaded from `.env.local`, or (b) install Vault via the Supabase CLI extension. The production deployment must use Vault — never ship the local stub to production.

## Founder-only operations (production)

These are performed manually via Supabase dashboard SQL (no admin UI per `docs/adr.md` ADR-42 / ADR-21):

- **System status banner.** Insert a row into `system_messages`:

  ```sql
  INSERT INTO system_messages (message, severity, active)
  VALUES ('Sync is delayed right now. Your constellation is safe.', 'warning', true);
  ```

  Set `active = false` to retire.

- **Misclassification feedback triage.**

  ```sql
  SELECT tech_key, category, note, created_at
  FROM misclassification_feedback
  ORDER BY created_at DESC
  LIMIT 100;
  ```

- **Data export request (ADR-60).** Use `scripts/export-user-data.ts` (to be written when the first request arrives) with the user's email as input.

## `.env.example` discipline

Keep `.env.example` in sync with all variables listed above. Use empty strings or obviously-fake placeholders:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DATABASE_URL=postgres://postgres.your-project:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
DIRECT_URL=postgres://postgres.your-project:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
UNSUBSCRIBE_TOKEN_SECRET=replace-with-openssl-rand-base64-64
UNSUBSCRIBE_TOKEN_VERSION=1
OG_RENDER_VERSION=devastra-1
APP_HOSTNAME_ALLOWLIST=localhost:3000,devastra.app
```

**Never put real secrets in `.env.example`.**
