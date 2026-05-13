# Phase 1: Project Bootstrap

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/prd.md`
- `/docs/code-architecture.md`
- `/docs/adr.md` (especially ADR-3, ADR-4, ADR-5, ADR-6, ADR-7, ADR-23)
- `/docs/dev-setup.md`
- `/CLAUDE.md`
- `/tasks/0-mvp/docs-diff.md` (auto-generated from Phase 0)

Then verify Phase 0's output:

- `/docs/dev-setup.md`, `/docs/tech-catalog.md`, `/CLAUDE.md` all exist

## Work

Bootstrap a Next.js 14 App Router project in the existing repository root. The repo already contains `docs/`, `prompts/`, `scripts/`, `tasks/`, and `CLAUDE.md`. Do not remove any of them. Do not initialize a new git repo (one already exists on `main`).

### 1. `package.json`

Use `npm`. Node ≥ 20. Install (exact versions can be the latest stable at install time, but pin major versions matching this list):

**dependencies**: `next@^14`, `react@^18`, `react-dom@^18`, `@supabase/supabase-js`, `@supabase/ssr`, `drizzle-orm`, `postgres` (or `pg` — pick one and be consistent), `inngest`, `resend`, `@react-email/components`, `@vercel/og`, `framer-motion`, `simplex-noise`, `zod`, `posthog-js`, `posthog-node`, `@sentry/nextjs`, `sonner`, `server-only`, `clsx`, `tailwind-merge`

**devDependencies**: `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `tailwindcss`, `postcss`, `autoprefixer`, `drizzle-kit`, `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `eslint`, `eslint-config-next`, `prettier`, `prettier-plugin-tailwindcss`, `tsx`, `react-email`

**scripts**:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "format": "prettier --write .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "e2e": "playwright test",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:push": "drizzle-kit push",
  "email:dev": "email dev --dir lib/email/templates",
  "inngest:dev": "npx inngest-cli@latest dev"
}
```

### 2. `tsconfig.json`

Next.js defaults with `"strict": true`, `"baseUrl": "."`, `"paths": { "@/*": ["./*"] }`.

### 3. `next.config.ts`

Minimal config. Enable typed routes optionally. Add `images.remotePatterns` for `avatars.githubusercontent.com`. Wire up Sentry later (Phase 12 will add `withSentryConfig`).

### 4. `tailwind.config.ts`

Content paths: `./app/**/*.{ts,tsx}`, `./lib/**/*.{ts,tsx}`, `./features/**/*.{ts,tsx}`. Default theme. Reserve a single accent color token, e.g. `accent: '#3b82f6'` (final palette tuned in Phase 12).

### 5. `postcss.config.mjs`, `.eslintrc.json`, `.prettierrc`

Standard Next.js + Tailwind setup. `prettier-plugin-tailwindcss` enabled.

### 6. `drizzle.config.ts`

Reads `DATABASE_URL` from env. `schema: './lib/db/schema'`. `out: './drizzle/migrations'`. Dialect: `postgresql`.

### 7. `.env.example`

List every variable that the project will eventually need. Use empty values. Reference: `/docs/code-architecture.md` §Configuration & secrets. Required variables:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
RESEND_API_KEY=
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

### 8. `.gitignore`

Extend the existing file. Ensure these are ignored: `node_modules/`, `.next/`, `out/`, `.env*.local`, `.env`, `*.log`, `.vercel/`, `coverage/`, `playwright-report/`, `test-results/`, `drizzle/.snapshot/`.

### 9. Base app shell

Create the minimum structure that `npm run build` succeeds against:

```
app/
  layout.tsx                # html/body shell, font, Tailwind globals
  page.tsx                  # landing placeholder ("DevAtlas — coming soon")
  globals.css               # Tailwind directives
  not-found.tsx             # 404 placeholder ("This land doesn't exist yet")
  (authenticated)/
    layout.tsx              # placeholder authenticated layout (no auth gate yet)
    page.tsx                # placeholder authenticated home
lib/
  utils/
    cn.ts                   # export cn(...) helper combining clsx + tailwind-merge
middleware.ts               # passthrough middleware placeholder (CSP added in Phase 12)
```

Do NOT add real auth logic, DB queries, or business components in this phase. Pages should be plain text + minimal Tailwind so the build succeeds.

### 10. Empty stub directories with `.gitkeep`

Create empty directories that subsequent phases will populate. Add a `.gitkeep` to each:

```
lib/db/schema/.gitkeep
lib/db/queries/.gitkeep
lib/github/.gitkeep
lib/email/templates/.gitkeep
lib/og/.gitkeep
lib/auth/.gitkeep
features/sync/sources/.gitkeep
features/territories/.gitkeep
features/recap/.gitkeep
tests/unit/.gitkeep
tests/integration/.gitkeep
tests/e2e/.gitkeep
drizzle/migrations/.gitkeep
```

### 11. Vitest config

`vitest.config.ts` with sane defaults (node environment for unit, separate config file for integration if needed, paths alias).

### 12. Playwright config

`playwright.config.ts` minimal — single project, headless, baseURL placeholder.

## Acceptance Criteria

```bash
npm install
npm run typecheck
npm run lint
npm run build
test -f .env.example
test -f drizzle.config.ts
test -f tailwind.config.ts
test -f middleware.ts
```

## How to verify AC

Run the AC commands above in order. If all pass, set this phase's status to `"completed"` in `/tasks/0-mvp/index.json`.

If `npm install` produces deprecation warnings, that is fine. If it produces hard errors, retry after pinning specific versions. If you cannot make AC pass after 3 attempts, set status to `"error"` and explain in `"error_message"`.

## Notes

- Do NOT initialize git (already initialized).
- Do NOT create `.env.local` or any file with real secrets. Only `.env.example`.
- Do NOT implement Sentry / PostHog wiring here — that is Phase 12. Adding the deps is fine; wiring is later.
- Do NOT add the SVG map components yet; that is Phase 7.
- Use App Router only. No `pages/` directory.
- All identifiers, comments, and copy in English (CLAUDE.md rule).
- Lint with `next lint`; do not introduce custom ESLint plugins beyond Next.js defaults in this phase.
