# Phase 10: Security Hardening + Observability

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/security-checklist.md` (38 items — Phase 10 verifies items 1-10 and configures observability)
- `/docs/adr.md` ADR-18 (PostHog) · ADR-46 (RLS bypass policy) · ADR-47 (mock route + origin allowlist) · ADR-48 (token versioning) · ADR-49 (Sentry scrub) · ADR-52 (OG version) · ADR-53 (observability) · ADR-58 (Web Vitals) · ADR-60 (privacy compliance)
- `/docs/dev-setup.md` §env vars (APP_HOSTNAME_ALLOWLIST, etc.)
- `/CLAUDE.md` §Test/mock route guards
- `/tasks/1-pivot-mvp/docs-diff.md`

Then verify Phase 9's output:

- OG / landing / legal / error pages exist
- `npm run build` passes
- `@vercel/og` rendering works

Read the existing code:

- `middleware.ts` (CSP, rate limit, session refresh)
- `lib/auth/actions.ts` (`signIn` — OAuth flow)
- `lib/sentry.config.ts` (or `sentry.client.config.ts`, `sentry.server.config.ts`)
- `lib/posthog.ts`
- `app/api/test/mock-oauth/route.ts`
- `app/api/webhooks/resend/route.ts`

Carefully read the code from previous phases. Understand the design intent before working.

## Work

Tighten security controls, add Sentry/PostHog/Vercel observability hooks, ensure no production deploy exposes test routes.

### 1. Mock OAuth route — production guard (ADR-47)

`app/api/test/mock-oauth/route.ts` — first executable lines:

```ts
import { notFound } from 'next/navigation'
if (process.env.NODE_ENV === 'production') notFound()

// ... rest of the existing mock OAuth logic ...
```

Apply the same guard to any other `app/api/test/*` route.

### 2. Resend webhook signature verification

`app/api/webhooks/resend/route.ts`:

Resend signs webhooks via the `svix-signature`, `svix-id`, and `svix-timestamp` headers. Verify using the `svix` library or compute HMAC-SHA256 directly with `RESEND_WEBHOOK_SECRET`.

```ts
import { Webhook } from 'svix'  // npm install svix
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ ok: false, reason: 'no_secret' }, { status: 500 })

  const body = await req.text()
  const headers = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  }

  let payload: any
  try {
    const wh = new Webhook(secret)
    payload = wh.verify(body, headers)
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_signature' }, { status: 401 })
  }

  // Handle the verified event (bounce / complaint / etc.) — update email_sends.bounced and decrement strikes.
  // After 3 consecutive bounces for one user, set users.email_recap_enabled = false (ADR-6).
  // ... existing logic, with the input now safely typed from the verified payload ...

  return NextResponse.json({ ok: true })
}
```

If `svix` is not installed, add it. Alternative: roll a custom HMAC SHA256 verifier; the `svix` SDK is the safer default.

### 3. OAuth origin allowlist (ADR-47)

`lib/auth/actions.ts`:

```ts
'use server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/auth/supabase-server'

const ALLOWED_HOSTS: ReadonlySet<string> = new Set(
  (process.env.APP_HOSTNAME_ALLOWLIST ?? 'localhost:3000').split(',').map((s) => s.trim()),
)

function pickOrigin(): string {
  const h = headers()
  // Prefer the Origin header (set by browser; trustworthy).
  const origin = h.get('origin')
  if (origin) {
    const url = new URL(origin)
    if (ALLOWED_HOSTS.has(url.host)) return origin
  }
  // Fallback: synthesize from x-forwarded-host or host, but only if allowlisted.
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  if (!ALLOWED_HOSTS.has(host)) throw new Error('Disallowed host in OAuth callback origin')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

export async function signIn() {
  let origin: string
  try {
    origin = pickOrigin()
  } catch {
    redirect('/?auth_error=disallowed_host')
  }
  const supabase = createServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      scopes: 'read:user user:email',
      redirectTo: `${origin}/auth/callback`,
    },
  })
  if (error || !data.url) redirect('/?auth_error=oauth_failed')
  redirect(data.url)
}

export async function signOut() {
  const supabase = createServerClient()
  await supabase.auth.signOut()
  redirect('/?signed_out=true')
}
```

### 4. CSP — remove `'unsafe-eval'` in production

`middleware.ts`:

```ts
const CSP_PARTS = [
  "default-src 'self'",
  // 'unsafe-inline' kept for Next.js inline script bootstrap; nonce-based CSP is a post-launch upgrade.
  // 'unsafe-eval' is required by Next.js in dev mode for HMR but NOT in production.
  process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline' https://*.posthog.com https://browser.sentry-cdn.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.posthog.com https://browser.sentry-cdn.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https://avatars.githubusercontent.com data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.posthog.com https://*.sentry.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]
const CSP = CSP_PARTS.join('; ')
```

### 5. Sentry `beforeSend` PII scrub (ADR-49)

`lib/sentry.config.ts` (or `sentry.client.config.ts`, `sentry.server.config.ts`):

```ts
import * as Sentry from '@sentry/nextjs'

const TOKEN_PATTERN = /\b(?:gho_|ghu_|ghs_|github_pat_|Bearer\s+)[A-Za-z0-9_]{8,}\b/g
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-resend-signature', 'svix-signature']

function scrubString(s: string | undefined): string | undefined {
  if (!s) return s
  return s.replace(TOKEN_PATTERN, '[REDACTED]')
}

function scrubHeaders(h: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!h) return h
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(h)) {
    if (SENSITIVE_HEADERS.includes(k.toLowerCase())) out[k] = '[REDACTED]'
    else out[k] = typeof v === 'string' ? scrubString(v) : v
  }
  return out
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.request) {
      event.request.headers = scrubHeaders(event.request.headers)
      event.request.cookies = undefined
      if (typeof event.request.data === 'string') event.request.data = scrubString(event.request.data)
    }
    if (event.message) event.message = scrubString(event.message) ?? event.message
    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (ex.value) ex.value = scrubString(ex.value)
      }
    }
    if (event.breadcrumbs) {
      for (const bc of event.breadcrumbs) {
        if (bc.message) bc.message = scrubString(bc.message)
        if (bc.data) {
          for (const k of Object.keys(bc.data)) {
            const v = bc.data[k]
            if (typeof v === 'string') bc.data[k] = scrubString(v)
          }
        }
      }
    }
    return event
  },
})
```

Apply both client and server configs (Next.js Sentry SDK uses three files in the project root: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`).

Add a unit test for the scrubbing logic: `tests/unit/sentry-scrub.test.ts`.

### 6. PostHog cookieless + URL masking (ADR-60)

`lib/posthog.ts`:

```ts
'use client'
import posthog from 'posthog-js'

let inited = false

export function initPosthog() {
  if (inited) return
  if (typeof window === 'undefined') return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    persistence: 'memory',           // cookieless mode
    disable_cookie: true,             // explicit
    mask_all_text: false,             // we still want event text; user PII handled via URL masking
    autocapture: true,
    capture_pageview: false,          // we'll capture pageviews manually with URL sanitization
    sanitize_properties: (properties, _eventName) => {
      // Strip username from URLs: /{username} → /[username]
      if (typeof properties.$current_url === 'string') {
        properties.$current_url = sanitizeUrl(properties.$current_url)
      }
      if (typeof properties.$pathname === 'string') {
        properties.$pathname = sanitizePath(properties.$pathname)
      }
      // Never send display_username
      delete properties.display_username
      return properties
    },
  })
  inited = true
}

function sanitizePath(pathname: string): string {
  // /alice → /[username]
  // /alice/anything → /[username]/anything (unlikely, but defensive)
  // Known system paths preserved
  if (
    pathname === '/' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/unsubscribe') ||
    pathname.startsWith('/account-deleted') ||
    pathname.startsWith('/rate-limited') ||
    pathname.startsWith('/_next')
  ) {
    return pathname
  }
  // Top-level /{username}
  if (/^\/[a-z0-9-_]+$/.test(pathname)) return '/[username]'
  return pathname
}

function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.pathname = sanitizePath(u.pathname)
    return u.toString()
  } catch {
    return url
  }
}

export function capture(event: string, properties?: Record<string, any>) {
  if (!inited) return
  posthog.capture(event, properties)
}
```

Wire `initPosthog()` into a client-only component in the root layout. The 6 core events are dispatched from each surface:

- `landing_view` — on landing page mount.
- `oauth_click` — on Sign in with GitHub button click.
- `repo_select_complete` — on "Build my constellation" submit.
- `first_reveal_complete` — when FirstTimeReveal calls onComplete.
- `share_click` — on any share target button (Twitter/LinkedIn/Copy/Download).
- `public_toggle_on` — when public profile is toggled ON.

Add `app/_components/PosthogIdentifier.tsx` (or update existing) to identify the authenticated user via `posthog.identify(user.id)` — using the UUID, never the username.

### 7. Vercel Speed Insights (ADR-58)

```bash
npm install @vercel/speed-insights
```

In `app/layout.tsx`:

```tsx
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
```

### 8. `/api/health` endpoint (built in Phase 9 — verify here it works)

Smoke test via curl in the AC. UptimeRobot configuration is an ops task outside this repo.

### 9. Security checklist progress

Mark items 1-10 from `docs/security-checklist.md` as verified in this phase. Update each item's status from `[ ]` to `[x]` with a one-line note about where verification happened.

Open `docs/security-checklist.md` and edit items 1-10:

- 1. Mock OAuth route — `[x] guarded in app/api/test/mock-oauth/route.ts:1`
- 2. Resend webhook signature — `[x] svix verification in app/api/webhooks/resend/route.ts`
- 3. OAuth callback origin allowlist — `[x] APP_HOSTNAME_ALLOWLIST in lib/auth/actions.ts pickOrigin`
- 4. CSP unsafe-eval — `[x] removed in production in middleware.ts`
- 5. Sentry beforeSend — `[x] lib/sentry.config.ts (+ client/server/edge) scrubs tokens and sensitive headers`
- 6. PostHog cookieless + URL masking — `[x] lib/posthog.ts disable_cookie + sanitize_properties`
- 7. postgres-js prepare: false — `[x] verified in Phase 1; lib/db/client.ts`
- 8. withUserScope helper — `[x] introduced in Phase 1; lib/db/queries/_helpers.ts`
- 9. Unsubscribe token version claim — `[x] Phase 2 lib/email/unsubscribe-token.ts`
- 10. Misclassification feedback rate limit — `[x] Phase 4 features/feedback/misclassification.ts`

### 10. Tests

- `tests/unit/sentry-scrub.test.ts` — verify scrubbing strips tokens and sensitive headers.
- `tests/unit/posthog-sanitize.test.ts` — verify `sanitizePath` masks `/alice` to `/[username]` and preserves system paths.
- `tests/unit/origin-allowlist.test.ts` — verify `pickOrigin` rejects disallowed hosts.

## Acceptance Criteria

```bash
# Build cleanly
npm run build

# Unit tests pass
npx vitest run tests/unit

# Mock OAuth route is guarded
grep -n "process.env.NODE_ENV === 'production'" app/api/test/mock-oauth/route.ts

# Resend webhook verifies svix signature
grep -n "Webhook\|svix" app/api/webhooks/resend/route.ts

# Origin allowlist exists
grep -n "APP_HOSTNAME_ALLOWLIST" lib/auth/actions.ts

# CSP production branch removes unsafe-eval
grep -n "NODE_ENV === 'production'" middleware.ts | head -1

# Sentry config has beforeSend with token scrubbing
grep -rn "TOKEN_PATTERN\|beforeSend" sentry.client.config.ts sentry.server.config.ts sentry.edge.config.ts 2>/dev/null | head -3

# PostHog cookieless mode
grep -n "disable_cookie: true" lib/posthog.ts

# Health endpoint returns 200 (requires dev server running — optional)
# curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health

# Security checklist 1-10 marked done
grep -c '^### .* \[x\]' docs/security-checklist.md | xargs -I{} test {} -ge 10
```

## How to verify AC

Run the AC commands above. If all pass, set the phase 10 status to `"completed"` in `/tasks/1-pivot-mvp/index.json`.
If you cannot make them pass after 3 attempts, set status to `"error"` and write the error in the phase's `"error_message"` field in index.json.

## Notes

- **CSP `'unsafe-inline'` is retained.** Removing it requires nonce-based CSP across all inline scripts and is post-launch (ADR-49).
- **`svix` dependency**: install via `npm install svix`. It is small and well-maintained.
- **PostHog identify(user_id) uses the UUID**, not the username. Funnel events with anonymous users get a session id automatically.
- **Sentry has three config files** in the project root for Next.js. All three must include the `beforeSend` hook. A small shared helper module (e.g. `lib/sentry-scrub.ts`) avoids duplication.
- **Vercel Speed Insights is opt-out**: shipped via the `<SpeedInsights />` component in the root layout. No extra config required.
- **Do not add a status page in this phase.** Per `docs/prd.md` out-of-scope, ops handles incidents manually via the system_messages banner (Phase 5).
- **Do not add cookie consent banner.** PostHog cookieless mode + ADR-60 explicitly avoids this.
- **`/api/health` is intentionally tiny**: DB ping + 200. UptimeRobot setup is an ops step outside the code.
- **Update `docs/security-checklist.md`** items 1-10 status. This is a doc edit, not a code-side change, but it lives in the same phase per `docs/code-architecture.md` discipline.
