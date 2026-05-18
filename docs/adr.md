# Architecture Decision Records — DevAstra

**Scope of this doc:** non-obvious technical and product decisions that constrain future implementation. Trivial conventions (formatter, lint rules) are not recorded here. See `docs/prd.md` for product intent, `docs/data-schema.md` for data shape, `docs/code-architecture.md` for layout.

**Naming note.** DevAtlas was renamed to DevAstra on 2026-05-14 as part of the constellation pivot (ADR-26). Historical ADRs (ADR-1 through ADR-25) were authored under the previous name; their content remains valid except where explicitly superseded.

---

## ADR-1: Living continent map over dashboards or cards

**Date:** 2026-05-13
**Status:** superseded by ADR-26 (2026-05-14)
**Context:** The product's central promise is that users _feel_ growth, not measure it. Cards or grids give the same information without the emotional payoff. A real-time analytics dashboard would invite comparison and ranking, which we explicitly reject.
**Decision:** Render the user's state as procedural SVG islands ("territories") floating on an ocean. Each island grows in size with stage and accumulates landmarks (tech-specific buildings) as the user touches new technologies. Animations on growth events ("a new district appears") are core.
**Alternatives:**

- Territory cards with growth bars — rejected: dashboard feel.
- Hex grid like Civilization — rejected: still feels like a grid; loses "world" metaphor.
- Isometric tile-based mini-world — rejected: requires custom art per tech, not procedurally generatable in MVP timeline.
  **Consequences:** Frontend complexity is concentrated in `app/_components/Map/`. Performance budget for 6-8 simultaneously animated islands. Procedural shape generation must be deterministic per user (seeded by `user_id + territory_type`) so map identity is stable across loads.

---

## ADR-2: Three-layer abstraction — Territory, Stage, Landmark

**Date:** 2026-05-13
**Status:** accepted
**Context:** Initial design conflated "growth direction" with "tech identity." This made stage thresholds also responsible for unlocking specific named districts, which (a) made each user's map look identical at the same stage and (b) tied stage tuning to content design.
**Decision:** Split into three orthogonal concepts:

- **Territory** — 6 fixed categories (growth direction). UI: "cluster" post-pivot.
- **Stage** — 5 universal size thresholds `[0, 50, 200, 500, 1500]` on `total_weight` (growth size). UI: "cluster expanded" post-pivot.
- **Landmark** — per-tech variable elements unlocked by tech-specific weight ≥ 5 (growth identity). UI: "star" post-pivot.
  **Alternatives:**
- Single "level" with hand-curated district names per `(territory, level)` — rejected: every user's map looks the same; content-design bottleneck.
- Continuous size scaling with no thresholds — rejected: no discrete "stage up" moments for retention hooks.
  **Consequences:** `territories` and `landmarks` are separate tables. Stage tuning can change without content rework. Adding new tech techs requires zero schema change. Visual rendering composes cluster identity (stage) with placed stars (count + weight).

---

## ADR-3: Supabase Auth over Auth.js

**Date:** 2026-05-13
**Status:** accepted
**Context:** Need GitHub OAuth + session management + per-row authorization on the same Postgres.
**Decision:** Use Supabase Auth as the identity provider; mirror `auth.users.id` to `public.users.id` via a trigger. Authorization enforced via Row Level Security policies referencing `auth.uid()`.
**Alternatives:**

- Auth.js (NextAuth) with Supabase adapter — rejected: more moving parts; RLS integration requires manual JWT sync; one more library to keep up to date.
- Auth.js with no Supabase — rejected: forfeits RLS; all authorization moves to app code, multiplying the surface area for leak bugs.
  **Consequences:** Tight coupling to Supabase as both identity and DB provider. RLS policies become the primary authorization mechanism — must be tested explicitly (`tests/integration/rls-isolation.test.ts`). Migrating off Supabase later would require rewriting both auth and authorization. Acceptable trade-off given MVP speed.

---

## ADR-4: Drizzle ORM over Prisma

**Date:** 2026-05-13
**Status:** accepted
**Context:** Need TypeScript-native ORM with fast cold-start on Vercel serverless.
**Decision:** Drizzle + Drizzle Kit migrations.
**Alternatives:**

- Prisma — rejected: heavy runtime, slow cold-start on serverless without Accelerate ($), schema-first DSL adds indirection.
- Supabase Client (PostgREST) — rejected: weak on joins and transactions; awkward between SQL and ORM.
- Raw `pg` — rejected: too much boilerplate for MVP velocity.
- Kysely — considered: similar to Drizzle, but Drizzle has stronger migration tooling at this point.
  **Consequences:** Schema is defined in TypeScript in `lib/db/schema/`. Queries compose with type inference but require a small learning curve. Drizzle's migration files are SQL-with-metadata; reviewable in PRs. Note: connects via transaction-mode pooler — `postgres-js` driver requires `prepare: false` (see ADR-51).

---

## ADR-5: Inngest for background jobs

**Date:** 2026-05-13
**Status:** accepted
**Context:** Need durable background jobs for sync, weekly recap generation and fan-out, and recurring crons. Vercel functions are short-lived and don't fit multi-step work.
**Decision:** Inngest for all background work. Use `step.run()` for checkpointed sub-tasks within a job (sync stages, recap fan-out per user). Multi-minute sync work must be split by external I/O boundary instead of wrapped in one parent step; Settings backfill uses separate steps for metadata refresh, manifest parsing, recent activity, historical activity, commit-detail enrichment, activity caching, and reclassification.
**Alternatives:**

- Vercel Cron + ephemeral functions — rejected: no step retries or observability; 10s/60s timeout caps initial sync of active users.
- Self-hosted queue (BullMQ, Redis) — rejected: adds Redis dependency; ops overhead.
- Trigger.dev — viable; Inngest chosen for cleaner Next.js integration and Inngest's free tier.
  **Consequences:** All sync code lives in `features/sync/runner.ts`. At-least-once delivery means every step must be idempotent (enforced via UPSERTs and unique constraints in `docs/data-schema.md`). Free tier (25k step runs/month) is exceeded around 1k users on daily incrementals; Pro ($20/month) accepted as planned cost.

---

## ADR-6: Resend for email

**Date:** 2026-05-13
**Status:** accepted
**Context:** Need transactional email with reliable deliverability and templating.
**Decision:** Resend with React Email templates colocated in `lib/email/templates/`.
**Alternatives:**

- Postmark — viable; Resend chosen for first-class React Email integration.
- SendGrid — rejected: heavier API, weaker DX.
- Self-hosted (Postal) — rejected: deliverability problem we don't want to own at MVP.
  **Consequences:** SPF/DKIM/DMARC must be configured on `devastra.app` during D0 setup. Template rendering happens server-side. 3k/month free tier is exceeded around 750 weekly users; Pro ($20/month) accepted.

---

## ADR-7: On-demand OG image generation, no Storage

**Date:** 2026-05-13
**Status:** accepted (amended 2026-05-14 — OG cache invalidation policy)
**Context:** OG images are needed for both public profile shares and weekly recap emails. The same SVG generation code that draws the live constellation should produce the static image.
**Decision:** Use `@vercel/og` at `/api/og/profile/[username]` and `/api/og/recap/[recap_id]`. Generated per request and CDN-cached. No image is persisted to storage.
**Alternatives:**

- Pre-render and store in Supabase Storage on sync completion — rejected: doubles infrastructure for marginal benefit; storage costs grow with users.
- Server-side Puppeteer screenshot — rejected: slow, expensive, brittle.
  **Consequences:** OG endpoints must be rate-limited (60/min/IP + referrer check) to avoid being a DoS vector. Recap IDs are immutable so `/api/og/recap/{id}` can be cached indefinitely. Profile OG cache is invalidated on `users.is_public` toggle and on sync completion.

**Amendment (2026-05-14):** Global renderer or product-language changes (such as the DevAtlas→DevAstra pivot) require explicit cache versioning. The constant `OG_RENDER_VERSION` lives in `lib/og/version.ts` and is appended to every OG URL as `?v=devastra-1`. Bumping this constant invalidates all cached OG images by changing the URL. Per-user revalidate triggers (sync completion, public toggle) remain. See ADR-52 for the full version-bump procedure.

---

## ADR-8: Supabase Realtime for sync progress

**Date:** 2026-05-13
**Status:** accepted
**Context:** The first reveal experience requires stars to appear as their data is processed. Polling feels lo-fi.
**Decision:** Subscribe the browser to Supabase Realtime on `territories`, `landmarks`, `sync_jobs` for the current user. As the Inngest sync job writes rows, the browser receives push updates and animates each star in.
**Alternatives:**

- 2-second polling — rejected: rough animation timing, more server load.
- Server-Sent Events from a Next.js route — rejected: Vercel function constraints for long-lived connections.
  **Consequences:** WebSocket connection cost (up to 200 concurrent on free tier). Realtime publication is selective (only the 3 tables) to bound noise. `users` is intentionally not in Realtime — hint flags + cinematic pending are read on page load (see ADR-43). Fallback to polling not implemented in MVP; if Realtime is down, reveal is delayed but final state still correct because data is in DB.

---

## ADR-9: Activities raw_data restricted to paths + stats + URL

**Date:** 2026-05-13
**Status:** accepted
**Context:** Storing GitHub data has two PII/secrets risks: (a) commit messages, diffs, or PR bodies can contain accidentally committed secrets (API keys, internal URLs); (b) breach surface is larger if we mirror more data than we need.
**Decision:** `activities.raw` JSONB stores only `file_paths`, `additions`, `deletions`, `github_url`. Never commit messages, diffs, PR titles, PR bodies. PR titles needed for the cluster drawer are fetched on-demand from GitHub at view time and cached client-side for the session.
**Alternatives:**

- Store PR titles too — rejected: low-value vs medium-risk; users sometimes put credentials in titles.
- Store everything as a cache layer — rejected: turns DevAstra into a GitHub data leak target.
  **Consequences:** Drawer pays a ~3-call GitHub API cost per open (acceptable; ~0.1% of per-user 5k/hr limit). Classifier and scoring depend only on file paths and counts, which is fine for the rule-based design. If we ever want to display commit messages, that decision is made deliberately, not accidentally inherited.

---

## ADR-10: GitHub token encryption with Supabase Vault key

**Date:** 2026-05-13
**Status:** accepted
**Context:** Tokens enable acting as the user against GitHub. They must be encrypted at rest with a key not present in the application database.
**Decision:** `users.github_access_token_enc` and `users.github_refresh_token_enc` are encrypted with pgcrypto symmetric encryption. The encryption key is stored in Supabase Vault (managed KMS) under the name `devastra_token_encryption_key`. Decryption only happens in server-side sync code.
**Alternatives:**

- Rely on Supabase Auth's `auth.identities` provider tokens — rejected: indirect access pattern, no auto-refresh policy fit.
- Vercel env var holding the key — viable but rotates harder; Vault chosen for cleaner key management.
- External KMS (AWS, GCP) — rejected: extra vendor and IAM setup for MVP.
  **Consequences:** Vault enabled as a one-time setup step. The key name is not an `.env.local` variable and should not be renamed after tokens exist without a re-encryption migration. Key rotation procedure documented but not automated for MVP.

---

## ADR-11: MVP private repo support is gated by a hardcoded constant

**Date:** 2026-05-13
**Status:** accepted
**Context:** Private repo support is explicitly out of scope (`docs/prd.md`). But the GitHub OAuth flow could grant access to them, and downstream sync code could accidentally pull them.
**Decision:** Introduce a constant `MVP_INCLUDE_PRIVATE = false` in `features/sync/sources/github.ts`. All repo and activity fetches filter on this constant. The OAuth flow requests only `read:user` + `user:email` scopes; `public_repo` is not requested.
**Alternatives:**

- Trust the OAuth scope alone — rejected: defense in depth.
- Track is_private per repo and rely on UI to hide — rejected: still in DB; if a query forgets the filter, we have private data exposed.
  **Consequences:** Removing the gate when private repos ship is a deliberate code change, not a config toggle. Forces the v0.2 PR adding private support to think through every code path.

---

## ADR-12: Cumulative growth model, no decay

**Date:** 2026-05-13
**Status:** accepted
**Context:** Two competing intuitions: (a) "living" constellations should fade if neglected; (b) portfolio value of a DevAstra requires that what's shared today is still true next month.
**Decision:** Territory and landmark weights only grow. They never decrease. "Recent activity" is signaled visually (glow, spark, "+18% this week" badge) but cumulative state is preserved.
**Alternatives:**

- Decay model with exponential or step decay — rejected: a user who shared their constellation on Twitter, then took a coding break, would feel betrayed when growth disappeared.
- Dual view (lifetime + recent) — rejected: doubles UI complexity for marginal product gain.
  **Consequences:** `territories.stage` is monotonically non-decreasing. Backfill jobs (ADR-22) preserve this invariant. Visual recency is computed from `growth_30d` and `stage_changed_at`, not from current size.

---

## ADR-13: Disconnect GitHub preserves constellation data

**Date:** 2026-05-13
**Status:** accepted
**Context:** Users who disconnect GitHub should be able to reconnect later without losing their constellation. Forcing a re-sync would re-spend rate-limit budget and lose context.
**Decision:** Disconnect sets `users.github_access_token_enc = NULL` and `users.is_public = false`. All constellation data (`activities`, `territories`, `landmarks`, `weekly_recaps`) is preserved. Re-OAuth restores sync.
**Alternatives:**

- Cascade delete on disconnect — rejected: ambiguous semantics with delete-account.
- 30-day grace period — rejected: complexity vs benefit unclear; defer to v0.2.
  **Consequences:** A "disconnected" state must be representable in UI; constellation shows last-known state with a dismissible banner. Delete-account is the explicit path for full removal.

---

## ADR-14: UTC week boundary with localized email delivery

**Date:** 2026-05-13
**Status:** accepted
**Context:** Weekly recap aggregates and `growth_30d` must agree across users and admin queries. But the email feels right when it arrives on the user's Sunday evening.
**Decision:** Storage and aggregation are entirely in UTC: `week_start = Monday 00:00 UTC`, `growth_30d` window is trailing 30 days UTC. The Sunday weekly recap generation cron runs at 09:00 UTC. Email delivery uses Inngest fan-out with a per-user delay so each user receives the email at their local Sunday 18:00.
**Alternatives:**

- Per-user week boundary (Monday in user's tz) — rejected: aggregation queries become user-aware; admin metrics fracture.
- Single-time UTC delivery for everyone — rejected: half the world receives "your week" emails at random local times.
  **Consequences:** All date arithmetic in queries is UTC. Display layer is the only place tz conversion happens. The recap email's "this week" is technically the UTC week, which may differ from the user's perceived week by up to 12 hours; this trade-off is accepted.

---

## ADR-15: Username reservation with self-match exception

**Date:** 2026-05-13
**Status:** accepted (reinforced by ADR-30 for permanent post-change reservation)
**Context:** `display_username` is unique and used as a URL path. Without reservation, users can claim `settings`, `api`, `admin`, or another user's GitHub login.
**Decision:** Maintain a list of reserved names (system paths) in `lib/utils/reserved-usernames.ts`. On username change or creation, reject if the requested name is reserved. Exception: a user may set their `display_username` to their own GitHub login even if it appears in any future reservation list (since at signup, their GitHub login is their initial username).
**Alternatives:**

- No reservation list — rejected: breaks routing.
- Reserve famous handles too (microsoft, google) — deferred to v0.2; not blocking and adds complexity.
  **Consequences:** The reservation list lives in code. Adding new system routes requires adding to this list. Post-change reservation (old username never reclaimed) is enforced via `username_history` table (ADR-30).

---

## ADR-16: Source-agnostic columns in activities and repositories

**Date:** 2026-05-13
**Status:** accepted
**Context:** GitHub is the only source in MVP. Later sources (GitLab, Bitbucket) are plausible. Renaming columns after data exists requires zero-downtime migration; renaming before data exists is free.
**Decision:** `activities.source` + `activities.external_id` and `repositories.source` + `repositories.external_repo_id`, both with `DEFAULT 'github'`. `users.github_*` retained because primary identity remains single-source for MVP.
**Alternatives:**

- Keep `github_*` everywhere — rejected: rewriting after launch is the painful path.
- Generalize `users` identity too — rejected: identity is tightly coupled to OAuth, and multi-source identity needs a different model (`account_links` table) anyway.
  **Consequences:** `SourceClient` interface in `features/sync/sources/interface.ts` formalizes the boundary. Adding a new source requires only a new `SourceClient` implementation and tech-catalog entries.

---

## ADR-17: Classifier as an interface with a single GitHub implementation

**Date:** 2026-05-13
**Status:** accepted
**Context:** Future sources may need different parsing logic (GitLab structure differs from GitHub). Hardcoding GitHub assumptions in classifier code creates the same migration problem as ADR-16.
**Decision:** Define a `Classifier` interface in `features/territories/classifier.ts` that takes an `Activity` and returns `ClassificationResult[]`. Implement `GitHubClassifier` only for MVP.
**Alternatives:**

- Single hardcoded function — rejected: same lock-in issue as not generalizing columns.
  **Consequences:** ~30 minutes of upfront work. No DB change. When GitLab support arrives, add a `GitLabClassifier` without touching existing code.

---

## ADR-18: PostHog for funnel analytics

**Date:** 2026-05-13
**Status:** accepted (cookieless mode reinforced by ADR-60)
**Context:** YC application requires concrete activation, share, return-rate numbers. Vercel Analytics gives pageviews but not multi-step funnel.
**Decision:** Install PostHog at v0.1 with product analytics + core funnel events (landing view, OAuth click, repo selection complete, first reveal complete, share click, public toggle). Session replay is limited or disabled initially. Feature flags and A/B testing deferred.
**Alternatives:**

- Custom event logging in Postgres — rejected: build a tiny ad-hoc analytics product just to compute conversion rates.
- Mixpanel, Amplitude — rejected: free tiers less generous than PostHog's 1M events/month.
  **Consequences:** `posthog-js` is included in client bundles (small); `posthog-node` used for server-side ingest. Privacy policy must disclose PostHog as a sub-processor. PostHog runs in cookieless mode to avoid GDPR cookie consent banner (ADR-60).

---

## ADR-19: Sync_jobs is a finite state machine with a 30-minute stuck-cleanup

**Date:** 2026-05-13
**Status:** accepted
**Context:** Worker crashes mid-sync leave `sync_jobs.status = 'running'` forever. Subsequent manual refresh attempts then see "in progress" indefinitely.
**Decision:** Enforce the FSM `pending → running → completed | failed` in application code. A cron runs every 5 minutes and transitions any row stuck in `'running'` for >30 minutes to `'failed'` with `error = 'timeout'`.
**Alternatives:**

- Rely on Inngest's own retry semantics — partial; Inngest retries the _step_ but the parent `sync_jobs` row may still be marked running if the job orchestration code never updates it.
- DB trigger on a heartbeat column — rejected: more complexity than scheduled cleanup.
  **Consequences:** Adds one cron job. Users who hit timeout see a banner inviting retry. Investigation of repeated timeouts surfaces via Sentry breadcrumbs.

---

## ADR-20: ISR with on-demand revalidation for public profiles

**Date:** 2026-05-13
**Status:** accepted
**Context:** Public profile pages will receive viral spikes (Twitter, LinkedIn). Hitting Supabase on every request is expensive. But fresh data after the owner pushes a commit is part of the value.
**Decision:** Render `/{username}` with ISR 1-hour revalidation. Additionally call `revalidatePath('/${username}')` on (a) sync completion, (b) public toggle, (c) username change. This bounds staleness to "1 hour unless an action invalidates sooner."
**Alternatives:**

- 24-hour ISR — rejected: too stale for users who just tweeted their constellation.
- Always-SSR — rejected: viral spike costs.
  **Consequences:** Three explicit invalidation points must be wired up in the corresponding Server Actions. If they break, staleness is capped at 1 hour anyway.

---

## ADR-21: Test coverage targets classifier and critical paths only

**Date:** 2026-05-13
**Status:** accepted (extended by ADR-58 + ADR-59 to include rendering and SEO smoke)
**Context:** Comprehensive coverage costs MVP velocity. Zero coverage is reckless. The product's correctness pivot is the classifier (if it misclassifies, every downstream feature lies).
**Decision:**

- **Unit (Vitest):** classifier rule engine, scoring formula, stage threshold calc, GitHub parser, username-redirect resolver, unsubscribe-token verifier.
- **Integration (Vitest):** initial sync (mocked GitHub API), OAuth callback flow, weekly recap generation, RLS isolation, public/private visibility, email template snapshots.
- **E2E (Playwright):** one smoke test for signup → repo selection → reveal complete; one constellation-render screenshot diff against baseline.
- Manual smoke for everything else; Sentry catches production regressions.
  **Alternatives:**
- Comprehensive E2E — rejected: 2-3 days of test infrastructure cost.
- Zero tests, manual only — rejected: classifier bugs are silent and accumulating.
  **Consequences:** Classifier correctness is the highest-priority test surface. RLS regressions are caught early. Email template + render snapshots prevent silent visual regressions. UI-only edge cases may slip but are recoverable.

---

## ADR-22: Backfill via re-run, no classifier_version column

**Date:** 2026-05-13
**Status:** accepted
**Context:** When classifier rules or the tech catalog change, existing users' constellations reflect the old rules until they re-sync. Naively, we'd version every classification, but at MVP scale this adds complexity.
**Decision:** Provide a backfill job (`features/sync/backfill.ts`) triggered via Inngest. It re-classifies all activities for a user (or globally) and re-writes `activity_territories`, `territories`, `landmarks`. No `classifier_version` column. User-triggered backfills run when the user changes repo inclusion in Settings. Settings keeps the build overlay active until saved activity, selected repo metadata, and project manifests have all been checked, so users never mistake an intermediate language-only state for the completed constellation. If the selected repos have no saved matching activity, historical GitHub bootstrap remains foreground so old-only selections do not resolve to an empty final sky. Repeated Settings backfills reuse recent commit-list results only when the current source `pushed_at` exactly matches `commits_fetched_source_pushed_at`; the marker is written after activity caching succeeds so retries cannot skip unpersisted GitHub data.
**Alternatives:**

- Versioned classification with mixed-version aggregation — rejected: YAGNI at MVP scale.
- Skip backfill entirely; new rules apply only to new activities — rejected: existing users see stale state, and rule changes are tested with cold starts.
  **Consequences:** Backfill is an admin-or-user-triggered operation. Activities table must retain enough raw data (file paths, stats) to support re-classification — this is already enforced by ADR-9.

---

## ADR-23: Hybrid `lib/` + `features/` code organization

**Date:** 2026-05-13
**Status:** accepted
**Context:** Pure layer-based (`/lib/db`, `/lib/github`, `/lib/territory`) becomes unwieldy as the project grows. Pure feature-based requires deciding upfront where shared utilities go.
**Decision:** Hybrid. `lib/` for cross-cutting utilities (db client, github client, email client, og components, auth, analytics). `features/` for domain logic (`sync/`, `territories/`, `recap/`, `feedback/`). Dependency direction is `app → features → lib`, never reverse.
**Alternatives:**

- Pure layer (`lib/*`) — rejected: domain logic gets scattered into utility folders.
- Pure feature — rejected: forces every shared utility into a feature, premature ownership decisions.
  **Consequences:** New code finds its home by asking "is this a cross-cutting tool, or does it belong to a single domain?" Tight boundary makes refactoring easier.

---

## ADR-24: Closed beta launch with 50-100 invites

**Date:** 2026-05-13
**Status:** accepted
**Context:** Public ProductHunt launch on day 1 risks a bug-amplified bad first impression and capacity surprises.
**Decision:** Closed beta for 1-2 weeks with 50-100 invited users (founder network, Twitter/Discord developer circles). Funnel measured via PostHog. Bug-fix and iteration before broader launch.
**Alternatives:**

- Public launch — rejected: high blast radius for any bug.
- Waitlist with drip — rejected: adds invite system complexity that pushes MVP timeline.
  **Consequences:** Initial usage data is biased toward the founder's network; conclusions about activation rates must account for this. Public launch is gated on meeting `docs/prd.md` success criteria.

---

## ADR-25: Self-written Privacy Policy and ToS at launch

**Date:** 2026-05-13
**Status:** accepted (sub-processor list and content reinforced by ADR-60)
**Context:** Launch requires legal docs. Lawyer review is overkill pre-revenue; paid tools (Termly, iubenda) cost $15-50/month.
**Decision:** Self-write Privacy Policy and Terms of Service for launch, sourced from `docs/legal/privacy.md` and `docs/legal/terms.md` rendered at `/privacy` and `/terms`. Migrate to a paid tool when monetization launches, sensitive data is collected, or an enterprise customer arrives.
**Alternatives:**

- Paid tool from day 1 — rejected: cost without immediate benefit.
- Lawyer review from day 1 — rejected: $500-2000 cost, premature.
  **Consequences:** Founder owns drafting. Must explicitly disclose sub-processors (Supabase, Vercel, Inngest, Resend, Sentry, PostHog, GitHub), GDPR data deletion procedure, and GitHub data usage scope (no resale, no bulk export, used within user consent). Data export request fulfilled manually within 30 days via internal script.

---

## ADR-26: Constellation visualization over 3D world map

**Date:** 2026-05-14
**Status:** accepted (supersedes ADR-1)
**Context:** The "living world map" metaphor (ADR-1) is implementable as 2D SVG but its emotional resonance is weaker than expected for the target user (students / juniors / portfolio builders). The constellation metaphor maps to identity and discovery more cleanly and produces more share-friendly artifacts (a single constellation image vs a scrolling map).
**Decision:** Pivot the product visual layer to a star-constellation metaphor while preserving the underlying data model. Six clusters (one per territory_type) form fixed nebula regions; each `tech_key` is a star with a globally fixed `(x, y)` position within its cluster; lit/unlit and brightness are user-specific; MST connection lines join lit stars within a cluster. Same `@vercel/og` renderer powers both the live app and OG images using layered concentric circles for the glow effect (satori does not support SVG `<filter>`).
**Alternatives:**

- 3D / Three.js / WebGL rendering — rejected: implementation complexity, accessibility concerns, mobile performance.
- Stay with the world-map metaphor — rejected: emotional resonance feedback from founder testing was weaker than the constellation.
- Per-user randomized star positions — rejected: comparison across public profiles becomes harder, layout shifts when new tech is added.
  **Consequences:** Existing tables (`territories`, `landmarks`) keep their names; only UI surface renames. `Map/` directory is replaced by `Constellation/` in the same PR. Tech catalog `display_name` is refreshed from architectural metaphors (e.g. "React Forge") to plain technology names (e.g. "React"). Star `{x, y}` coordinates are hand-tuned in the catalog (ADR-26 design pass). Layered-circles glow approach is used by both live app and OG renderer.

---

## ADR-27: Open-core boundary, in-monorepo, MIT extractable modules

**Date:** 2026-05-14
**Status:** accepted
**Context:** OSS posture creates marketing value (developer audience), trust, and a community contribution surface — but operating a fully self-hostable stack (Supabase, Inngest, Resend, Vercel are all SaaS dependencies) is not viable for MVP. A clear extractable boundary with MIT license signals open-source intent without committing to npm packaging or self-hostability.
**Decision:** Adopt open-core. The constellation renderer, classifier, tech catalog, scoring, rules, and registry carry `SPDX-License-Identifier: MIT` headers as the first line of the file. The rest of the codebase is proprietary (LICENSE-PROPRIETARY). No npm packages are published in MVP. Module boundaries are designed for future extraction.
**Alternatives:**

- Fully proprietary — rejected: forgoes OSS marketing/contribution value.
- Fully OSS (AGPL or MIT for whole repo) — rejected: hosted SaaS forks become a viability risk; protecting business logic with proprietary license is acceptable.
- npm packages from day 1 — rejected: API surface unstable; premature commitment to versioning.
  **Consequences:** SPDX header convention enforced. Renderer / classifier / catalog code must avoid imports from proprietary modules (or those imports must also be MIT). Dual-license repo layout (LICENSE-MIT + LICENSE-PROPRIETARY) explained in README and ADR-55.

---

## ADR-28: Rare star bootstrap policy with global sample-size gate

**Date:** 2026-05-14
**Status:** accepted
**Context:** Rarity ("Lit by 3% of users") is a powerful affordance for discovery and motivation — but requires aggregate data. At launch, sample size is too small for percentages to be meaningful; bootstrap users would see "100% of users have React lit" because everyone in the beta does.
**Decision:** Hide all global rarity labels until `tech_global_stats.eligible_user_count ≥ 500`. Below that, the UI uses personal/progress language only (e.g. "New star lit", "Recently brightened", "Emerging signal"). The `tech_global_stats` table is provisioned in the MVP schema as a skeleton with empty rows; a daily Inngest batch job populates it; rarity UI is gated by the count check. Display thresholds when active: `≤5%` "Rare", `≤1%` "Very rare", `≤0.2%` "Ultra rare". Common technologies (React, JavaScript, CSS) are never labeled.
**Alternatives:**

- Defer rarity entirely to v0.2 — rejected: schema cost is trivial; better to bake it in.
- Smaller threshold (e.g. 100 users) — rejected: 100 users skewed toward founder network produces misleading rarity.
- Per-cluster rarity ("Lit by 8% in Backend") — rejected: too granular for MVP.
  **Consequences:** `tech_global_stats` table exists from launch. Daily batch is one Inngest cron. Rarity copy is framed about the star (`Lit by 3% of users`), never the person (`You are top 3%`). See ADR-35 for the "no-people-ranking" companion decision.

---

## ADR-29: Free-only MVP, paid tier deferred

**Date:** 2026-05-14
**Status:** accepted
**Context:** Multiple paid feature opportunities exist (team/org constellation, private repos, custom themes, embed widget, poster export, multi-identity) but adding any of them to MVP scope multiplies complexity. Free MVP also lets users feel the product's emotional core without payment friction.
**Decision:** MVP ships free-only. The compass principle: "free users get the magic; paid users get expansion" — but the entire magic surface is free. `users.plan` column is not added at MVP; will be introduced in the paid-tier feature PR. Conversion CTA copy is always `Create yours, free →`.
**Alternatives:**

- Freemium at launch — rejected: paid tier design distracts from getting the free experience right.
- Free + Pro from day 1 — rejected: same as freemium, plus billing infra cost.
  **Consequences:** No Stripe integration in MVP. No `users.plan` column. Marketing copy says "free". When paid arrives (v0.2+), it adds expansion features (team/org, private repos, themes, etc.) without locking the existing free magic.

---

## ADR-30: Username permanent redirect + permanent reservation

**Date:** 2026-05-14
**Status:** accepted
**Context:** Users share profile URLs to social media, embed in personal sites, link in resumes. If they change their username later, those links must not break.
**Decision:** Maintain `username_history` table. On username change, the old value is inserted with `user_id` reference. `/{old}` routes 301-redirect to `/{new}` permanently. The old username remains reserved (cannot be claimed by another user) for the lifetime of the original user's account. On user delete, the history rows are cascade-removed and the name becomes available for new signups.
**Alternatives:**

- 90-day or N-year redirect window — rejected: too short for resume links and slow-decay external references.
- No redirect; old URL becomes 404 — rejected: breaks shared links.
- Reserve forever even after account delete — rejected: unbounded reservation accumulation.
  **Consequences:** `username_history` table with SELECT public RLS. Profile route handler checks current `users.display_username` first, falls back to history with 301 redirect. Username changes are auditable via the history table.

---

## ADR-31: Hard delete, no soft-delete window

**Date:** 2026-05-14
**Status:** accepted
**Context:** GDPR right-to-be-forgotten requires user data deletion on request. Soft delete (mark row hidden, retain data) is friendlier to accidental deletions but conflicts with the explicit privacy promise.
**Decision:** Account delete cascades from `auth.users` immediately. No undo window. The delete confirmation modal requires the user to type their username exactly (`docs/screens.md` §E.2), and outside-click is disabled — high-friction by design. After confirmation: `/account-deleted` page (auto-redirect to landing after 5s).
**Alternatives:**

- 30-day soft delete with email recovery option — rejected: retains data the user explicitly asked us to delete; conflicts with privacy promise.
- 24h email confirmation gate — rejected: adds friction during incident response and edge cases (user can't access email).
  **Consequences:** Cannot recover deleted accounts. Privacy Policy reflects this. Username becomes available for future signup after delete (per ADR-30).

---

## ADR-32: Weekly recap skip policy after 2 consecutive empty weeks

**Date:** 2026-05-14
**Status:** accepted
**Context:** A user with no activity who keeps receiving "Steady week" emails feels surveilled and resentful. But the very first empty week is normal (rest, vacation, other priorities) and skipping it removes a re-engagement opportunity.
**Decision:** Send the empty-week variant for the first quiet week. After 2 consecutive empty weeks, skip subsequent emails until activity resumes. On the first week with new activity, the cycle restarts.
**Alternatives:**

- Always send — rejected: surveillance feeling.
- Always skip empty — rejected: drops re-engagement signal entirely.
- Configurable per-user — rejected: too many settings options.
  **Consequences:** The recap generation job inserts the row regardless, but the send job checks the previous 2 weeks before dispatching. Privacy Policy mentions this honestly: "Skipped after 2 quiet weeks" (also surfaced in Settings copy).

---

## ADR-33: Diff visualization persists 1 week; manual refresh absorbed into "this week"

**Date:** 2026-05-14
**Status:** accepted
**Context:** Weekly recap diff visualization (glow, spark, "+18%") and manual refresh diff visualization should share a single mental model: "this week's changes". Showing two layers (weekly + last-refresh) creates confusion about timeframe.
**Decision:** Diff visualization persists for 1 week — from the most recent Sunday recap until the next. Manual refresh changes during the week are folded into the same diff layer (no separate marker). On a second visit during the same week, the top strip auto-hides but star-level glow/spark remains. On the next Sunday, the diff layer resets to the new week's changes.
**Alternatives:**

- Show two separate markers (weekly + manual) — rejected: visual noise.
- Manual refresh diff shows for 24h only — rejected: inconsistent with weekly mental model.
- No diff persistence; show only on first view — rejected: loses re-engagement signal.
  **Consequences:** Client computes "this week" diff at render time using `weekly_recaps.week_start` as the anchor. Activities with `occurred_at > week_start` are highlighted. Manual refresh updates the same `activities` table; no separate marker column needed.

---

## ADR-34: GitHub indexing delay transparency

**Date:** 2026-05-14
**Status:** accepted
**Context:** Users who push a commit and immediately refresh DevAstra often see no change because GitHub's REST/GraphQL APIs take 1–5 minutes to index new events. Without explanation, this feels broken.
**Decision:** When manual refresh completes with zero new activity, surface the honest cause: `No new activity yet · GitHub can take a few minutes to index commits.` This educates the user without blaming them.
**Alternatives:**

- Silent "no change" state — rejected: feels broken.
- Generic "all caught up" toast — rejected: doesn't explain why.
- Block refresh until 5 min after detected push — rejected: requires push detection we don't have.
  **Consequences:** Honesty principle reinforced — system limits are surfaced rather than hidden. Same principle drives ADR-32 (empty-week skip explanation).

---

## ADR-35: No achievement copy; no toast for unlocks; people are never ranked

**Date:** 2026-05-14
**Status:** accepted
**Context:** Game-style achievement framing ("Level up!", "+15 XP", "Unlocked!") drives short-term engagement but conflicts with the product's emotional positioning (portfolio identity, not skill score). It would also push the product toward ranking and comparison, which we explicitly reject.
**Decision:** No "Level up!" / "+XP" / "Achievement unlocked!" language anywhere in product copy. New stars surface via strip text + cluster pulse, never as toasts. Stage-up uses "expanded" not "leveled up". Rarity labels (when activated post-bootstrap, ADR-28) describe the star, never the person — "Lit by 3% of users" is allowed; "You are top 3%" is forbidden.
**Alternatives:**

- Use gamification copy — rejected: conflicts with portfolio positioning, attracts wrong audience.
- Allow comparison framing ("better than 91%") — rejected: triggers anxiety, violates "not a ranking" promise.
  **Consequences:** Strict copy review for all user-facing strings. Hint copy uses neutral verbs. Email subject lines focus on the constellation event, not the user's standing. Cluster aura + ripple + strip cover what a toast would have covered.

---

## ADR-36: First-week recap special handling

**Date:** 2026-05-14
**Status:** accepted
**Context:** New users signing up Wednesday or Saturday receive their first recap Sunday — but the "week" is partial. Generic active-week copy ("3 new stars this week") feels off when the user has been on the product for 2 days.
**Decision:** Detect first-week recap: `weekly_recaps` row where `week_start = first Monday after user.created_at`. Use `email_type = 'weekly_recap_first_week'` and a dedicated React Email template (`WeeklyRecapFirstWeek.tsx`). Subject `Your first week on DevAstra`. Body: standard 3-slot structure but with explicit highlight of the user's first star ("Your first star: Docker"). Partial empty week falls through to a welcome-style body ("Welcome — push a commit to begin your constellation.").
**Alternatives:**

- Skip first recap until full week elapsed — rejected: misses re-engagement window when novelty is highest.
- Same template as active week — rejected: tone mismatch with partial data.
  **Consequences:** Three email templates instead of two. `email_sends.email_type` enum gains `'weekly_recap_first_week'`. Detection logic lives in `features/recap/generate.ts`.

---

## ADR-37: Cluster stage UX as "expanded" with secondary "Stage N" disclosure

**Date:** 2026-05-14
**Status:** accepted
**Context:** Internal `territories.stage` (1–5) is a useful data model but exposing it as the primary surface ("You are Stage 3!") triggers the gamification framing rejected in ADR-35.
**Decision:** UI describes stage transitions as "cluster expanded" (verb, event-focused). The numeric stage value is disclosed only as secondary info in the cluster drawer header (e.g. `Stage 2` as a sub-text). Manual refresh top strip and weekly recap subject use the "expanded" language. Visual: cluster aura radius expansion 10–20% + intensity increase + one ripple wave (1.5s).
**Alternatives:**

- Hide stage entirely — rejected: useful for power users curious about thresholds.
- Surface stage prominently — rejected: invites ranking framing.
  **Consequences:** Copy review: search for "Stage N" and verify it's secondary. Stage transitions trigger the visual ripple via Realtime updates on `territories.stage_changed_at`.

---

## ADR-38: First-ever star cinematic detection via pending flag

**Date:** 2026-05-14
**Status:** accepted
**Context:** Users who sign up with 0 public repos and later push their first commit deserve a distinct emotional moment (different from the first-time reveal of historical data). The transition is `lit_star_count: 0 → ≥1`. Inferring this from current state ("lit_star_count = 1 AND first_star_cinematic_seen = false") is incorrect when feature is deployed to users who already have data.
**Decision:** Detect the 0→≥1 transition during sync (`features/sync/cinematic-detection.ts`). Set `users.first_star_cinematic_pending = true` on transition. The client checks the flag on next `/` page load; cinematic plays once; flag transitions to `pending = false, seen = true`. Existing users at pivot-deploy time have `pending = false` (column default), so they don't trigger.
**Alternatives:**

- Infer from current state — rejected: false-positive for existing users at deploy.
- Track via separate event log — rejected: extra table for one event.
  **Consequences:** `users.first_star_cinematic_pending` and `first_star_cinematic_seen` boolean columns added (ADR-51 add-only migration). Cinematic is ~8s, not skippable, plays only once per user. Multi-cluster first-lit: stagger of 0.3s between cluster sparks; only first-lit clusters retain permanent activation, others revert to dim outline.

---

## ADR-39: Long-absence return shows "since-last-visit", not weekly diff

**Date:** 2026-05-14
**Status:** accepted
**Context:** A user returning after 4+ weeks of absence should not be greeted with the standard "this week" strip — most of the diff is older than this week. Cumulative recap dumps ("here's everything since 3 months ago") are heavy and discouraging.
**Decision:** When `NOW() - users.last_login_at > 28 days`, the main page shows a welcome-back strip with "since your last visit" diff instead of the weekly strip. Copy: `Welcome back — your constellation has new activity` + sub-line `Since your last visit: 3 stars lit · Backend expanded`. The most-changed cluster pulses once. No cumulative recap. Mental boundaries: weekly recap = this week (Flow 2); welcome back = since last visit (this ADR); main constellation = current state always.
**Alternatives:**

- Show cumulative recap dump — rejected: heavy and discouraging.
- Show only "this week" — rejected: most of the diff is older.
- Combine both — rejected: complicates mental model.
  **Consequences:** Client computes since-last-visit diff using a query on `activities.occurred_at > previous_last_login_at`. `users.last_login_at` is updated on each authenticated `/` page render. Dismissing the welcome-back strip hides it for the current visit; future 4+ week absences trigger the overlay again.

---

## ADR-40: Drawer "Why is this lit?" explainability and misclassification feedback

**Date:** 2026-05-14
**Status:** accepted
**Context:** Classifier output may surprise users ("Why is my Frontend brightest? I'm a backend person."). Without explanation, this damages credibility. Without a feedback channel, our classifier never improves.
**Decision:** Cluster drawer has a per-star expansion (`Why is this lit?`) that translates detection rules into product language (e.g. `Lit from TypeScript files and React-related paths`), shows top contributing repos, and shows activity breakdown (commits / PRs counts). A `This doesn't look right` button opens a misclassification feedback modal with a category select + optional note. Feedback rows are stored in `misclassification_feedback` (forward-only audit log; user cannot read their own back). Rate limit: 5 per user per 24h.
**Alternatives:**

- Allow user override of classification — rejected: complexity + maintenance burden for MVP.
- No feedback channel — rejected: classifier improvement opportunity lost.
- Per-cluster feedback only — rejected: less precise; per-star is the actionable unit.
  **Consequences:** `misclassification_feedback` table with the described shape. Rate limit enforced in Server Action. Founder reads feedback via service-role SQL. User adjustments are limited to repo include/exclude in Settings (ADR-22 backfill flow).

---

## ADR-41: Onboarding hint lifecycle via permanent boolean flags

**Date:** 2026-05-14
**Status:** accepted
**Context:** Once a user has learned the interaction model (click cluster → drawer, share button is in header), repeated hints are condescending. But session-only hints risk users missing them entirely.
**Decision:** Three boolean flags on `users`: `cluster_click_hint_seen`, `share_hint_seen`, `recap_diff_hint_seen`. All persist forever once set. Cluster click hint shows up to 2 times max, ending immediately on first drawer open. Share button pulses exactly once after first drawer close. Recap diff hint dismisses on target click. No manual dismiss UI — all dismissals are action-triggered.
**Alternatives:**

- Session-only flags — rejected: noise on repeat sessions.
- One-time flags — rejected: users miss on first session sometimes.
- Settings to re-enable hints — rejected: bloat.
  **Consequences:** 3 boolean columns on `users` (additional from baseline schema). Flags are set via Server Actions on action events; persist across devices because they're on the user row.

---

## ADR-42: System status banner via DB table; no admin UI; banner-only never modal

**Date:** 2026-05-14
**Status:** accepted
**Context:** Incidents happen. Users deserve to know when sync is delayed, when GitHub is down, etc. But building an admin UI is over-investment, and modal alerts break the "constellation never disappears" promise.
**Decision:** `system_messages` table holds banner content. Active rows render in the top strip area. Multiple active rows: highest severity wins; ties by `created_at DESC`. Founder writes via Supabase dashboard SQL (no admin UI). Banner is dismissible per session; reappears in new sessions until `active = false`. Never blocks the constellation.
**Alternatives:**

- Env var driven (requires deploy) — rejected: incident response should not need a deploy.
- Admin route with `is_admin` column — rejected: extra attack surface.
- Modal alerts — rejected: blocks constellation, "constellation never disappears" violated.
  **Consequences:** `system_messages` table. Banner priority: `disconnected > system status > welcome back > this-week diff` in the top strip area. Sync-failed banner is bottom region (separate). Manual ops procedure: founder logs into Supabase dashboard, INSERT INTO system_messages.

---

## ADR-43: Constellation persistence across auth/sync failures

**Date:** 2026-05-14
**Status:** accepted
**Context:** Sync can fail for many reasons: GitHub OAuth revoked externally, token expired with refresh failure, GitHub account suspended, GitHub API outage, our own sync code bug. In none of these cases should the user see their constellation disappear — it's their portfolio identity.
**Decision:** Cached constellation (`territories`, `landmarks` rows) is always rendered. Failure surfaces via dismissible banner only. Disconnected state: `users.github_access_token_enc = NULL` + banner `GitHub disconnected — reconnect to sync new activity`. Sync error: banner `Sync failed. Your constellation is safe.` + Retry. Token expired: banner `Your GitHub connection expired — Reconnect`. Cron sync failures are not surfaced unless the user-visible state is affected (e.g. stale `last_synced_at` triggers a soft color change on the header timestamp).
**Alternatives:**

- Hide constellation when sync fails — rejected: violates portfolio identity promise.
- Modal blocking error — rejected: same.
  **Consequences:** Every banner UI must be over-and-not-blocking. ISR + Realtime degrade gracefully; if Realtime drops, polling fallback is acceptable for MVP (no automatic polling implemented, sync state simply not animated). Principle: _"Sync can die. The constellation cannot disappear."_

---

## ADR-44: Legal pages as markdown source, rendered server-side

**Date:** 2026-05-14
**Status:** accepted
**Context:** Legal text changes infrequently but is mission-critical at launch. Rendering from CMS is over-engineering; embedding TSX makes diffs unreadable.
**Decision:** `docs/legal/privacy.md` and `docs/legal/terms.md` hold the source content. `app/privacy/page.tsx` and `app/terms/page.tsx` read the markdown file at build/render time and render with a minimal markdown library. Page layout: dim sky background + light-colored document card for readability. Last-updated date displayed at the top.
**Alternatives:**

- TSX hand-written — rejected: hard to diff legal text changes.
- CMS-driven — rejected: over-engineering for content that changes 1–2 times per year.
- MDX — rejected: no React components needed inside.
  **Consequences:** Markdown rendering library added. Legal content version-controlled in the same repo. Updates require a PR and deploy. `Last updated: {date}` line at the top.

---

## ADR-45: One-click unsubscribe with 30s undo; token-based unauthenticated access

**Date:** 2026-05-14
**Status:** accepted
**Context:** CAN-SPAM and GDPR require easy unsubscribe — ideally one click without login. Login-walled unsubscribe blocks users who can't access their account. But raw GET-based one-click is vulnerable to prefetch / accidental clicks.
**Decision:** Unsubscribe links in email footers point to `/unsubscribe?token={jwt}`. The page loads, immediately issues a POST to `/api/unsubscribe` with the token, sets `users.email_recap_enabled = false`, and shows confirmation with a 30s `Undo →` action. Token is signed JWT containing `user_id`, `email_type`, and a `version` claim. Token has no expiry — old emails must still work. Token is invalidated globally on incident by bumping `UNSUBSCRIBE_TOKEN_VERSION` env var (ADR-48).
**Alternatives:**

- Login-walled unsubscribe — rejected: blocks users who lost access.
- Pure GET one-click — rejected: GET prefetch can unsubscribe accidentally.
- 24h confirmation email — rejected: too much friction; defeats CAN-SPAM intent.
  **Consequences:** `lib/email/unsubscribe-token.ts` for sign/verify. Token includes version. POST endpoint is idempotent. Undo affordance lasts 30s.

---

## ADR-46: RLS bypass policy — Drizzle direct connection runs as service role; query layer enforces user_id filter

**Date:** 2026-05-14
**Status:** accepted
**Context:** Two parallel data access patterns exist: the Supabase client (anon key, RLS enforced) and the Drizzle direct Postgres connection (postgres role, RLS bypassed). The Drizzle path is server-side only and chosen for performance (joins, transactions). Without explicit policy, a future contributor may forget to filter by `user_id` in a Drizzle query and leak data.
**Decision:** The Drizzle direct connection is documented as "service-role tier" — RLS does not protect it. All Drizzle reads against per-user tables (`activities`, `territories`, `landmarks`, `email_sends`, `weekly_recaps`, `misclassification_feedback`, `sync_jobs`) MUST flow through `lib/db/queries/_helpers.ts` `withUserScope(userId)` which enforces `WHERE user_id = $userId`. CLAUDE.md and `docs/code-architecture.md` document this as a guard rail. RLS remains enforced for the Supabase client path (auth callback, browser-side queries). Public profile reads use `users_public_view`, created with `security_invoker = true`, so the view does not silently run with owner privileges.
**Alternatives:**

- All queries go through Supabase client — rejected: performance loss on joins, weak transaction support.
- Drop RLS entirely — rejected: defense-in-depth lost; Supabase client path benefits from RLS.
- Use Postgres `SET ROLE` per query — rejected: complexity in connection pool.
  **Consequences:** `_helpers.ts` is the convention. Code review must check every new Drizzle query for user_id scoping. RLS isolation test (`tests/integration/rls-isolation.test.ts`) exercises the Supabase client path only — Drizzle path is covered by unit tests on `_helpers`. Supabase Advisor warnings on `users_public_view` are treated as security bugs, not cosmetic warnings.

---

## ADR-47: Test/mock routes are NODE_ENV-guarded; production deploys verify

**Date:** 2026-05-14
**Status:** accepted
**Context:** A test route like `/api/test/mock-oauth` exists for local development and CI E2E tests. If deployed to production by accident, it allows arbitrary user impersonation — account takeover.
**Decision:** Every file under `app/api/test/*` (and any other dev-only routes) begins with `if (process.env.NODE_ENV === 'production') notFound()` as the first action. A pre-deploy verification step asserts the route returns 404 on production. The OAuth callback `redirectTo` host is also validated against an allowlist (`APP_HOSTNAME_ALLOWLIST` env var) to prevent open redirect.
**Alternatives:**

- Build-time exclusion of test routes — rejected: harder to maintain than runtime guard.
- Trust convention only — rejected: too easy to miss.
  **Consequences:** Convention: all test routes guard against prod at the top. Long-term: migrate mock fixtures into the test infrastructure (`tests/`) rather than living as routes. `APP_HOSTNAME_ALLOWLIST` env var holds production hostnames.

---

## ADR-48: Unsubscribe token versioning for incident revocation

**Date:** 2026-05-14
**Status:** accepted
**Context:** Unsubscribe tokens are permanent (ADR-45) so old email links keep working. But if the signing secret leaks, an attacker can forge tokens for any user and unsubscribe them (or worse, future expansion of token use). Permanent tokens with no revocation mechanism are a single point of failure.
**Decision:** Every unsubscribe token includes a `version` claim. The server compares against `UNSUBSCRIBE_TOKEN_VERSION` env var; mismatch → reject with `M4.2` page. Incident response: bump the env var, redeploy. All old tokens become invalid immediately. Users with old emails will see "expired" page and be directed to sign-in.
**Alternatives:**

- Short-lived tokens (e.g. 90 days) — rejected: old emails stop working naturally, frustrating users.
- Per-token JTI + revocation DB table — rejected: state cost vs benefit; version bump is simpler.
  **Consequences:** Env var bump invalidates all outstanding tokens. New emails carry the new version. Document the response procedure in `SECURITY.md`.

---

## ADR-49: Sentry automatic PII scrub in beforeSend

**Date:** 2026-05-14
**Status:** accepted
**Context:** Sentry receives error context including HTTP headers, breadcrumbs, and stack traces. GitHub tokens, cookies, and authorization headers may end up in error payloads. Manual sanitization at each capture site is error-prone.
**Decision:** Implement `beforeSend` in `lib/sentry.config.ts` to automatically scrub: HTTP `authorization` header, HTTP `cookie` header, token-like patterns (`gho_*`, `ghu_*`, `ghs_*`, `Bearer *`), and exception messages matching token regex. Sentry data scrubbing rules also configured in the Sentry project as defense-in-depth.
**Alternatives:**

- Manual scrub at each capture site — rejected: too easy to miss.
- Disable Sentry on routes that touch tokens — rejected: loses error visibility.
  **Consequences:** `beforeSend` becomes critical code; covered by unit test. Sentry DSN is set with project-level scrubbing rules as backup.

---

## ADR-50: Initial sync window capped at 1 year of activity

**Date:** 2026-05-14
**Status:** accepted
**Context:** A super-active user (50+ repos, multi-year history) can produce 1M+ activities, blowing through GitHub API rate limit (5k/hr/user) and making first-reveal take 30+ minutes. Most of that history is not what users care about today.
**Decision:** Initial sync only fetches activities from the last 1 year. Older activity is not retroactively imported. Daily incremental sync handles ongoing growth. Deeper history is a v0.2 candidate (potentially paid, as a "Full history" feature).
**Alternatives:**

- Unbounded initial sync — rejected: rate limit + slow first reveal.
- 6 months — rejected: cuts off too much recent context.
- 2 years — rejected: still tail-heavy on rare users with deep history.
  **Consequences:** First reveal completes faster (target <30s for 99% of users). GitHub API budget stays under 5k requests for initial sync. Users with deep history see growth over time as the daily sync detects new activity.

---

## ADR-51: Add-only schema migrations; pooler connection for runtime

**Date:** 2026-05-14
**Status:** accepted
**Context:** Schema changes during MVP and the pivot must not break existing data or require downtime. Vercel serverless cold-starts open many connections; direct Postgres connection (port 5432) hits "too many connections" quickly.
**Decision:** All schema migrations are **add-only** — new columns have safe defaults, new tables are independent. Drops or column renames require a dedicated PR with explicit user instruction. Runtime queries connect via Supabase's transaction-mode pooler (`:6543`); `drizzle-kit migrate` uses direct connection (`:5432`) via `DIRECT_URL`. `postgres-js` driver is configured with `prepare: false` (transaction-mode pooler does not support session-bound prepared statements), a small max pool, and a global dev singleton to avoid hot-reload connection churn.
**Alternatives:**

- Allow drops within migrations — rejected: risk vs benefit at MVP; forward-fix is safer.
- Direct connection at runtime — rejected: serverless cold-starts and local Inngest E2E can exhaust session-mode clients.
  **Consequences:** Rollback procedure is "code revert" (ADR-56). Drizzle Kit migrations use `DIRECT_URL`; runtime uses `DATABASE_URL` (pooler). Connection pool sizing reviewed quarterly.

---

## ADR-52: OG cache versioning via constant + URL query param

**Date:** 2026-05-14
**Status:** accepted
**Context:** Per-user OG revalidation (sync completion, public toggle) doesn't cover global renderer changes (pivot, tech-catalog refresh, layout changes). On deploy of a global change, all cached OG images would be stale until natural ISR expiry.
**Decision:** `OG_RENDER_VERSION` constant lives in `lib/og/version.ts`. All OG URLs include `?v={OG_RENDER_VERSION}` (e.g. `/api/og/profile/foo?v=devastra-1`). Bumping the constant via a code change naturally invalidates all cached images by changing the URL. Per-user revalidation still applies on top.
**Alternatives:**

- Bulk revalidatePath of all public usernames on deploy — rejected: function calls scale with users; cache-key change is cheaper.
- Vercel-specific edge cache keys — rejected: vendor lock-in.
  **Consequences:** Every OG-consuming surface (profile page meta, email hero, share modal preview) must read the version constant. New profile/recap rows naturally get the new version in their OG URL.

---

## ADR-53: Observability stack — PostHog funnel + Vercel Speed Insights + UptimeRobot health endpoint

**Date:** 2026-05-14
**Status:** accepted
**Context:** MVP success criteria (`docs/prd.md`) require concrete activation, share, return-rate measurement. Performance regressions and outages need to be detected.
**Decision:**

- **Funnel + product analytics:** PostHog cloud. 6 core events: `landing_view`, `oauth_click`, `repo_select_complete`, `first_reveal_complete`, `share_click`, `public_toggle_on`. Cookieless mode (ADR-60); URL masking on `/{username}` (ADR-49 / ADR-60).
- **Performance:** Vercel Speed Insights for Web Vitals (LCP, CLS, INP).
- **Errors:** Sentry (ADR-49).
- **Uptime:** UptimeRobot pings `/api/health` every 5 min; free tier.
  **Alternatives:**
- Build custom analytics — rejected: PostHog's funnel UI is the actual value.
- Mixpanel / Amplitude — rejected: less generous free tier.
- Custom uptime infra — rejected: ops cost.
  **Consequences:** Three external tools to maintain. `/api/health` route must be lightweight (DB ping + 200 OK).

---

## ADR-54: Accessibility baseline — reduced motion, cluster-level keyboard nav, screen reader summary

**Date:** 2026-05-14
**Status:** accepted
**Context:** WCAG AA compliance is both legal exposure and ethical baseline. Dim-sky design plus heavy motion (sparks, ripples, pulses) presents specific risks (color contrast, vestibular disorders).
**Decision:**

- **Reduced motion:** Respect `prefers-reduced-motion: reduce`. When set, all cinematics (first-time reveal, first-ever cinematic, stage-up) snap to final state instantly; spark/ripple/pulse/aura-expansion disabled.
- **Keyboard nav:** Cluster labels are keyboard-focusable buttons. Tab cycles through lit clusters; Enter opens the drawer. Drawer dismisses on ESC.
- **Screen reader:** Cluster `<g>` carries `role="button"` and `aria-label="Backend cluster, 3 stars lit"`. Stars themselves are decorative (`aria-hidden`). Page top includes a summary line: `Your constellation has 12 stars lit across 4 clusters.`
- **Color contrast:** Pivot included a contrast audit of cluster colors against the dim-sky background; adjustments made for WCAG AA (4.5:1 normal text, 3:1 large/icons).
  **Alternatives:**
- Full-fledged per-star keyboard nav with arrow keys — rejected: complexity vs benefit at MVP; cluster level is the meaningful unit.
- High-contrast mode toggle — rejected: setting bloat.
  **Consequences:** Visual design pass includes contrast verification. Renderer reads `prefers-reduced-motion` from CSS and branches.

---

## ADR-55: Dual-license repository — LICENSE-MIT for extractable, LICENSE-PROPRIETARY for the rest

**Date:** 2026-05-14
**Status:** accepted
**Context:** ADR-27 commits to open-core with MIT-headered extractable modules. GitHub's UI expects a single LICENSE file at the repo root and uses it to label the repo's overall license. A naive single LICENSE could either over-license (full MIT, allows hosted competitors to fork) or under-license (proprietary only, hides the OSS intent).
**Decision:** Repository contains two LICENSE files at the root: `LICENSE-MIT` and `LICENSE-PROPRIETARY`. README explains: files with `SPDX-License-Identifier: MIT` at the top are under LICENSE-MIT; everything else is LICENSE-PROPRIETARY. GitHub will display "MIT and Other" on the repo summary, which is accurate.
**Alternatives:**

- Single LICENSE: MIT — rejected: gives away SaaS code.
- Single LICENSE: "All Rights Reserved" — rejected: contradicts ADR-27 OSS intent.
- AGPL — rejected: too restrictive for hosted-fork prevention while still allowing internal use.
  **Consequences:** README must explain dual-license clearly. SPDX header convention enforced (ADR-27). Future contributors must respect the boundary.

---

## ADR-56: Add-only migration philosophy implies code-revert as rollback

**Date:** 2026-05-14
**Status:** accepted
**Context:** ADR-51 commits to add-only migrations. The implication for rollback: if a feature breaks, we revert the code, not the schema. The new columns/tables remain (unused but harmless).
**Decision:** Rollback procedure is "code revert" only. Schema rollback (DROP COLUMN, DROP TABLE) requires a dedicated PR with explicit user instruction (separately from the rollback). Forward-fix is preferred for almost all production incidents. Down-migrations are not authored by default.
**Alternatives:**

- Author down-migrations for every up-migration — rejected: doubles migration cost; rarely used.
- Allow rapid schema rollback — rejected: data loss risk on a hot path.
  **Consequences:** Migrations are sticky additions. Decommissioning a column requires a deliberate cleanup PR after the code no longer references it.

---

## ADR-57: Migration deploy procedure — manual gate before code merge

**Date:** 2026-05-14
**Status:** accepted
**Context:** Schema changes deployed simultaneously with code changes via CI/CD risk inconsistency (new code expects new column; deploy is mid-flight; some serverless instances run old code against new schema, or vice versa).
**Decision:** Migrations are applied **manually before code merge**. Procedure:

1. Author migration in `drizzle/migrations/`.
2. Test against dev Supabase using `DIRECT_URL`.
3. Open PR; CI runs full check suite.
4. Before merging: run `drizzle-kit migrate` against prod (`DIRECT_URL=<prod_direct>`).
5. Confirm in PR description: `migration: applied`.
6. Merge → Vercel deploys.

Add-only migrations (ADR-51) make this safe: new columns/tables don't affect existing code paths.
**Alternatives:**

- CI-automated migration on merge — rejected: schema changes warrant human gate; auto-migrate on broken migration is catastrophic.
- Migration in deploy step — rejected: rollback complexity.
  **Consequences:** PR template includes migration line. CLAUDE.md documents the procedure.

---

## ADR-58: Web Vitals targets — LCP <2.5s, CLS <0.1, INP <200ms; Vercel Speed Insights

**Date:** 2026-05-14
**Status:** accepted
**Context:** Performance silently degrades; without targets there is no signal. Standard "good" Web Vitals thresholds are well-established.
**Decision:** Adopt industry-standard Web Vitals targets:

- LCP (Largest Contentful Paint) < 2.5s
- CLS (Cumulative Layout Shift) < 0.1
- INP (Interaction to Next Paint) < 200ms

Tracked via Vercel Speed Insights. Initial JS bundle budget: < 250KB gzipped (Next.js recommendation). Web Vitals regressions reviewed monthly.
**Alternatives:**

- Aggressive targets — rejected: MVP performance work is not the highest leverage at this scale.
- No targets — rejected: no signal.
  **Consequences:** Speed Insights subscription added. Monthly review of dashboard. Investigate regressions when consistent failure observed.

---

## ADR-59: SEO surface — dynamic sitemap + 301 canonical for username history

**Date:** 2026-05-14
**Status:** accepted
**Context:** Public profiles are the viral channel. SEO matters for discovery. Username changes create duplicate-content risk if both old and new URLs are indexed.
**Decision:**

- `app/sitemap.ts` dynamically generates a sitemap including landing, privacy, terms, and all public users (`is_public = true`). Daily cache.
- `app/robots.ts` returns standard `robots.txt` allowing search bots.
- Old usernames 301-redirect to new (ADR-30); the new URL is the canonical via `<link rel="canonical" href="{new}">`.
- Per-page OG and Twitter card tags include constellation OG image.
  **Alternatives:**
- Static sitemap — rejected: misses new public users.
- 302 redirects — rejected: SEO penalty; permanent change deserves 301.
  **Consequences:** Sitemap query runs daily (Inngest cron). Page-level meta tags include canonical when redirected.

---

## ADR-60: Privacy compliance — cookieless PostHog, sub-processor disclosure, manual data export

**Date:** 2026-05-14
**Status:** accepted
**Context:** GDPR and CAN-SPAM impose user-data and notification obligations. Cookie consent banners add UX friction; we'd rather avoid them. Data export requests must be honorable but a UI is over-engineering at MVP.
**Decision:**

- **PostHog cookieless mode.** All capture happens without setting cookies (using localStorage / fingerprinting opt-out alternatives). Funnel events still work; session replay is limited.
- **Sub-processor disclosure** in Privacy Policy: Supabase, Vercel, Inngest, Resend, Sentry, PostHog, GitHub.
- **Data export** by email request: `privacy@devastra.app` with 30-day response window. Founder runs internal SQL script to produce a JSON / CSV zip on request.
- **PII scrubbing.** PostHog masks all form inputs. URL paths matching `/{username}` are masked to `/[username]`. Sentry strips token / authorization / cookie patterns (ADR-49).
- **Age policy:** ToS requires user is 13+ (GitHub OAuth provides implicit verification — GitHub itself requires 13+).
  **Alternatives:**
- Cookie consent banner — rejected: UX friction; cookieless avoids the question.
- In-app data export UI — rejected: over-engineering at MVP; manual is fine until request frequency rises.
- Lawyer-reviewed legal docs — rejected: cost; ADR-25 retains self-write posture.
  **Consequences:** Privacy Policy must accurately describe the above. Data export script lives in `scripts/`. PostHog config tightened (initialization with `disable_cookie: true` or equivalent).

---

## ADR-61: Stellarium visual language for the constellation canvas

**Date:** 2026-05-14
**Status:** accepted
**Context:** The initial SVG constellation renderer rendered stars as large radial-gradient blobs with persistent cluster-color aura washes. User feedback: the canvas reads as a "colorful skill dashboard," not an identity surface. The four-pillar test (`docs/prd.md`) requires the canvas to feel like a credible artifact, not a UI overlay. Reference: Stellarium (the planetarium application), specifically atmosphere-off mode with a deep black observational sky.
**Decision:** Adopt Stellarium as the primary visual language. Cluster identity is expressed through **spatial grouping + boundary lines + connection lines + quiet map-style labels** — never through persistent color. Specifically:

- Tech stars use a **spectral palette** (white, blue-white, pale yellow, soft orange) — not cluster colors.
- The default canvas has **no persistent colored aura wash**. Cluster color appears only on `cinematic/stage-up > drawer-selected > hover` interaction moments (single active aura at a time).
- A persistent **territory boundary line layer** (Voronoi cells from cluster anchors) marks where each cluster lives. Always visible; subtle blue-gray; never moves with lit/unlit state.
- Sky background is near-black. The default web canvas intentionally renders **no Milky Way nebulosity** and no warm nebula wash; a faint cool haze is allowed only as a depth cue.
- A deterministic background **field star** layer (~2000 desktop / ~1000 mobile) sits behind the tech stars, with bounded twinkle (±10%, 4–8s per-star phases). Field stars carry no semantics, no labels, no hover.
- Sparse constellations (1–17 lit tech stars) use bounded visual compensation: small system camera framing, slight foreground tech-star emphasis, and at most ~10–12% field/mid-star opacity reduction. This preserves the night-sky atmosphere while preventing early constellations from feeling empty.
- Labels are small blue-white sans-serif — never cluster color, never letter-spaced caps. Persistent label rule: every lit tech star gets a label; lower-brightness labels are quieter and smaller so dense constellations remain readable.
  **Alternatives:**
- Keep cluster-color stars + cluster aura wash — rejected: reads as dashboard, not identity surface.
- Hybrid (low-saturation cluster colors) — rejected: muddles the Stellarium reference without committing to it.
- Constellation lines as hand-drawn figure overlays (Stellarium "cultural sky") — rejected: too literal; product clusters are not myths.
  **Consequences:** This ADR amends the compass forbidden list (`CLAUDE.md` L153–162). Field stars are no longer "decorative stars that don't map to tech_key"; they are reframed as "sky background." Bounded ambient motion (field/mid-star twinkle and background-layer parallax) is now permitted when (a) it is decoupled from per-star semantic identity and (b) it respects `prefers-reduced-motion`. Persistent cluster-color aura is forbidden in steady state. Milky Way / nebula texture work is not part of the default web canvas after the final visual pass; reintroducing it requires a new explicit design decision. Implementation specifics live in `docs/screens.md` §C and ADR-62 / ADR-63.

---

## ADR-62: WebGL primary renderer (R3F) + SVG OG divergence + server-side feature flag

**Date:** 2026-05-14
**Status:** accepted
**Context:** ADR-61's Stellarium fidelity (Airy disk stars, diffraction spikes, shader-local glow, bounded twinkle/parallax, and subtle atmospheric depth) is impractical in SVG at the quality bar set by reference image 3. The OG image generator (`@vercel/og`) cannot execute WebGL.
**Decision:**

- **Web stack:** React Three Fiber + `@react-three/drei`; `@react-three/postprocessing` remains installed for an optional low-resolution Bloom + Vignette layer, but default steady-state glow is shader-local. Three.js as transitive peer. WebGL canvas mounts client-side only via `dynamic(() => import('./Scene'), { ssr: false })`.
- **Steady-state shader budget:** Tech-star Airy disks, top-tier diffraction spikes, and MST connection lines are all rendered with local point/strip shaders. Connection lines use tapered quad strips with a narrow core plus soft halo, and star grade differences come from the shared logarithmic magnitude curve (`features/constellation/render/magnitude.ts`). Full-screen bloom is not required to make edges or brightness grades legible.
- **OG renderer remains SVG-only** (`lib/og/ConstellationImage.tsx`). Defined as a "Stellarium-inspired static poster" at ≈80% visual fidelity to the web renderer — not a pixel-accurate screenshot. Polish: improved SVG glow approximation + Voronoi boundary paths; legacy Milky Way texture assets may remain OG-only until a separate OG design pass. Both web and OG renderers import shared math from `features/constellation/render/*` so palette / anchors / Voronoi / magnitude / label-selection stay in lockstep.
- **Feature flag:** server-side env var `CONSTELLATION_RENDERER=webgl|svg` (default `webgl`). Read in server components, passed as prop. NOT `NEXT_PUBLIC_*` — that would inline at build time and require redeploy for rollback. Server-side read gives instant rollback via Vercel env-var change.
- **First-paint strategy:** the wrapper component uses a lightweight HTML/SVG **Skeleton** (background + boundary lines + cluster labels, ≈3KB inline) as the dynamic loading fallback and as the WebGL-unsupported / Scene-crash fallback. The normal WebGL path removes the Skeleton after the wrapper and Scene mount, then fades the Scene in over 300–500ms to avoid duplicate steady-state layers.
- **Fallback when WebGL is unavailable** (old browsers, in-app browsers, organization disables): Skeleton stays mounted, no Scene is created, a small banner reads "Your browser doesn't support advanced graphics; using simplified view."
- **Adaptive quality for mobile:** field stars 1000 (vs 2000 desktop); mid-depth stars 220 (vs 420 desktop); DPR cap 2; optional postprocessing stays default-off and uses a low-resolution render target if manually enabled; reduced-motion path disables twinkle/parallax/spark.
- **Rollout retire:** after ~2 weeks of stable rollout, a separate PR removes `ConstellationSVG.tsx`, the env-var read, and the renderer prop. Web becomes WebGL-only; OG remains divergent SVG.
  **Alternatives:**
- `NEXT_PUBLIC_CONSTELLATION_RENDERER` — rejected: build-time inline forces rebuild on rollback.
- Puppeteer headless screenshot for OG — rejected: Vercel function cost + timeout risk + cache invalidation complexity.
- `node-canvas-webgl` for OG — rejected: GPU driver / native dep fragility on serverless.
- Hard switch (no feature flag) — rejected: regression risk during rollout window.
- Default full-screen bloom/postprocessing — rejected after performance measurement: it made dense scenes materially smoother-looking but dropped desktop/mobile FPS into the ~16–21fps range. Shader-local halos preserve the glow without the frame cost.
- Milky Way / nebula texture in the default web canvas — rejected in final visual review: it added a warm illustrated wash that competed with the clean observational star-atlas direction.
  **Consequences:** New dependencies (`three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, optionally `d3-voronoi`). The constellation renderer remains dynamically imported and size-gated; postprocessing is not required for the default visual path. New env var `CONSTELLATION_RENDERER`. `lib/og/ConstellationImage.tsx` and the new WebGL renderer must consume the same `features/constellation/render/*` math — drift between them becomes a real risk and is covered by unit tests on the shared module. `ConstellationSVG.tsx` must remain operational throughout rollout; its removal is a follow-up PR.

---

## ADR-63: Territory boundary algorithm (Voronoi) + label visibility rule + DOM accessibility overlay

**Date:** 2026-05-14
**Status:** accepted
**Context:** ADR-61 reassigns cluster identity from color to map grammar (boundary + labels + connections). This requires three concrete decisions: (1) how the cluster regions are geometrically defined, (2) which star labels persist on screen, (3) how WebGL — which is opaque to assistive technology — provides keyboard and screen-reader access.
**Decision:**

- **Boundary algorithm: Voronoi cells.** Computed at render time from the six cluster anchor points already defined per viewport (`features/territories/star-positions.ts`). Cells are always visible, fixed regardless of which stars are lit, drawn as thin (~10% opacity) muted blue-gray polygonal strokes. Algorithm: `d3-voronoi` or a small hand-rolled implementation (6 points is trivial). Rejected alternatives: convex hull of lit stars (geometry shifts when stars light up — unstable); hand-defined polygons per viewport (3× manual maintenance burden).
- **Persistent label rule:**
  ```
  - label every lit tech star, regardless of brightness
  - use quieter/smaller labels for low-brightness stars
  - offset labels outward from cluster anchors to reduce overlap
  ```
  Cluster names ("Backend", "Frontend") are always labeled, one per cluster. Unlit stars: no label, no hover.
- **Accessibility overlay:** WebGL canvas is purely visual. A DOM overlay layer with **invisible buttons** is absolutely-positioned over (a) each cluster boundary polygon, (b) each cluster label, (c) each lit tech star and its visible label. The overlay applies the same sparse-mode view transform as the WebGL camera so visual stars and hit targets do not drift. Keyboard tab order + ARIA labels match current cluster nav semantics (`docs/adr.md` ADR-54). Field stars and unlit anchors are NOT accessible targets.
- **`/dev/map` env-var change:** the existing `process.env.NODE_ENV === 'production'` guard is replaced by `process.env.ENABLE_DEV_MAP !== '1'`. This allows production-build Playwright visual regression runs in CI / Vercel preview deploys to access `/dev/map` while keeping production hidden. ADR-47's principle ("dev-only routes guard against production access") is preserved; only the mechanism is variant. Other test routes under `app/api/test/*` retain the `NODE_ENV` guard.
  **Alternatives:**
- Boundary: convex hull (rejected — instability); hand-defined polygons (rejected — maintenance).
- Labels: top-N global or cluster-top only (rejected — low-brightness lit stars feel broken because the user cannot identify them without hunting). All lit stars are labeled, with quieter typography for dim stars to control clutter.
- A11y: render every star as a DOM element parallel to canvas (rejected — 50× DOM nodes for marginal benefit; field stars carry no semantic value); SVG-only fallback as the a11y path (rejected — defeats WebGL adoption).
- `/dev/map` access: trust `NODE_ENV` only (rejected — blocks production-build visual regression); always public (rejected — exposes internals).
  **Consequences:** New module `features/constellation/render/voronoi.ts` (pure). New module `features/constellation/render/labels.ts` (pure). DOM overlay component `app/_components/Constellation/overlay/A11yOverlay.tsx` mounts in parallel with the WebGL Scene; their position math is driven by the same world-coord helpers — drift between visual and a11y hit-targets is a real bug class and must be covered by Playwright a11y tests. New env var `ENABLE_DEV_MAP=1` (CI / Vercel preview only). `docs/security-checklist.md` adds an item for the `/dev/map` env-var guard.

---

## ADR-64: GitHub sync API budget and classifier evidence hierarchy

**Date:** 2026-05-16
**Status:** accepted
**Context:** Local real-GitHub E2E and the optimization pass exposed two product risks: sync could spend too much GitHub/Supabase budget before first reveal, and broad language fallbacks could make users with backend/data work appear frontend-only when JavaScript or TypeScript was the repository primary language.
**Decision:**

- Treat GitHub API calls as a constrained product budget. Onboarding 90-day commit counts come from one GitHub GraphQL contribution query instead of per-repo REST commit calls.
- GitHub REST/GraphQL clients fail fast with rate-limit context on 403 rate-limit responses. They must not sleep inside request paths for up to 60 seconds.
- Commit-detail enrichment is capped to the latest 50 sampled/relevant activities per sync run. Manual and incremental sync fetch GitHub detail outside DB transactions.
- Initial sync probes likely manifest paths by primary language and caps manifest-content probing to the first 50 selected repos. Repos that are not manifest-probed still receive default classification context.
- Parsed manifest dependency names are cached per repository and reused only when GitHub's source `pushed_at` value is unchanged from the value stored with the cache. The cache stores dependency names, not manifest file contents, and a changed or unknown `pushed_at` forces manifest revalidation before a build can complete.
- Initial sync and Settings backfill run a bounded historical bootstrap for selected repos that have no recent activity, capped at 20 repos, 3 commit-list pages per repo, and 100 authored commits per repo. This avoids an empty first constellation when a user intentionally selects older repos while preserving the API budget.
- Historical bootstrap checks are cached per repository and reused only when GitHub's source `pushed_at` value is unchanged from `historical_bootstrap_source_pushed_at`. Changed or unknown `pushed_at` values force a new bounded historical scan before completion.
- Syncs that already know selected GitHub node IDs use GraphQL direct node lookup batches for repository metadata instead of re-listing every repository owned by the user.
- Independent GitHub work may overlap only behind a bounded REST request queue, preserving wall-clock improvements without increasing uncontrolled API concurrency.
- Classifier evidence hierarchy is: path context and explicit catalog rules > manifest/dependency evidence > primary-language fallback > generic extension fallback. Generic languages can classify into backend, data, testing, DevOps, docs, or frontend depending on stronger evidence.
  **Alternatives:**
- Unbounded GitHub fetching — rejected: bad first-run latency, higher rate-limit failure risk, and avoidable Supabase connection pressure.
- Language-only classification — rejected: fast but misleading for full-stack, backend-in-TypeScript, test-heavy, docs-heavy, and data-heavy repos.
- Full repository tree/content scan — rejected: expensive, rate-limit risky, and unnecessary for MVP accuracy.
  **Consequences:** First reveal is cheaper and more reliable, but obscure stacks may need future catalog rules. Parser/classifier tests are required for any new GitHub node shape or catalog entry. Sync code must preserve caps and DB-transaction boundaries unless a dedicated ADR replaces this budget.
