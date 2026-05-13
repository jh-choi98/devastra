# Phase 12: Operations & Polish

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/prd.md`
- `/docs/adr.md` (ADR-18, ADR-21, ADR-25)
- `/docs/code-architecture.md` §External dependencies
- `/CLAUDE.md`
- `/tasks/0-mvp/docs-diff.md`

Then verify Phase 11's output:

- `app/(authenticated)/settings/page.tsx` and `_actions.ts` exist
- `lib/utils/reserved-usernames.ts` exists
- `npm test -- reserved-usernames change-username` passes

## Work

Final polish: observability, security middleware, error pages, landing page, legal docs, single E2E smoke.

### 1. Sentry

`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` at project root (Next.js wizard format):

```ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend(event, hint) {
    // scrub tokens, emails, raw bodies
    if (event.request?.cookies) delete event.request.cookies
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
    }
    // walk extra/contexts to strip any string matching token-like patterns
    return scrubSensitive(event)
  },
})

function scrubSensitive(event: any) {
  // remove any string field whose value matches gho_*, ghu_*, ghs_*, ghp_*, or looks like an email
  // ...
  return event
}
```

Wire `withSentryConfig` into `next.config.ts`. Pass `silent: true` and standard tunneling defaults.

### 2. PostHog

`lib/posthog.ts`:

```ts
'use client'
import posthog from 'posthog-js'
let initialized = false
export function initPosthog() {
  if (initialized || typeof window === 'undefined') return
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
    capture_pageview: true,
    disable_session_recording: true,    // limited / off per ADR-18
  })
  initialized = true
}
export { posthog }
```

`lib/posthog-server.ts` (`import 'server-only'`):

```ts
import { PostHog } from 'posthog-node'
const client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, { host: process.env.NEXT_PUBLIC_POSTHOG_HOST! })
export async function captureServerEvent(distinctId: string, event: string, properties?: Record<string, unknown>) {
  client.capture({ distinctId, event, properties })
}
```

Funnel events to capture:

| Event name | Where |
|---|---|
| `landing.viewed` | landing page (client) |
| `oauth.clicked` | sign-in button click (client) |
| `oauth.completed` | OAuth callback success (server) |
| `repo_selection.completed` | after `saveRepoSelectionAndStartSync` (server) |
| `first_reveal.completed` | when reveal sequence finishes the first time (client, gated by firstReveal) |
| `share.clicked` | share button click (client) |
| `public_toggle.enabled` | togglePublic with `next = true` (server) |

A `PosthogIdentifier` client component near the top of `(authenticated)/layout.tsx` calls `posthog.identify(user.id)` once on login.

### 3. Middleware (CSP + rate limit)

Replace the Phase 1 placeholder `middleware.ts` with a real implementation:

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/auth/middleware'

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.posthog.com https://browser.sentry-cdn.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https://avatars.githubusercontent.com data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.posthog.com https://*.sentry.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

export async function middleware(req: NextRequest) {
  const res = await updateSession(req)              // refresh Supabase session cookie
  res.headers.set('Content-Security-Policy', CSP)
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // route-scoped rate limiting (Phase 9 had a TODO)
  // ... apply 60/min/IP token bucket for /[username] and /api/og/*
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

The rate limiter uses `@vercel/kv` if `KV_REST_API_URL` is configured; otherwise an in-memory map (acceptable for MVP; document the limitation in code).

### 4. Error pages

`app/error.tsx` (client error boundary):

```tsx
'use client'
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
export default function GlobalErrorBoundary({ error, reset }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  return (
    <main>
      <h1>This part of the map is uncharted.</h1>
      <p>An unexpected error occurred. We've been notified.</p>
      <button onClick={() => reset()}>Try again</button>
    </main>
  )
}
```

`app/not-found.tsx`:

```tsx
export default function NotFound() {
  return (
    <main>
      <h1>This land doesn't exist yet.</h1>
      <a href="/">Return home</a>
    </main>
  )
}
```

`app/global-error.tsx` — variant of `error.tsx` used outside the root layout (per Next.js convention).

### 5. Landing page (final)

Replace the Phase 1 placeholder `app/page.tsx` with the production landing:

```tsx
import { LandingDemo } from '@/app/_components/LandingDemo'
import { SignInButton } from '@/app/_components/SignInButton'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <section className="grow flex items-center justify-center">
        <div className="text-center max-w-xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-semibold">Turn your GitHub into a developer world map.</h1>
          <p className="mt-4 text-base text-neutral-400">A living world that grows as you code.</p>
          <div className="mt-8">
            <SignInButton />
          </div>
        </div>
      </section>
      <section className="h-[50vh]">
        <LandingDemo />
      </section>
      <footer className="py-6 text-xs text-neutral-500 flex justify-center gap-4">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="https://github.com/...">GitHub</a>
      </footer>
    </main>
  )
}
```

`app/_components/LandingDemo.tsx` — renders `LivingMap` with procedurally generated mock data (different seed each page load, but deterministic within a load). Subtle ambient animation: islands gently pulse via Framer Motion `animate={{ scale: [1, 1.01, 1] }}` with long durations.

`app/_components/SignInButton.tsx` — calls `supabase.auth.signInWithOAuth(...)` from Phase 3, fires `oauth.clicked` PostHog event.

### 6. Privacy and Terms

`app/privacy/page.tsx` and `app/terms/page.tsx` — self-written drafts per ADR-25. Required sections:

**Privacy:**

- What we collect (GitHub identity from OAuth, public commit/PR/issue metadata, file paths, email)
- What we do NOT collect (commit messages, diffs, PR titles/bodies, private repo data)
- Sub-processors named (Supabase, Vercel, Inngest, Resend, Sentry, PostHog)
- Cookies (Supabase essential only; PostHog disables session recording; Vercel Analytics is cookieless)
- Data deletion (cascade on account delete)
- Retention (lifetime of account)
- Contact

**Terms:**

- Service description, GitHub data usage scope (no resale, no bulk export, used within user consent)
- Acceptable use, no scraping, no impersonation
- Account termination
- Liability disclaimer (provided as-is, no warranty)
- Governing law placeholder
- Contact

Plain prose, ~300-500 words each. English. Include a "Last updated" date.

### 7. E2E smoke test

`tests/e2e/signup-to-reveal.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('signup → repo selection → reveal complete', async ({ page }) => {
  // 1. Navigate to baseURL (preview deploy)
  // 2. Mock GitHub OAuth (or use a test GitHub account; for MVP, mock)
  // 3. Complete OAuth flow
  // 4. Land on /onboarding/repos, click "Skip & Build"
  // 5. Land on /, wait for reveal complete (assert glow/badge or that the bottom-left text disappears)
  // 6. Assert all 6 territories rendered with stable labels
})
```

Because real OAuth and real Inngest aren't available in CI for MVP, this test runs against a preview deploy with `PLAYWRIGHT_USE_MOCK_OAUTH=1` (which the app honors only in non-prod). Add a minimal mock route `app/api/test/mock-oauth/route.ts` that is enabled only when `process.env.NODE_ENV !== 'production' && process.env.ALLOW_MOCK_OAUTH === '1'`. This route creates a fake session for a hardcoded test user.

Document in `package.json`:

```json
"e2e:local": "PLAYWRIGHT_USE_MOCK_OAUTH=1 ALLOW_MOCK_OAUTH=1 playwright test"
```

### 8. README update

Update root `README.md` to add a "Running locally" section and a "Deploying to production" section. Reference `/docs/dev-setup.md` for env vars.

### 9. Polish & sweep

- Verify every file under `lib/db/`, `lib/github/`, `lib/email/`, `features/sync/`, `features/recap/`, `features/territories/rules.ts` starts with `import 'server-only'`.
- Verify ESLint passes with no warnings.
- Verify TypeScript `--strict` passes.
- Run all unit and integration tests to confirm nothing regressed.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm run build
npm test
test -f app/privacy/page.tsx && test -f app/terms/page.tsx
test -f sentry.client.config.ts && test -f sentry.server.config.ts
grep -q "Content-Security-Policy" middleware.ts
grep -q "frame-ancestors 'none'" middleware.ts
grep -q "sendDefaultPii: false" sentry.server.config.ts
grep -rn "import 'server-only'" lib features | wc -l | awk '{ if ($1 < 10) exit 1 }'
```

## How to verify AC

Run the AC commands. All unit and integration tests must pass. Build must succeed.

E2E (`npm run e2e:local`) is not part of automated AC because it requires a running dev server. Document its passing manually in `tasks/0-mvp/phase12-output.json` if you ran it.

If all pass, set this phase's status to `"completed"` in `/tasks/0-mvp/index.json`. If you cannot make AC pass after 3 attempts, set status to `"error"`.

## Notes

- Do NOT install heavy A/B testing or feature-flag infrastructure (ADR-18 says deferred). PostHog client SDK is loaded; the flag features are simply not used.
- Do NOT enable Sentry session replay in MVP. Disable explicitly.
- Mock OAuth route MUST be gated by `NODE_ENV !== 'production' && ALLOW_MOCK_OAUTH === '1'`. Both conditions. Anything less is a security hole.
- Privacy and Terms drafts are starting points. They live in code; future updates are PRs.
- Do NOT add a cookie consent banner — Supabase essential cookies are exempt and Vercel Analytics is cookieless. State this in Privacy.
- After this phase, the MVP is feature-complete. D0 setup (real GitHub OAuth App, real Supabase projects, DNS records, etc.) is the founder's responsibility per `/docs/operations.md` references (or memory). The codebase is ready to deploy once env vars are populated.
- All copy in English.
