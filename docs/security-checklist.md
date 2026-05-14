# Security Checklist — DevAstra

**Scope of this doc:** pre-launch security verification items. Each item references the ADR that established it and the implementation site that must implement it. Run through this checklist before public launch; re-verify after any architectural change.

This is a working checklist — items move from `[ ]` to `[x]` as they are verified, not as they are merely planned.

## Critical (launch blockers)

These MUST be verified before any production deployment.

### 1. Test / mock routes are NODE_ENV-guarded [x]
- **Reference:** ADR-47
- **Verify:** `app/api/test/mock-oauth/route.ts` (and any sibling test routes) begin with `if (process.env.NODE_ENV === 'production') notFound()` as the first executable line. Production deploy returns 404 from these routes (manual curl test).
- **Why it matters:** A leaked mock-OAuth route allows arbitrary user impersonation.
- **Status:** `[x] guarded in app/api/test/mock-oauth/route.ts:12`

### 2. Resend webhook signature verification [x]
- **Reference:** ADR-6 (Resend), ADR-49 (security baseline)
- **Verify:** `app/api/webhooks/resend/route.ts` validates the `svix-signature` header (or Resend's equivalent) against `RESEND_WEBHOOK_SECRET` before processing the bounce event. Reject 401 on missing/invalid signature.
- **Why it matters:** Unverified webhooks let attackers force `users.email_recap_enabled = false` for any user.
- **Status:** `[x] svix verification in app/api/webhooks/resend/route.ts`

### 3. OAuth callback origin allowlist [x]
- **Reference:** ADR-47
- **Verify:** `lib/auth/actions.ts` `signIn()` constructs `redirectTo` from a hardcoded `APP_HOSTNAME_ALLOWLIST` env var. `host` header is not blindly trusted. Dev hostnames (`localhost:3000`) are allowed only when `NODE_ENV !== 'production'`.
- **Why it matters:** A controlled `Host` header can redirect GitHub OAuth callback to an attacker domain, stealing tokens.
- **Status:** `[x] APP_HOSTNAME_ALLOWLIST in lib/auth/actions.ts pickOrigin`

### 4. CSP `'unsafe-eval'` removed in production [x]
- **Reference:** ADR-49
- **Verify:** `middleware.ts` CSP header includes `'unsafe-eval'` only when `NODE_ENV !== 'production'`. Production response includes the stricter CSP (verify via curl).
- **Why it matters:** `'unsafe-eval'` is an XSS amplifier and is not required by Next.js in production.
- **Status:** `[x] removed in production in middleware.ts`

### 5. Sentry `beforeSend` automatic PII scrub [x]
- **Reference:** ADR-49
- **Verify:** `lib/sentry.config.ts` defines `beforeSend` hook that strips `authorization` headers, `cookie` headers, and token-like patterns (`gho_*`, `ghu_*`, `ghs_*`, `Bearer *`) from breadcrumbs and exception messages. Unit test covers the scrubbing.
- **Why it matters:** GitHub tokens / session cookies appearing in Sentry events are a credential leak vector.
- **Status:** `[x] lib/sentry-scrub.ts shared module; beforeSend in all three sentry.*.config.ts files; tests/unit/sentry-scrub.test.ts`

### 6. PostHog cookieless mode + URL masking [x]
- **Reference:** ADR-49, ADR-60
- **Verify:** `lib/posthog.ts` initialization uses cookieless config (no `disable_cookie: false`). URL capture masks `/{username}` paths to `/[username]`. Form input masking enabled (`mask_all_text: true` or equivalent). `display_username` is not sent as an event property.
- **Why it matters:** PII (username) ending up in analytics events without lawful basis is a GDPR issue.
- **Status:** `[x] lib/posthog.ts disable_cookie + persistence=memory + sanitize_properties; tests/unit/posthog-sanitize.test.ts`

### 7. `postgres-js` driver `prepare: false` for pooler [x]
- **Reference:** ADR-51
- **Verify:** `lib/db/client.ts` instantiates `postgres()` with `{ prepare: false }`. `DATABASE_URL` points to the transaction-mode pooler (port 6543).
- **Why it matters:** Prepared statements with transaction-mode pooler cause errors that look like data corruption.
- **Status:** `[x] verified in Phase 1; lib/db/client.ts`

### 8. Drizzle queries use `withUserScope` helper [x]
- **Reference:** ADR-46
- **Verify:** `lib/db/queries/_helpers.ts` exports `withUserScope(userId)`. All queries against `activities`, `territories`, `landmarks`, `email_sends`, `weekly_recaps`, `misclassification_feedback`, `sync_jobs` use this helper. Grep for direct table access without `user_id =` clause.
- **Why it matters:** Drizzle bypasses RLS; forgotten user_id filter is a cross-user data leak.
- **Status:** `[x] introduced in Phase 1; lib/db/queries/_helpers.ts`

### 9. Unsubscribe token version claim [x]
- **Reference:** ADR-45, ADR-48
- **Verify:** `lib/email/unsubscribe-token.ts` includes `version` claim in JWT payload. Server verifies against `UNSUBSCRIBE_TOKEN_VERSION` env var. Mismatch returns the expired-link page (M4.2).
- **Why it matters:** Permanent tokens without revocation mechanism are a single point of failure if signing secret leaks.
- **Status:** `[x] Phase 2 lib/email/unsubscribe-token.ts`

### 10. Misclassification feedback rate limit [x]
- **Reference:** ADR-40
- **Verify:** `features/feedback/misclassification.ts` Server Action checks the user's 24h feedback count before INSERT. Limit: 5 per `user_id` per 24h. Inline UI error on limit hit.
- **Why it matters:** Without rate limit, a user (or bot) can DB-spam misclassification rows.
- **Status:** `[x] Phase 4 features/feedback/misclassification.ts`

## High priority (before broader launch)

### 11. Inngest webhook signature
- **Reference:** ADR-5
- **Verify:** `app/api/inngest/route.ts` uses Inngest SDK's built-in signature verification (`INNGEST_SIGNING_KEY`). No custom handler bypasses it.
- **Status:** `[ ]`

### 12. Vercel hard budget cap
- **Reference:** ADR-65 (`docs/adr.md`)
- **Verify:** Vercel project settings have a $200 hard cap configured. Email alerts at $100 and $150 are enabled.
- **Why it matters:** A DDoS or runaway loop can cost thousands of dollars without a cap.
- **Status:** `[ ]`

### 13. Supabase RLS isolation test passes
- **Reference:** ADR-3, ADR-21
- **Verify:** `tests/integration/rls-isolation.test.ts` passes against a real Supabase dev project. Asserts that user A cannot SELECT user B's private rows from `activities`, `territories`, `landmarks`, `email_sends`, `weekly_recaps`, `sync_jobs`.
- **Status:** `[ ]`

### 14. GitHub OAuth scope minimization
- **Reference:** ADR-11
- **Verify:** `lib/auth/actions.ts` requests only `read:user user:email` scopes. No `public_repo`, no `repo`.
- **Why it matters:** Defense-in-depth against accidentally pulling private repo data.
- **Status:** `[ ]`

### 15. `MVP_INCLUDE_PRIVATE = false` is hardcoded
- **Reference:** ADR-11
- **Verify:** `features/sync/sources/github.ts` exports `const MVP_INCLUDE_PRIVATE = false`. All repo and activity queries filter on this constant. Grep confirms no overrides.
- **Status:** `[ ]`

### 16. Supabase Vault key provisioned
- **Reference:** ADR-10
- **Verify:** `devastra_token_encryption_key` exists in Supabase Vault. `lib/db/encryption.ts` successfully encrypts/decrypts a test value via the key.
- **Status:** `[ ]`

### 17. CSP headers verified in production
- **Reference:** ADR-49, middleware.ts
- **Verify:** `curl -I https://devastra.app` returns the `Content-Security-Policy` header with no `'unsafe-eval'`. Also `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Status:** `[ ]`

### 18. Initial sync historical cap
- **Reference:** ADR-50
- **Verify:** `features/sync/initial.ts` only fetches activities with `occurred_at > NOW() - 1 year`. Manual test with a deep-history GitHub account confirms older activity is not pulled.
- **Status:** `[ ]`

### 19. UptimeRobot `/api/health` probe
- **Reference:** ADR-53
- **Verify:** `/api/health` returns 200 with a simple DB ping. UptimeRobot monitor is configured against production URL. Alert routes to founder email.
- **Status:** `[ ]`

### 20. PostHog funnel events firing in production
- **Reference:** ADR-18, ADR-53
- **Verify:** Test signup → PostHog dashboard shows `landing_view`, `oauth_click`, `repo_select_complete`, `first_reveal_complete`. Other events fire on subsequent actions (`share_click`, `public_toggle_on`).
- **Status:** `[ ]`

## Medium priority (post-launch monitoring)

### 21. Vercel Speed Insights — Web Vitals tracking [x]
- **Reference:** ADR-58
- **Verify:** Speed Insights dashboard shows LCP, CLS, INP for landing and main constellation pages. Targets: LCP <2.5s, CLS <0.1, INP <200ms.
- **Status:** `[x] Speed Insights wired in Phase 10; targets verified via Vercel dashboard`

### 22. Privacy Policy sub-processor disclosure complete [x]
- **Reference:** ADR-25, ADR-60
- **Verify:** `docs/legal/privacy.md` (rendered at `/privacy`) lists: Supabase, Vercel, Inngest, Resend, Sentry, PostHog, GitHub. Each with a one-line purpose.
- **Status:** `[x] docs/legal/privacy.md sub-processor table verified in Phase 9`

### 23. Sitemap + robots.txt [x]
- **Reference:** ADR-59
- **Verify:** `https://devastra.app/sitemap.xml` returns landing, privacy, terms, and all public users (`is_public = true`). `https://devastra.app/robots.txt` allows main search bots.
- **Status:** `[x] app/sitemap.ts and app/robots.ts implemented in Phase 9`

### 24. JS bundle size budget [x]
- **Reference:** ADR-58
- **Verify:** Initial JS for landing < 250KB gzipped. Use `next build` analyzer report.
- **Status:** `[x] next build analyzer confirms initial JS under 250KB gzipped`

### 25. Reduced-motion preference respected [x]
- **Reference:** ADR-54
- **Verify:** Browser with `prefers-reduced-motion: reduce` set → first-time reveal, first-ever cinematic, stage-up ripple all snap to final state instantly. Spark/glow/pulse animations disabled.
- **Status:** `[x] useReducedMotion() checks in all motion components; Phase 11 audit complete`

### 26. Cluster keyboard nav and screen reader summary [x]
- **Reference:** ADR-54
- **Verify:** Tab key cycles through lit cluster labels. Enter opens drawer. Screen reader on landing reads: "Founder's constellation, N stars lit across M clusters." On owner main page: "Your constellation has X stars lit across Y clusters."
- **Status:** `[x] Cluster.tsx <g role="button" tabIndex={0}>; sr-only summary in _map-container.tsx and [username]/page.tsx`

### 27. Color contrast WCAG AA [x]
- **Reference:** ADR-54
- **Verify:** Run a contrast checker against cluster label text on dim sky background. Target: 4.5:1 for body text, 3:1 for icons/star colors.
- **Status:** `[x] Cluster label #94a3b8 on #0b1020 ≈ 5.8:1 (passes AA). Star fill colors are decorative icons (≥3:1 acceptable).`

### 28. Misclassification feedback table is INSERT-only for self [x]
- **Reference:** ADR-40
- **Verify:** RLS test: user can INSERT into `misclassification_feedback`. User cannot SELECT their own rows back. Service role can SELECT all rows.
- **Status:** `[x] RLS policy verified; integration tests added in Phase 11`

### 29. Username history redirect resolves [x]
- **Reference:** ADR-30
- **Verify:** Change a test user's username from `old` to `new`. Navigate to `/old` → 301 redirect to `/new`. The new URL is canonical via `<link rel="canonical">`.
- **Status:** `[x] lib/utils/username-redirect.ts + [username]/page.tsx permanentRedirect; canonical meta tag set`

### 30. OG cache version bump invalidates correctly [x]
- **Reference:** ADR-7 (amended), ADR-52
- **Verify:** Bump `OG_RENDER_VERSION` constant. Redeploy. New profile/recap OG URLs include the new version. Old version URLs continue serving cached (acceptable) until natural expiry.
- **Status:** `[x] lib/og/version.ts OG_RENDER_VERSION constant; ogVersionParam() appended to all OG URLs`

## Backlog

### 31. Distributed rate limiting via Vercel KV
- **Reference:** middleware.ts (in-memory acknowledgment)
- **Trigger:** When unique IP / minute approaches Vercel function instance count × 60.
- **Action:** Replace `rateLimitMap` with Vercel KV (`@vercel/kv`) or Upstash Redis.
- **Status:** `[ ]`

### 32. Resend Pro upgrade
- **Reference:** ADR-6
- **Trigger:** Weekly recap users approach 750 (3000 emails/month threshold).
- **Action:** Upgrade to Pro $20/month.
- **Status:** `[ ]`

### 33. Inngest Pro upgrade
- **Reference:** ADR-5
- **Trigger:** Monthly step runs approach 25k.
- **Action:** Upgrade to Pro $20/month.
- **Status:** `[ ]`

### 34. Supabase Pro upgrade
- **Reference:** ADR-3
- **Trigger:** DB > 500MB OR MAU > 50k OR PITR needed for compliance.
- **Action:** Upgrade to Pro $25/month.
- **Status:** `[ ]`

### 35. GitHub App migration for higher rate limits
- **Reference:** ADR-50
- **Trigger:** Aggregate GitHub API usage exceeds 80% of total per-user quota.
- **Action:** Migrate to GitHub App installation (15k/hr/installation).
- **Status:** `[ ]`

### 36. Activities table archive / partitioning
- **Reference:** ADR-9, `docs/data-schema.md`
- **Trigger:** `activities` table > 50M rows.
- **Action:** Partition by `created_at` quarter, or archive >24-month rows to cold storage.
- **Status:** `[ ]`

### 37. Data export script
- **Reference:** ADR-60
- **Trigger:** First user requests data export via `privacy@devastra.app`.
- **Action:** Write `scripts/export-user-data.ts` producing a JSON zip of all user-scoped rows.
- **Status:** `[ ]`

### 38. Vault key rotation procedure
- **Reference:** ADR-10
- **Trigger:** Annual rotation policy OR incident.
- **Action:** Document and execute rotation: provision new key → re-encrypt tokens batch → retire old key.
- **Status:** `[ ]`
