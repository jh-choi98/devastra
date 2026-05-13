# docs-diff: mvp

Baseline: `1e360c0`

## `docs/dev-setup.md`

```diff
diff --git a/docs/dev-setup.md b/docs/dev-setup.md
new file mode 100644
index 0000000..5aede37
--- /dev/null
+++ b/docs/dev-setup.md
@@ -0,0 +1,144 @@
+# Local Development Setup — DevAtlas
+
+## Required tools
+
+| Tool | Version | Notes |
+|---|---|---|
+| Node.js | 20+ | `node --version` to verify |
+| npm | bundled with Node | or pnpm — scripts below use `npm` |
+| Docker | any recent | required only for local Supabase (optional) |
+| Supabase CLI | latest | `npm install -g supabase` — only if running local Supabase |
+
+## Clone and install
+
+```bash
+git clone <repo-url> devatlas
+cd devatlas
+npm install
+cp .env.example .env.local
+```
+
+**Never commit `.env.local`.** It is git-ignored. `.env.example` contains only placeholder values and is safe to commit.
+
+## Environment variables
+
+Populate `.env.local` with the values below. All secrets are server-side unless prefixed `NEXT_PUBLIC_`.
+
+| Variable | Where to get it |
+|---|---|
+| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
+| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → anon/public key |
+| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → service_role key |
+| `DATABASE_URL` | Supabase dashboard → Project Settings → Database → Connection string (direct, not pooled) |
+| `GITHUB_OAUTH_CLIENT_ID` | GitHub → Settings → Developer settings → OAuth Apps → your app |
+| `GITHUB_OAUTH_CLIENT_SECRET` | same OAuth App page → "Generate a new client secret" |
+| `INNGEST_EVENT_KEY` | Inngest dashboard → your app → Event Keys |
+| `INNGEST_SIGNING_KEY` | Inngest dashboard → your app → Signing Key |
+| `RESEND_API_KEY` | Resend dashboard → API Keys → Create API Key |
+| `SENTRY_DSN` | Sentry → your project → Settings → SDK Setup → DSN |
+| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog → Project Settings → Project API key |
+| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog → Project Settings → API host (e.g. `https://us.i.posthog.com`) |
+
+### GitHub OAuth App callback URL
+
+When creating the GitHub OAuth App, set the callback URL to:
+- Local: `http://localhost:3000/auth/callback`
+- Production: `https://devatlas.app/auth/callback`
+
+## Running the dev server
+
+```bash
+npm run dev
+```
+
+App is available at `http://localhost:3000`.
+
+## Running Drizzle migrations
+
+Drizzle schema lives in `lib/db/schema/`. Migrations are generated from the TypeScript schema and applied to the target database.
+
+```bash
+# Generate SQL migration files from schema changes
+npm run db:generate
+
+# Apply pending migrations to the dev Supabase project
+npm run db:migrate
+```
+
+`DATABASE_URL` in `.env.local` determines the target database. Point it at your Supabase dev project's direct connection string.
+
+## Running the Inngest dev server
+
+Inngest requires a local dev server to receive and run background jobs during local development.
+
+**Terminal 1 — Next.js dev server:**
+```bash
+npm run dev
+```
+
+**Terminal 2 — Inngest dev server:**
+```bash
+npx inngest-cli dev
+```
+
+The Inngest dev server starts at `http://localhost:8288` and auto-discovers your Inngest functions by polling `http://localhost:3000/api/inngest`. No additional configuration is required — the SDK connects to the local dev server automatically when `INNGEST_DEV=1` or when `NODE_ENV=development`.
+
+## Running tests
+
+### Unit tests (Vitest)
+
+```bash
+npx vitest run tests/unit
+```
+
+Covers classifier rules, scoring formula, stage threshold calculation, and GitHub event parsing.
+
+### Integration tests (Vitest)
+
+```bash
+npx vitest run tests/integration
+```
+
+Runs against a real Supabase dev project. Requires `.env.test` (git-ignored) with credentials for the test Supabase project. Uses `--pool=forks` to isolate DB state between tests.
+
+### E2E tests (Playwright)
+
+```bash
+npx playwright test tests/e2e
+```
+
+The single E2E smoke test (`signup-to-reveal.spec.ts`) runs against a Vercel preview deploy. Set `BASE_URL` in the environment to point at the target URL before running.
+
+## Previewing React Email templates
+
+```bash
+npx react-email dev
+```
+
+Opens a preview server at `http://localhost:3000` (or next available port) showing rendered versions of `lib/email/templates/WeeklyRecap.tsx` and `WeeklyRecapEmpty.tsx`.
+
+## Local Supabase (optional)
+
+If you prefer a fully local environment without a Supabase cloud project:
+
+```bash
+supabase start     # starts Postgres + Auth + Realtime via Docker
+supabase db push   # applies migrations to local project
+```
+
+Local credentials printed by `supabase start` map to env vars as:
+- `NEXT_PUBLIC_SUPABASE_URL` → `API URL` (usually `http://localhost:54321`)
+- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `anon key`
+- `SUPABASE_SERVICE_ROLE_KEY` → `service_role key`
+- `DATABASE_URL` → direct Postgres connection (port `54322`)
+
+## `.env.example` discipline
+
+Keep `.env.example` in sync with all variables listed above. Use empty strings or obviously-fake placeholders:
+
+```
+NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
+SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
+```
+
+**Never put real secrets in `.env.example`.**
```

## `docs/tech-catalog.md`

```diff
diff --git a/docs/tech-catalog.md b/docs/tech-catalog.md
new file mode 100644
index 0000000..3451e14
--- /dev/null
+++ b/docs/tech-catalog.md
@@ -0,0 +1,132 @@
+# Tech Catalog — DevAtlas
+
+**Scope of this doc:** the 50-tech catalog that drives the classifier in
+`features/territories/tech-catalog.ts`. This file is the source of truth. The TypeScript constant
+must match it exactly. See `docs/code-architecture.md` §Features → territories for how the
+classifier consumes this catalog.
+
+## Detection rule grammar
+
+| Rule prefix | Matches on |
+|---|---|
+| `ext: .ts .tsx` | file extension of any path in `activities.raw.file_paths` |
+| `path: .github/workflows/` | path prefix of any entry in `activities.raw.file_paths` |
+| `filename: Dockerfile` | exact filename (basename) of any entry in `activities.raw.file_paths` |
+| `packageJson: react` | package present in the `dependencies` or `devDependencies` of any committed `package.json` |
+| `requirementsTxt: django` | package present in a committed `requirements.txt` |
+| `goMod: gin-gonic/gin` | module path present in a committed `go.mod` |
+| `gemfile: rails` | gem name present in a committed `Gemfile` |
+| `cargoToml: serde` | crate name present in a committed `Cargo.toml` |
+
+A single activity may match multiple rules → multiple `tech_key` values (multi-label).
+
+---
+
+## Catalog table
+
+### Frontend Land
+
+| tech_key | display_name (landmark name) | territory | detection rules |
+|---|---|---|---|
+| `typescript` | TypeScript Pavilion | `frontend_land` | `ext: .ts .tsx` |
+| `javascript` | JavaScript Square | `frontend_land` | `ext: .js .jsx .mjs .cjs` |
+| `react` | React Forge | `frontend_land` | `packageJson: react` |
+| `nextjs` | Next.js Citadel | `frontend_land` | `packageJson: next` |
+| `vue` | Vue Garden | `frontend_land` | `packageJson: vue` |
+| `svelte` | Svelte Foundry | `frontend_land` | `packageJson: svelte` |
+| `angular` | Angular Arcade | `frontend_land` | `packageJson: @angular/core` |
+| `tailwind` | Tailwind Plaza | `frontend_land` | `packageJson: tailwindcss` |
+| `css` | CSS Gallery | `frontend_land` | `ext: .css` |
+| `sass` | Sass Studio | `frontend_land` | `ext: .scss .sass` |
+| `vite` | Vite Spire | `frontend_land` | `packageJson: vite` |
+| `webpack` | Webpack Bunker | `frontend_land` | `packageJson: webpack` |
+
+### Backend Fortress
+
+| tech_key | display_name (landmark name) | territory | detection rules |
+|---|---|---|---|
+| `nodejs` | Node.js Watchtower | `backend_fortress` | `filename: package.json` |
+| `express` | Express Gatehouse | `backend_fortress` | `packageJson: express` |
+| `fastify` | Fastify Rampart | `backend_fortress` | `packageJson: fastify` |
+| `nestjs` | NestJS Keep | `backend_fortress` | `packageJson: @nestjs/core` |
+| `go` | Go Tower | `backend_fortress` | `ext: .go` |
+| `gin` | Gin Barracks | `backend_fortress` | `goMod: gin-gonic/gin` |
+| `python` | Python Spire | `backend_fortress` | `ext: .py` |
+| `fastapi` | FastAPI Stronghold | `backend_fortress` | `requirementsTxt: fastapi` |
+| `django` | Django Citadel | `backend_fortress` | `requirementsTxt: django` |
+| `flask` | Flask Outpost | `backend_fortress` | `requirementsTxt: flask` |
+| `rust` | Rust Bastion | `backend_fortress` | `ext: .rs` |
+| `java` | Java Fortress | `backend_fortress` | `ext: .java` |
+
+### Data Pipeline Zone
+
+| tech_key | display_name (landmark name) | territory | detection rules |
+|---|---|---|---|
+| `postgres` | Postgres Reservoir | `data_pipeline_zone` | `packageJson: pg` |
+| `mysql` | MySQL Lock | `data_pipeline_zone` | `packageJson: mysql2` |
+| `sqlite` | SQLite Vault | `data_pipeline_zone` | `packageJson: better-sqlite3` |
+| `mongodb` | MongoDB Cavern | `data_pipeline_zone` | `packageJson: mongoose` |
+| `redis` | Redis Floodgate | `data_pipeline_zone` | `packageJson: ioredis` |
+| `sql` | SQL Aqueduct | `data_pipeline_zone` | `ext: .sql` |
+| `dbt` | dbt Channel | `data_pipeline_zone` | `filename: dbt_project.yml` |
+| `prisma` | Prisma Bridge | `data_pipeline_zone` | `packageJson: prisma` |
+
+### Testing Lab
+
+| tech_key | display_name (landmark name) | territory | detection rules |
+|---|---|---|---|
+| `jest` | Jest Workshop | `testing_lab` | `packageJson: jest` |
+| `vitest` | Vitest Observatory | `testing_lab` | `packageJson: vitest` |
+| `pytest` | Pytest Arena | `testing_lab` | `requirementsTxt: pytest` |
+| `playwright` | Playwright Stage | `testing_lab` | `packageJson: @playwright/test` |
+| `cypress` | Cypress Circuit | `testing_lab` | `packageJson: cypress` |
+| `rspec` | RSpec Proving Ground | `testing_lab` | `gemfile: rspec` |
+
+### DevOps Harbor
+
+| tech_key | display_name (landmark name) | territory | detection rules |
+|---|---|---|---|
+| `docker` | Container Dock | `devops_harbor` | `filename: Dockerfile` |
+| `ghactions` | CI Lighthouse | `devops_harbor` | `path: .github/workflows/` |
+| `terraform` | Terraform Quay | `devops_harbor` | `ext: .tf` |
+| `kubernetes` | Helm Pier | `devops_harbor` | `path: k8s/` |
+| `aws` | AWS Anchor | `devops_harbor` | `packageJson: aws-cdk-lib` |
+| `vercel` | Vercel Gangway | `devops_harbor` | `filename: vercel.json` |
+| `nginx` | Nginx Harbor | `devops_harbor` | `filename: nginx.conf` |
+
+### Docs Library
+
+| tech_key | display_name (landmark name) | territory | detection rules |
+|---|---|---|---|
+| `markdown` | Markdown Archive | `docs_library` | `ext: .md` |
+| `mdx` | MDX Atrium | `docs_library` | `ext: .mdx` |
+| `jsdoc` | JSDoc Reading Room | `docs_library` | `filename: jsdoc.json` |
+| `storybook` | Storybook Gallery | `docs_library` | `path: .storybook/` |
+| `openapi` | OpenAPI Scriptorium | `docs_library` | `filename: openapi.yaml` |
+
+---
+
+## Multi-label reminder
+
+A single activity may produce multiple `tech_key` values. For example, a commit that adds
+`src/api/auth.ts` and touches `package.json` with `express` added as a dependency would produce:
+`typescript`, `nodejs`, `express` — all three in one pass. This is by design (see ADR-2 and
+`docs/data-schema.md` §Activity_Territories).
+
+When implementing the classifier, evaluate all 50 rules against each activity and emit one
+`ClassificationResult` per matched `tech_key`.
+
+---
+
+## How to add a new tech
+
+1. Choose a `tech_key`: lowercase, no hyphens (use underscores if needed), globally unique.
+2. Choose a landmark name that matches the territory's visual metaphor (see examples in each
+   section above).
+3. Write the detection rule using the grammar above. Prefer specific rules over broad ones
+   (`packageJson: @nestjs/core` over `ext: .ts`).
+4. Add the row to the relevant territory section in this doc.
+5. Add the corresponding entry to `features/territories/tech-catalog.ts` in the same commit.
+6. Add unit tests in `tests/unit/` covering the new rule.
+7. If the new tech implies a new landmark visual, coordinate with the map renderer in
+   `app/_components/Map/Landmark.tsx`.
```
