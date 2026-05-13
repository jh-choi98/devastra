# Architecture Decision Records — DevAtlas

**Scope of this doc:** non-obvious technical and product decisions that constrain future implementation. Trivial conventions (formatter, lint rules) are not recorded here. See `docs/prd.md` for product intent, `docs/data-schema.md` for data shape, `docs/code-architecture.md` for layout.

---

## ADR-1: Living continent map over dashboards or cards
**Date:** 2026-05-13
**Status:** accepted
**Context:** The product's central promise is that users *feel* growth, not measure it. Cards or grids give the same information without the emotional payoff. A real-time analytics dashboard would invite comparison and ranking, which we explicitly reject.
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
- **Territory** — 6 fixed categories (growth direction)
- **Stage** — 5 universal size thresholds `[0, 50, 200, 500, 1500]` on `total_weight` (growth size)
- **Landmark** — per-tech variable elements unlocked by tech-specific weight ≥ 5 (growth identity)
**Alternatives:**
- Single "level" with hand-curated district names per `(territory, level)` — rejected: every user's map looks the same; content-design bottleneck.
- Continuous size scaling with no thresholds — rejected: no discrete "stage up" moments for retention hooks.
**Consequences:** `territories` and `landmarks` are separate tables. Stage tuning can change without content rework. Adding new tech techs requires zero schema change. Visual rendering composes island size (stage) with placed landmarks (count + weight).

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
**Consequences:** Schema is defined in TypeScript in `lib/db/schema/`. Queries compose with type inference but require a small learning curve. Drizzle's migration files are SQL-with-metadata; reviewable in PRs.

---

## ADR-5: Inngest for background jobs
**Date:** 2026-05-13
**Status:** accepted
**Context:** Need durable background jobs for sync, weekly recap generation and fan-out, and recurring crons. Vercel functions are short-lived and don't fit multi-step work.
**Decision:** Inngest for all background work. Use `step.run()` for checkpointed sub-tasks within a job (sync stages, recap fan-out per user).
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
**Consequences:** SPF/DKIM/DMARC must be configured on `devatlas.app` during D0 setup. Template rendering happens server-side. 3k/month free tier is exceeded around 1k weekly users; Pro ($20/month) accepted.

---

## ADR-7: On-demand OG image generation, no Storage
**Date:** 2026-05-13
**Status:** accepted
**Context:** OG images are needed for both public profile shares and weekly recap emails. The same SVG generation code that draws the live map should produce the static image.
**Decision:** Use `@vercel/og` at `/api/og/profile/[username]` and `/api/og/recap/[recap_id]`. Generated per request and CDN-cached. No image is persisted to storage.
**Alternatives:**
- Pre-render and store in Supabase Storage on sync completion — rejected: doubles infrastructure for marginal benefit; storage costs grow with users.
- Server-side Puppeteer screenshot — rejected: slow, expensive, brittle.
**Consequences:** OG endpoints must be rate-limited (60/min/IP + referrer check) to avoid being a DoS vector. Recap IDs are immutable so `/api/og/recap/{id}` can be cached indefinitely. Profile OG cache is invalidated on `users.is_public` toggle and on sync completion.

---

## ADR-8: Supabase Realtime for sync progress
**Date:** 2026-05-13
**Status:** accepted
**Context:** The first reveal experience requires islands to appear as their data is processed. Polling feels lo-fi.
**Decision:** Subscribe the browser to Supabase Realtime on `territories`, `landmarks`, `sync_jobs` for the current user. As the Inngest sync job writes rows, the browser receives push updates and animates each island in.
**Alternatives:**
- 2-second polling — rejected: rough animation timing, more server load.
- Server-Sent Events from a Next.js route — rejected: Vercel function constraints for long-lived connections.
**Consequences:** WebSocket connection cost (up to 200 concurrent on free tier). Realtime publication is selective (only the 3 tables) to bound noise. Fallback to polling not implemented in MVP; if Realtime is down, reveal is delayed but final state still correct because data is in DB.

---

## ADR-9: Activities raw_data restricted to paths + stats + URL
**Date:** 2026-05-13
**Status:** accepted
**Context:** Storing GitHub data has two PII/secrets risks: (a) commit messages, diffs, or PR bodies can contain accidentally committed secrets (API keys, internal URLs); (b) breach surface is larger if we mirror more data than we need.
**Decision:** `activities.raw` JSONB stores only `file_paths`, `additions`, `deletions`, `github_url`. Never commit messages, diffs, PR titles, PR bodies. PR titles needed for the territory drawer are fetched on-demand from GitHub at view time and cached client-side for the session.
**Alternatives:**
- Store PR titles too — rejected: low-value vs medium-risk; users sometimes put credentials in titles.
- Store everything as a cache layer — rejected: turns DevAtlas into a GitHub data leak target.
**Consequences:** Drawer pays a ~3-call GitHub API cost per open (acceptable; ~0.1% of per-user 5k/hr limit). Classifier and scoring depend only on file paths and counts, which is fine for the rule-based design. If we ever want to display commit messages, that decision is made deliberately, not accidentally inherited.

---

## ADR-10: GitHub token encryption with Supabase Vault key
**Date:** 2026-05-13
**Status:** accepted
**Context:** Tokens enable acting as the user against GitHub. They must be encrypted at rest with a key not present in the application database.
**Decision:** `users.github_access_token_enc` and `users.github_refresh_token_enc` are encrypted with pgcrypto symmetric encryption. The encryption key is stored in Supabase Vault (managed KMS). Decryption only happens in server-side sync code.
**Alternatives:**
- Rely on Supabase Auth's `auth.identities` provider tokens — rejected: indirect access pattern, no auto-refresh policy fit.
- Vercel env var holding the key — viable but rotates harder; Vault chosen for cleaner key management.
- External KMS (AWS, GCP) — rejected: extra vendor and IAM setup for MVP.
**Consequences:** Vault enabled as a one-time setup step. Key rotation procedure documented but not automated for MVP.

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
**Context:** Two competing intuitions: (a) "living" worlds should decay if neglected; (b) portfolio value of a DevAtlas requires that what's shared today is still true next month.
**Decision:** Territory and landmark weights only grow. They never decrease. "Recent activity" is signaled visually (glow, "+18% this week" badge) but cumulative state is preserved.
**Alternatives:**
- Decay model with exponential or step decay — rejected: a user who shared their DevAtlas on Twitter, then took a coding break, would feel betrayed when growth disappeared.
- Dual view (lifetime + recent) — rejected: doubles UI complexity for marginal product gain.
**Consequences:** `territories.stage` is monotonically non-decreasing. Backfill jobs (ADR-22) preserve this invariant. Visual recency is computed from `growth_30d` and `stage_changed_at`, not from current size.

---

## ADR-13: Disconnect GitHub preserves map data
**Date:** 2026-05-13
**Status:** accepted
**Context:** Users who disconnect GitHub should be able to reconnect later without losing their map. Forcing a re-sync would re-spend rate-limit budget and lose context.
**Decision:** Disconnect sets `users.github_access_token_enc = NULL` and `users.is_public = false`. All map data (`activities`, `territories`, `landmarks`, `weekly_recaps`) is preserved. Re-OAuth restores sync.
**Alternatives:**
- Cascade delete on disconnect — rejected: ambiguous semantics with delete-account.
- 30-day grace period — rejected: complexity vs benefit unclear; defer to v0.2.
**Consequences:** A "disconnected" state must be representable in UI; map shows last-known state with a banner. Delete-account is the explicit path for full removal.

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
**Status:** accepted
**Context:** `display_username` is unique and used as a URL path. Without reservation, users can claim `settings`, `api`, `admin`, or another user's GitHub login.
**Decision:** Maintain a list of reserved names (system paths). On username change or creation, reject if the requested name is reserved. Exception: a user may set their `display_username` to their own GitHub login even if it appears in any future reservation list (since at signup, their GitHub login is their initial username).
**Alternatives:**
- No reservation list — rejected: breaks routing.
- Reserve famous handles too (microsoft, google) — deferred to v0.2; not blocking and adds complexity.
**Consequences:** The reservation list lives in code (`lib/utils/reserved-usernames.ts`). Adding new system routes requires adding to this list.

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
**Status:** accepted
**Context:** YC application requires concrete activation, share, return-rate numbers. Vercel Analytics gives pageviews but not multi-step funnel.
**Decision:** Install PostHog at v0.1 with product analytics + core funnel events (landing view, OAuth click, repo selection complete, first reveal complete, share click, public toggle). Session replay is limited or disabled initially. Feature flags and A/B testing deferred.
**Alternatives:**
- Custom event logging in Postgres — rejected: build a tiny ad-hoc analytics product just to compute conversion rates.
- Mixpanel, Amplitude — rejected: free tiers less generous than PostHog's 1M events/month.
**Consequences:** `posthog-js` is included in client bundles (small); `posthog-node` used for server-side ingest. Privacy policy must disclose PostHog as a sub-processor.

---

## ADR-19: Sync_jobs is a finite state machine with a 30-minute stuck-cleanup
**Date:** 2026-05-13
**Status:** accepted
**Context:** Worker crashes mid-sync leave `sync_jobs.status = 'running'` forever. Subsequent manual refresh attempts then see "in progress" indefinitely.
**Decision:** Enforce the FSM `pending → running → completed | failed` in application code. A cron runs every 5 minutes and transitions any row stuck in `'running'` for >30 minutes to `'failed'` with `error = 'timeout'`.
**Alternatives:**
- Rely on Inngest's own retry semantics — partial; Inngest retries the *step* but the parent `sync_jobs` row may still be marked running if the job orchestration code never updates it.
- DB trigger on a heartbeat column — rejected: more complexity than scheduled cleanup.
**Consequences:** Adds one cron job. Users who hit timeout see a banner inviting retry. Investigation of repeated timeouts surfaces via Sentry breadcrumbs.

---

## ADR-20: ISR with on-demand revalidation for public profiles
**Date:** 2026-05-13
**Status:** accepted
**Context:** Public profile pages will receive viral spikes (Twitter, LinkedIn). Hitting Supabase on every request is expensive. But fresh data after the owner pushes a commit is part of the value.
**Decision:** Render `/{username}` with ISR 1-hour revalidation. Additionally call `revalidatePath('/${username}')` on (a) sync completion, (b) public toggle, (c) username change. This bounds staleness to "1 hour unless an action invalidates sooner."
**Alternatives:**
- 24-hour ISR — rejected: too stale for users who just tweeted their map.
- Always-SSR — rejected: viral spike costs.
**Consequences:** Three explicit invalidation points must be wired up in the corresponding Server Actions. If they break, staleness is capped at 1 hour anyway.

---

## ADR-21: Test coverage targets classifier and critical paths only
**Date:** 2026-05-13
**Status:** accepted
**Context:** Comprehensive coverage costs MVP velocity. Zero coverage is reckless. The product's correctness pivot is the classifier (if it misclassifies, every downstream feature lies).
**Decision:**
- **Unit (Vitest):** classifier rule engine, scoring formula, stage threshold calc, GitHub parser.
- **Integration (Vitest):** initial sync (mocked GitHub API), OAuth callback flow, weekly recap generation, RLS isolation, public/private visibility.
- **E2E (Playwright):** one smoke test for signup → repo selection → reveal complete.
- Manual smoke for everything else; Sentry catches production regressions.
**Alternatives:**
- Comprehensive E2E — rejected: 2-3 days of test infrastructure cost.
- Zero tests, manual only — rejected: classifier bugs are silent and accumulating.
**Consequences:** Classifier correctness is the highest-priority test surface. RLS regressions are caught early. UI-only regressions may slip into production but are recoverable.

---

## ADR-22: Backfill via re-run, no classifier_version column
**Date:** 2026-05-13
**Status:** accepted
**Context:** When classifier rules or the tech catalog change, existing users' maps reflect the old rules until they re-sync. Naively, we'd version every classification, but at MVP scale this adds complexity.
**Decision:** Provide a backfill job (`features/sync/backfill.ts`) triggered via Inngest manually by an admin. It re-classifies all activities for a user (or globally) and re-writes `activity_territories`, `territories`, `landmarks`. No `classifier_version` column.
**Alternatives:**
- Versioned classification with mixed-version aggregation — rejected: YAGNI at MVP scale.
- Skip backfill entirely; new rules apply only to new activities — rejected: existing users see stale state, and rule changes are tested with cold starts.
**Consequences:** Backfill is an admin-only operation. Activities table must retain enough raw data (file paths, stats) to support re-classification — this is already enforced by ADR-9.

---

## ADR-23: Hybrid `lib/` + `features/` code organization
**Date:** 2026-05-13
**Status:** accepted
**Context:** Pure layer-based (`/lib/db`, `/lib/github`, `/lib/territory`) becomes unwieldy as the project grows. Pure feature-based requires deciding upfront where shared utilities go.
**Decision:** Hybrid. `lib/` for cross-cutting utilities (db client, github client, email client, og components, auth, analytics). `features/` for domain logic (`sync/`, `territories/`, `recap/`). Dependency direction is `app → features → lib`, never reverse.
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
**Status:** accepted
**Context:** Launch requires legal docs. Lawyer review is overkill pre-revenue; paid tools (Termly, iubenda) cost $15-50/month.
**Decision:** Self-write Privacy Policy and Terms of Service for launch, modeled on open-source templates. Migrate to a paid tool (Termly or similar) when one of: monetization launches, sensitive data is collected, enterprise customer arrives.
**Alternatives:**
- Paid tool from day 1 — rejected: cost without immediate benefit.
- Lawyer review from day 1 — rejected: $500-2000 cost, premature.
**Consequences:** Founder owns drafting. Must explicitly disclose sub-processors (Supabase, Vercel, Inngest, Resend, Sentry, PostHog), GDPR data deletion procedure, and GitHub data usage scope (no resale, no bulk export, used within user consent).
