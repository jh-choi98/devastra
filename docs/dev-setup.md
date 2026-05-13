# Local Development Setup — DevAtlas

## Required tools

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | `node --version` to verify |
| npm | bundled with Node | or pnpm — scripts below use `npm` |
| Docker | any recent | required only for local Supabase (optional) |
| Supabase CLI | latest | `npm install -g supabase` — only if running local Supabase |

## Clone and install

```bash
git clone <repo-url> devatlas
cd devatlas
npm install
cp .env.example .env.local
```

**Never commit `.env.local`.** It is git-ignored. `.env.example` contains only placeholder values and is safe to commit.

## Environment variables

Populate `.env.local` with the values below. All secrets are server-side unless prefixed `NEXT_PUBLIC_`.

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → service_role key |
| `DATABASE_URL` | Supabase dashboard → Project Settings → Database → Connection string (direct, not pooled) |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub → Settings → Developer settings → OAuth Apps → your app |
| `GITHUB_OAUTH_CLIENT_SECRET` | same OAuth App page → "Generate a new client secret" |
| `INNGEST_EVENT_KEY` | Inngest dashboard → your app → Event Keys |
| `INNGEST_SIGNING_KEY` | Inngest dashboard → your app → Signing Key |
| `RESEND_API_KEY` | Resend dashboard → API Keys → Create API Key |
| `SENTRY_DSN` | Sentry → your project → Settings → SDK Setup → DSN |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog → Project Settings → Project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog → Project Settings → API host (e.g. `https://us.i.posthog.com`) |

### GitHub OAuth App callback URL

When creating the GitHub OAuth App, set the callback URL to:
- Local: `http://localhost:3000/auth/callback`
- Production: `https://devatlas.app/auth/callback`

## Running the dev server

```bash
npm run dev
```

App is available at `http://localhost:3000`.

## Running Drizzle migrations

Drizzle schema lives in `lib/db/schema/`. Migrations are generated from the TypeScript schema and applied to the target database.

```bash
# Generate SQL migration files from schema changes
npm run db:generate

# Apply pending migrations to the dev Supabase project
npm run db:migrate
```

`DATABASE_URL` in `.env.local` determines the target database. Point it at your Supabase dev project's direct connection string.

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

## Running tests

### Unit tests (Vitest)

```bash
npx vitest run tests/unit
```

Covers classifier rules, scoring formula, stage threshold calculation, and GitHub event parsing.

### Integration tests (Vitest)

```bash
npx vitest run tests/integration
```

Runs against a real Supabase dev project. Requires `.env.test` (git-ignored) with credentials for the test Supabase project. Uses `--pool=forks` to isolate DB state between tests.

### E2E tests (Playwright)

```bash
npx playwright test tests/e2e
```

The single E2E smoke test (`signup-to-reveal.spec.ts`) runs against a Vercel preview deploy. Set `BASE_URL` in the environment to point at the target URL before running.

## Previewing React Email templates

```bash
npx react-email dev
```

Opens a preview server at `http://localhost:3000` (or next available port) showing rendered versions of `lib/email/templates/WeeklyRecap.tsx` and `WeeklyRecapEmpty.tsx`.

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
- `DATABASE_URL` → direct Postgres connection (port `54322`)

## `.env.example` discipline

Keep `.env.example` in sync with all variables listed above. Use empty strings or obviously-fake placeholders:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Never put real secrets in `.env.example`.**
