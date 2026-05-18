# Privacy Policy

*Last updated: 2026-05-14*

DevAstra ("we", "our", "the service") helps developers visualize their public GitHub activity as a skill constellation. This policy describes what data we collect, why we collect it, and how we handle it.

## Summary

- We only collect **public GitHub data** that you explicitly choose to include.
- We **never read private repositories.** Our OAuth scope is `read:user user:email` only.
- We **never store** commit messages, diffs, PR titles, or PR bodies. We store file paths and counts only.
- You can delete your account at any time. Deletion is immediate and permanent.
- We do not sell your data. We do not run ads.

## Data we collect

### From GitHub (after you grant OAuth)

- Your GitHub user ID, login name, email address (from the `user:email` scope), and avatar URL.
- A list of your public repositories.
- For each public repository you include: file paths changed in each commit, additions/deletions counts, PR creation timestamps, and the corresponding GitHub URL.
- The OAuth access and refresh tokens, **encrypted at rest** using a key held in Supabase Vault.

We do not collect:

- Private repository data.
- Commit messages, diffs, or PR descriptions.
- Email content beyond the address itself.
- Data from other connected GitHub accounts unless you explicitly link them (not supported in the current version).

### From your interactions with the service

- Authentication state (session cookies managed by Supabase Auth).
- Settings preferences (timezone, public-profile toggle, email-recap toggle, included-repo list).
- Hint-display state (which onboarding hints you've already seen).
- Sync state (when we last queried GitHub for your activity).

### Analytics

- We use PostHog in **cookieless mode** to track high-level funnel events (e.g. landing page view, OAuth click, first-reveal completion).
- We do not transmit your `display_username` or other PII to PostHog. URL paths matching `/{username}` are masked to `/[username]` before transmission.
- Performance metrics are collected by Vercel Speed Insights (anonymous; no personal identifiers).

### Error monitoring

- We use Sentry to capture and diagnose application errors. Sentry's `beforeSend` hook strips HTTP authorization headers, cookies, and token-like patterns before any event is sent.

## How we use your data

| Data | Purpose |
|---|---|
| GitHub user info (id, login, email, avatar) | Account identity, profile rendering, email delivery |
| Activity (file paths, counts, URLs) | Classifier input — determines which technologies you use and how often |
| OAuth tokens (encrypted) | Server-side sync execution only |
| Settings | Honor your preferences |
| Funnel events | Measure activation, share, and return rates to improve the product |

We do not:

- Sell, rent, or trade your data.
- Run advertising.
- Display your private email address on your public profile.
- Train machine-learning models on your data.

## Public profile

If you toggle **Public profile** on in Settings, your constellation becomes visible at `https://devastra.app/{username}`. The public-facing view shows:

- Your `display_username` and avatar.
- Your constellation (cluster activations, star brightness, connection lines).
- Per-star detail (technology name, contributing repository name, recent PR titles fetched on demand from GitHub).

The public view does **not** show:

- Your email address.
- Your private settings.
- Activity from repositories you've excluded.

Toggling Public off restores privacy immediately. The CDN cache for the public OG image is invalidated.

## Sub-processors

DevAstra uses the following third-party services. Each is a sub-processor under GDPR and operates under its own privacy policy.

| Service | Purpose |
|---|---|
| **Supabase** (Auth, Database, Storage, Realtime, Vault) | Identity provider, primary database, encryption key storage |
| **Vercel** | Application hosting, edge runtime, OG image generation, performance analytics |
| **Inngest** | Background job orchestration (sync, weekly recap generation, cron tasks) |
| **Resend** | Transactional email delivery (weekly recap emails) |
| **Sentry** | Error monitoring (with automatic PII scrubbing) |
| **PostHog** | Funnel analytics (cookieless mode) |
| **GitHub** | OAuth identity provider and source of activity data you authorize |

## Data retention

- Active accounts: all data is retained for the lifetime of the account.
- Deleted accounts: data is removed immediately and permanently upon delete confirmation. There is no undo window.
- Initial sync window: we fetch activity from the last 1 year of your GitHub history. Older activity is not pulled.

## Your rights

You can, at any time:

- **Toggle visibility.** Make your constellation public or private from Settings.
- **Adjust included repositories.** Choose which public repos contribute to your constellation.
- **Disconnect GitHub.** Removes the OAuth token; your constellation data is preserved for re-connection.
- **Delete your account.** All data is permanently erased.
- **Unsubscribe from emails.** One-click unsubscribe link in every recap email; no login required.
- **Request a data export.** Email `privacy@devastra.app` from your registered email address. We respond within 30 days with a JSON / CSV archive of all data we hold.

If you are in the EU/UK, you have additional rights under GDPR: access, rectification, erasure, restriction, portability, objection, and to lodge a complaint with your supervisory authority.

## Children's privacy

DevAstra is not intended for children under 13. By using GitHub OAuth, you implicitly affirm that you are at least 13 years old, since GitHub itself requires the same.

## Cookies

We use Supabase Auth session cookies for authentication. These are essential for the service and cannot be disabled. PostHog runs in cookieless mode and does not set cookies.

## Security

- OAuth tokens are encrypted at rest using a key held in Supabase Vault and never appear in plaintext outside the sync worker.
- Connections to the service are TLS only (HSTS preloaded).
- We follow defense-in-depth: Row Level Security policies, server-side input validation, automatic PII scrubbing in error monitoring, application-layer user-scoping for direct database queries.

To report a security vulnerability, see `SECURITY.md` at the root of the public repository.

## Changes to this policy

When this policy materially changes, the "Last updated" date above is bumped and a notice is shown at the top of the page for at least 30 days. Substantial changes are also announced via the weekly recap email.

## Contact

For privacy questions or requests, email **privacy@devastra.app**.
