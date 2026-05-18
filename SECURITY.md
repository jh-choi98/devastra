# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities **privately** before any public disclosure.

**Preferred channel:** open a [GitHub Security Advisory](https://github.com/devastra/devastra/security/advisories/new) on this repository. This lets us coordinate a fix and a disclosure timeline.

**Alternative:** email **security@devastra.app**. Please include:

- A description of the issue.
- Steps to reproduce.
- The affected component (`app/`, `lib/`, `features/`, schema, dependency, etc.).
- Your assessment of impact (information disclosure, account takeover, privilege escalation, etc.).
- Whether the issue has been disclosed elsewhere.

We will acknowledge receipt within **72 hours** and aim to provide a substantive response within **7 days**.

## Disclosure timeline

Once we have confirmed and reproduced the issue:

- We will provide a target fix date.
- We will coordinate with you on a public disclosure date, typically **90 days** after the initial report, or sooner if a fix is deployed earlier.
- We will credit you in the advisory when we publish (or remain anonymous on request).

## What is in scope

- Authentication and session handling (`lib/auth/`, OAuth flow).
- Authorization (RLS policies in `drizzle/migrations/`, `withUserScope` helper in `lib/db/queries/`).
- Cross-user data leaks via API routes (`app/api/`) or server actions.
- XSS in user-controlled content (display username, public profile rendering, OG image generation).
- Open redirect via OAuth callback or any redirect handler.
- CSRF on state-changing endpoints.
- Webhook signature bypass (`/api/webhooks/resend`, `/api/inngest`).
- Token leakage (GitHub OAuth tokens, unsubscribe tokens, session cookies).
- Email injection or header injection in recap emails.
- DoS via rate-limit bypass on OG image generation or public profile pages.
- Dependency-chain vulnerabilities affecting the running service.

## What is out of scope

- Social engineering attacks against DevAstra staff.
- Physical attacks on infrastructure.
- Vulnerabilities in third-party services (Supabase, Vercel, Inngest, Resend, Sentry, PostHog, GitHub). Report those to the respective vendor.
- Self-XSS that requires the victim to execute attacker-supplied code in their own console.
- Missing CSP directives that are not exploitable.
- Lack of HTTPS on non-production preview deployments (Vercel previews use the platform's TLS).
- Best-practice recommendations without a demonstrated exploit path.

## Compensation

DevAstra is a free, pre-revenue product. We do not currently offer monetary rewards. We will publicly credit reporters in advisories upon request.

## Public commitments

We commit to:

- Not pursue legal action against good-faith researchers who follow this policy.
- Acknowledge and respond to all reports within the timelines above.
- Be transparent about the fix and disclosure timeline.
- Credit researchers who choose attribution.

## Incident response procedures

We document specific incident-response procedures in our internal runbook. Key public-facing procedures include:

- **Unsubscribe token compromise.** Bump `UNSUBSCRIBE_TOKEN_VERSION` env var → redeploy. All outstanding tokens become invalid; users receive expired-link page if they click old emails (see `docs/adr.md` ADR-48).
- **Vault key compromise.** Provision new key in Supabase Vault → batch re-encrypt all `users.github_access_token_enc` and `users.github_refresh_token_enc` with the new key → retire the old key (see `docs/adr.md` ADR-10).
- **Account takeover via leaked credentials.** Affected users are notified by email; sessions are invalidated via Supabase Auth admin API.

## Hall of Fame

(No reports yet — this section will track acknowledged researchers.)
