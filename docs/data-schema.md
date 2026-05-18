# Data Schema — DevAstra

**Scope of this doc:** entities, fields, constraints, relationships, indexes, retention. PostgreSQL via Supabase. ORM is Drizzle (`docs/code-architecture.md` §Layers). For _why_ this shape, see `docs/adr.md`. For _user-facing UI mapping_, see `docs/screens.md`.

All tables live in the `public` schema with Row Level Security enabled. `auth.users` is managed by Supabase Auth.

**Internal vs UI naming.** Tables retain pre-pivot names — `territories` (UI: clusters), `landmarks` (UI: stars), `territory_type` (UI: cluster domain). The pivot intentionally did not rename columns; UI surface uses constellation language while the data model stays stable (`docs/adr.md` ADR-26).

## Entities

### Users

| field                        | type        | nullable | constraint / note                                                                                                          |
| ---------------------------- | ----------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| id                           | uuid        | no       | PK, REFERENCES `auth.users(id)` ON DELETE CASCADE, set by `handle_new_user` trigger on auth signup                         |
| github_id                    | bigint      | no       | UNIQUE, immutable, GitHub's stable numeric ID                                                                              |
| github_login                 | text        | no       | immutable, GitHub login string, used in API URLs                                                                           |
| display_username             | text        | no       | UNIQUE, mutable, used in `/{username}`; regex `^[a-z0-9-_]+$`, length 2–30; reserved-name check (see `docs/adr.md` ADR-15) |
| email                        | text        | no       | from GitHub `user:email` scope; never exposed via `users_public_view`                                                      |
| avatar_url                   | text        | yes      | GitHub avatar URL                                                                                                          |
| timezone                     | text        | no       | IANA tz, default `'UTC'`                                                                                                   |
| is_public                    | boolean     | no       | default `false`; controls `/{username}` visibility                                                                         |
| email_recap_enabled          | boolean     | no       | default `true`                                                                                                             |
| github_access_token_enc      | bytea       | yes      | pgcrypto-encrypted; key from Supabase Vault; NULL after disconnect                                                         |
| github_refresh_token_enc     | bytea       | yes      | same encryption scheme                                                                                                     |
| github_token_expires_at      | timestamptz | yes      | for JIT refresh check                                                                                                      |
| last_event_id                | text        | yes      | GitHub events API cursor for incremental sync                                                                              |
| last_incremental_sync_at     | timestamptz | yes      | observability                                                                                                              |
| last_login_at                | timestamptz | yes      | drives first-time vs returning reveal animation choice + long-absence (≥4 weeks) detection                                 |
| cluster_click_hint_seen      | boolean     | no       | default `false`; ADR-41 hint lifecycle                                                                                     |
| share_hint_seen              | boolean     | no       | default `false`; ADR-41                                                                                                    |
| recap_diff_hint_seen         | boolean     | no       | default `false`; ADR-41                                                                                                    |
| first_star_cinematic_seen    | boolean     | no       | default `false`; ADR-38 (set after cinematic plays)                                                                        |
| first_star_cinematic_pending | boolean     | no       | default `false`; set by sync on 0→≥1 transition; cleared after cinematic plays (ADR-38)                                    |
| created_at                   | timestamptz | no       | default `now()`                                                                                                            |

Public-facing access goes through `users_public_view` which selects only `id`, `display_username`, `avatar_url`, `is_public`, `created_at`. The view must be created with `security_invoker = true` so callers keep the privileges and RLS posture of the querying role; Supabase Security Advisor flags security-definer public views. Tokens, email, sync state, settings flags, and hint flags are never in the view.

### Repositories

| field                                 | type        | nullable | constraint / note                                                                                                  |
| ------------------------------------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| id                                    | uuid        | no       | PK                                                                                                                 |
| user_id                               | uuid        | no       | FK → `users.id` ON DELETE CASCADE                                                                                  |
| source                                | text        | no       | default `'github'`; supports future `'gitlab'`, `'bitbucket'` (see `docs/adr.md` ADR-16)                           |
| external_repo_id                      | text        | no       | source-internal stable ID                                                                                          |
| owner                                 | text        | no       | e.g. `'vercel'`                                                                                                    |
| name                                  | text        | no       | e.g. `'next.js'`                                                                                                   |
| primary_language                      | text        | yes      | reported by source; used as a low-confidence fallback signal only after path and manifest evidence                 |
| is_included                           | boolean     | no       | default `true`; toggled in Settings                                                                                |
| source_pushed_at                      | timestamptz | yes      | source-reported last push timestamp; used to validate manifest dependency cache before reuse                       |
| manifest_context                      | jsonb       | yes      | parsed dependency names only, grouped by manifest type; never stores manifest file contents                        |
| manifest_source_pushed_at             | timestamptz | yes      | `source_pushed_at` value the manifest cache was validated against                                                  |
| manifest_cached_at                    | timestamptz | yes      | when `manifest_context` was written                                                                                |
| historical_bootstrap_source_pushed_at | timestamptz | yes      | `source_pushed_at` value the quiet-repo historical bootstrap was validated against                                 |
| historical_bootstrap_checked_at       | timestamptz | yes      | when the historical bootstrap cache marker was written                                                             |
| commits_fetched_source_pushed_at      | timestamptz | yes      | `source_pushed_at` value the recent authored commit list was validated against; reused only by exact instant match |
| last_synced_at                        | timestamptz | yes      | per-repo sync watermark                                                                                            |
| created_at                            | timestamptz | no       | default `now()`                                                                                                    |

Composite UNIQUE `(user_id, source, external_repo_id)`.

### Activities

| field       | type        | nullable | constraint / note                                                       |
| ----------- | ----------- | -------- | ----------------------------------------------------------------------- |
| id          | uuid        | no       | PK                                                                      |
| user_id     | uuid        | no       | FK → `users.id` ON DELETE CASCADE                                       |
| repo_id     | uuid        | no       | FK → `repositories.id` ON DELETE CASCADE                                |
| source      | text        | no       | default `'github'`                                                      |
| external_id | text        | no       | commit SHA, PR node ID, or issue node ID                                |
| type        | text        | no       | one of `'commit'`, `'pr'`, `'issue'`                                    |
| occurred_at | timestamptz | no       | source timestamp; initial sync window capped at NOW() - 1 year (ADR-50) |
| raw         | jsonb       | no       | restricted schema (see below)                                           |
| created_at  | timestamptz | no       | default `now()`                                                         |

`raw` schema is enforced in the application write path (`docs/adr.md` ADR-9):

```jsonc
{
  "file_paths": ["src/api/auth.ts"], // for classifier
  "additions": 42, // for scoring weight modulation (future)
  "deletions": 12,
  "github_url": "https://github.com/owner/repo/commit/abc",
}
```

`raw` MUST NOT contain commit messages, diffs, PR titles, PR bodies, or any prose user content. PR titles for the drawer are fetched on-demand from GitHub.

Composite UNIQUE `(user_id, source, external_id)`.

### Activity_Territories

Multi-label join. One activity contributes to one or more territories (clusters) with per-territory weight.

| field          | type    | nullable | constraint / note                                                                                                                       |
| -------------- | ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| activity_id    | uuid    | no       | FK → `activities.id` ON DELETE CASCADE                                                                                                  |
| territory_type | text    | no       | enum-by-convention: `frontend_land` \| `backend_fortress` \| `data_pipeline_zone` \| `testing_lab` \| `devops_harbor` \| `docs_library` |
| weight         | numeric | no       | computed by classifier: `(commit=1 \| pr=5 \| issue=2) × territory_affinity ∈ [0.5, 1.0]`                                               |
| tech_keys      | text[]  | no       | catalog `tech_key`s this activity matched inside the territory; used for star-specific drawer attribution                               |

PK `(activity_id, territory_type)`.

### Territories

Denormalized per-user state for read-path performance. Recomputed at the end of every sync run.

| field            | type        | nullable | constraint / note                                                                                      |
| ---------------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------ |
| user_id          | uuid        | no       | FK → `users.id` ON DELETE CASCADE                                                                      |
| type             | text        | no       | same enum as `activity_territories.territory_type`                                                     |
| total_weight     | numeric     | no       | default `0`; `SUM(activity_territories.weight)` over user's activities mapped to this type             |
| stage            | int         | no       | default `1`; computed from `total_weight` using thresholds `[0, 50, 200, 500, 1500]`                   |
| stage_changed_at | timestamptz | yes      | updated only when `stage` value changes; used by weekly recap diff and stage-up moment                 |
| last_grown_at    | timestamptz | yes      | timestamp of most recent activity contributing weight                                                  |
| growth_30d       | numeric     | no       | default `0`; sum of weights from activities with `occurred_at > NOW() - 30 days`; recomputed each sync |
| created_at       | timestamptz | no       | default `now()`                                                                                        |

PK `(user_id, type)`.

### Landmarks

Per-user × `tech_key` row. A landmark unlocks (UI: a star "lights") when cumulative weight from activities matching that tech crosses 5.

| field             | type        | nullable | constraint / note                                                         |
| ----------------- | ----------- | -------- | ------------------------------------------------------------------------- |
| user_id           | uuid        | no       | FK → `users.id` ON DELETE CASCADE                                         |
| tech_key          | text        | no       | catalog key (see `docs/tech-catalog.md`)                                  |
| territory_type    | text        | no       | parent territory; redundant with catalog but stored for query convenience |
| weight            | numeric     | no       | default `0`; cumulative weight, controls visual star size/glow            |
| first_unlocked_at | timestamptz | yes      | NULL until weight ≥ 5; set once and never updated                         |
| last_grown_at     | timestamptz | yes      | most recent contributing activity timestamp                               |

PK `(user_id, tech_key)`. Index on `(user_id, territory_type)`.

A user's _lit_star_count_ is `COUNT(*) WHERE user_id = X AND first_unlocked_at IS NOT NULL`. The transition `lit_star_count: 0 → ≥1` is detected during sync and stored in `users.first_star_cinematic_pending` (ADR-38).

### Sync_Jobs

| field        | type        | nullable | constraint / note                                                |
| ------------ | ----------- | -------- | ---------------------------------------------------------------- |
| id           | uuid        | no       | PK                                                               |
| user_id      | uuid        | no       | FK → `users.id` ON DELETE CASCADE                                |
| kind         | text        | no       | one of `'initial'`, `'incremental'`, `'manual'`, `'backfill'`    |
| status       | text        | no       | FSM: `'pending'` → `'running'` → `'completed'` \| `'failed'`     |
| progress     | jsonb       | yes      | shape: `{ repos_analyzed: int, total: int, current_step: text }` |
| started_at   | timestamptz | yes      | set when status → `'running'`                                    |
| completed_at | timestamptz | yes      | set when status → `'completed'` or `'failed'`                    |
| error        | text        | yes      | when status → `'failed'`                                         |
| created_at   | timestamptz | no       | default `now()`                                                  |

A cron auto-fails rows stuck in `'running'` for >30 minutes (`docs/adr.md` ADR-19). 5-minute manual refresh cooldown enforced via `MAX(started_at)` check per user.

### Weekly_Recaps

| field         | type        | nullable | constraint / note                                                               |
| ------------- | ----------- | -------- | ------------------------------------------------------------------------------- |
| id            | uuid        | no       | PK                                                                              |
| user_id       | uuid        | no       | FK → `users.id` ON DELETE CASCADE                                               |
| week_start    | date        | no       | Monday 00:00 UTC of the recap week                                              |
| highlights    | jsonb       | no       | slot-based shape (see below)                                                    |
| og_image_url  | text        | yes      | resolves to `/api/og/recap/{id}?v={OG_RENDER_VERSION}` (no Storage; CDN-cached) |
| email_sent_at | timestamptz | yes      | set when Resend confirms send                                                   |
| created_at    | timestamptz | no       | default `now()`                                                                 |

`highlights` JSONB shape (preserved at generation time, consumed by email template + OG image):

```jsonc
{
  "kind": "active" | "empty" | "first_week",
  "slot_1": {
    "kind": "stage_up" | "brightest_cluster",
    "cluster_type": "backend_fortress",
    "from_stage": 1,                // when kind = stage_up
    "to_stage": 2,                  // when kind = stage_up
    "growth_pct": 18                // when kind = brightest_cluster
  },
  "slot_2": {
    "kind": "new_stars" | "brightened_stars",
    "tech_keys": ["docker", "typescript"]
  },
  "slot_3": {
    "kind": "activity",
    "active_days": 5,
    "commits": 12,
    "prs_shipped": 3
  },
  "subject_pick": "stage_up_backend_fortress",  // for ADR-35 audit and dedup
  "preview_text": "Backend expanded · 2 new stars · 12 commits"
}
```

Composite UNIQUE `(user_id, week_start)`.

### Email_Sends

Idempotency + GDPR audit log.

| field               | type        | nullable | constraint / note                                                                   |
| ------------------- | ----------- | -------- | ----------------------------------------------------------------------------------- |
| id                  | uuid        | no       | PK                                                                                  |
| user_id             | uuid        | no       | FK → `users.id` ON DELETE CASCADE                                                   |
| email_type          | text        | no       | one of `'weekly_recap_active'`, `'weekly_recap_empty'`, `'weekly_recap_first_week'` |
| related_id          | uuid        | yes      | e.g. `weekly_recaps.id`                                                             |
| external_message_id | text        | yes      | Resend message ID for delivery tracking                                             |
| bounced             | boolean     | no       | default `false`; updated by Resend bounce webhook                                   |
| sent_at             | timestamptz | no       | default `now()`                                                                     |

After 3 consecutive bounces for one user, `users.email_recap_enabled` is auto-set to `false`.

### Username_History

Tracks past usernames for permanent 301 redirect (`docs/adr.md` ADR-30).

| field        | type        | nullable | constraint / note                       |
| ------------ | ----------- | -------- | --------------------------------------- |
| old_username | text        | no       | PK; lowercase per regex `^[a-z0-9-_]+$` |
| user_id      | uuid        | no       | FK → `users.id` ON DELETE CASCADE       |
| changed_at   | timestamptz | no       | default `now()`                         |

On username change: row inserted with the old value. On account delete: rows cascade-removed (the names remain in the reserved set via application logic — see ADR-30).

### Misclassification_Feedback

Forward-only audit log for classifier improvement signal (`docs/adr.md` ADR-40).

| field           | type        | nullable | constraint / note                                                                     |
| --------------- | ----------- | -------- | ------------------------------------------------------------------------------------- |
| id              | uuid        | no       | PK                                                                                    |
| user_id         | uuid        | no       | FK → `users.id` ON DELETE CASCADE                                                     |
| tech_key        | text        | no       | the star the user flagged                                                             |
| territory_type  | text        | no       | parent cluster of that star                                                           |
| related_repo_id | uuid        | yes      | FK → `repositories.id` ON DELETE SET NULL; the repo the user thinks was misclassified |
| category        | text        | no       | enum: `'wrong_category'` \| `'shouldnt_be_lit'` \| `'not_mine'` \| `'other'`          |
| note            | text        | yes      | optional free text from user                                                          |
| created_at      | timestamptz | no       | default `now()`                                                                       |

Indexes: `(user_id, created_at DESC)` (for rate-limit check), `(tech_key, created_at DESC)` (for founder triage queries).

**Rate limit:** application-level — max 5 inserts per `user_id` per 24h. Enforced in Server Action before INSERT.

**RLS:** INSERT self only; SELECT denied to all (admin reads via service role; see `docs/adr.md` ADR-40).

### Tech_Global_Stats

Daily-computed global rarity for stars (`docs/adr.md` ADR-28). Skeleton present in MVP; UI hidden until `eligible_user_count ≥ 500`.

| field               | type        | nullable | constraint / note                                                                       |
| ------------------- | ----------- | -------- | --------------------------------------------------------------------------------------- |
| tech_key            | text        | no       | PK                                                                                      |
| lit_user_count      | int         | no       | default `0`; count of users with `landmarks` row having `first_unlocked_at IS NOT NULL` |
| eligible_user_count | int         | no       | default `0`; count of users with ≥1 lit star (gate threshold)                           |
| lit_percentage      | numeric     | no       | default `0`; `lit_user_count / eligible_user_count * 100`, rounded to 1 decimal         |
| computed_at         | timestamptz | yes      | nullable until first batch run                                                          |

Batch job runs daily via Inngest cron. RLS: SELECT public; writes via service role only.

### System_Messages

Founder-managed banner content for incident communication (`docs/adr.md` ADR-42).

| field      | type        | nullable | constraint / note                                            |
| ---------- | ----------- | -------- | ------------------------------------------------------------ |
| id         | uuid        | no       | PK                                                           |
| message    | text        | no       | banner text (1–200 chars)                                    |
| severity   | text        | no       | enum: `'info'` \| `'warning'` \| `'error'`; default `'info'` |
| active     | boolean     | no       | default `true`; set false to retire a message                |
| created_at | timestamptz | no       | default `now()`                                              |
| expires_at | timestamptz | yes      | optional auto-expiry                                         |

Queried by main constellation page render. Multiple active rows → highest severity wins; ties broken by `created_at DESC`. RLS: SELECT public; writes via service role only (founder uses Supabase dashboard SQL, ADR-42).

## Relationships

```
auth.users (Supabase Auth)
    │  (1:1, trigger-created)
    ▼
users
    ├── (1:N) → repositories
    ├── (1:N) → activities ── (1:N) → activity_territories
    ├── (1:N) → territories          (denorm; rebuilt from activity_territories)
    ├── (1:N) → landmarks            (denorm; rebuilt from activities + tech catalog)
    ├── (1:N) → sync_jobs
    ├── (1:N) → weekly_recaps
    ├── (1:N) → email_sends
    ├── (1:N) → username_history
    └── (1:N) → misclassification_feedback

tech_global_stats              (global; not per-user)
system_messages                (global; founder-managed)
```

CASCADE delete from `auth.users` removes all user-scoped data atomically. Hard delete with no soft-window (ADR-31).

## Indexes

| Index                                                    | Purpose                                                                |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| `users(github_id) UNIQUE`                                | auth callback lookup                                                   |
| `users(display_username) UNIQUE`                         | `/{username}` resolution                                               |
| `repositories(user_id, is_included)`                     | sync filtering                                                         |
| `repositories(user_id, source, external_repo_id) UNIQUE` | idempotent UPSERT                                                      |
| `activities(user_id, occurred_at DESC)`                  | drawer recent-N queries, growth_30d window scan, since-last-visit diff |
| `activities(repo_id, occurred_at DESC)`                  | repo-scoped recompute on include/exclude toggle                        |
| `activities(user_id, source, external_id) UNIQUE`        | sync idempotency                                                       |
| `sync_jobs(user_id, started_at DESC)`                    | cooldown check                                                         |
| `landmarks(user_id, territory_type)`                     | drawer aggregation                                                     |
| `weekly_recaps(user_id, week_start) UNIQUE`              | recap idempotency                                                      |
| `email_sends(user_id, sent_at DESC)`                     | bounce-rate check                                                      |
| `username_history(old_username) UNIQUE`                  | profile URL redirect lookup                                            |
| `misclassification_feedback(user_id, created_at DESC)`   | rate-limit check                                                       |
| `misclassification_feedback(tech_key, created_at DESC)`  | triage queries                                                         |
| `tech_global_stats(tech_key) PK`                         | per-star lookup at drawer/recap time                                   |

## Realtime publication

Supabase Realtime publication includes `territories`, `landmarks`, `sync_jobs` only. `activities` is excluded as too high-volume; the denorm tables capture all UI-relevant change.

`users` is NOT added to Realtime — the hint flags + cinematic pending flag are queried on page load, not streamed (ADR-43 surface-minimization).

## RLS policies (summary; full SQL in `drizzle/migrations/`)

| Table                                                    | Policy                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `users`                                                  | SELECT: self OR (`is_public = true` via `users_public_view`). UPDATE: self only.           |
| `repositories`, `activities`, `sync_jobs`, `email_sends` | self only (full lifecycle)                                                                 |
| `activity_territories`                                   | SELECT: via parent `activities` policy                                                     |
| `territories`, `landmarks`                               | SELECT: self OR `(user_id IN public users)`. UPDATE: server-side service role only         |
| `weekly_recaps`                                          | SELECT: self only. INSERT/UPDATE: server-side service role only                            |
| `username_history`                                       | SELECT: anon (for redirect resolution). INSERT/UPDATE/DELETE: service role only            |
| `misclassification_feedback`                             | INSERT: self only. SELECT/UPDATE/DELETE: service role only (admin triage)                  |
| `tech_global_stats`                                      | SELECT: anon (public rarity). INSERT/UPDATE: service role only (batch job)                 |
| `system_messages`                                        | SELECT: anon. INSERT/UPDATE/DELETE: service role only (founder via Supabase dashboard SQL) |

**Important — RLS bypass via Drizzle direct connection (ADR-46).** Queries through `lib/db/client.ts` use the postgres role and bypass RLS entirely. The application layer is the sole filter. New queries against `landmarks`, `territories`, `activities`, `email_sends`, `misclassification_feedback`, or `weekly_recaps` MUST scope by `user_id` — use the `withUserScope(userId)` helper in `lib/db/queries/_helpers.ts` as guard rail.

## Retention & lifecycle

- All activity data retained for the lifetime of the user account.
- Initial sync window capped at last 1 year of activity (ADR-50). Deeper history is not pulled; users see their full constellation grow over time.
- On `users` row delete (via `auth.users` cascade), all child rows are removed.
- `email_sends` rows are retained for delivery tracking; they cascade with user delete (acceptable trade-off for MVP simplicity over strict log-retention compliance).
- `sync_jobs` rows are retained for observability; no scheduled cleanup yet.
- `username_history` retained permanently with `user_id` (per ADR-30); cascades on user delete (the old name becomes available for future signup at that point — explicit choice).
- `tech_global_stats` rows are upserted by daily batch; never deleted.

## Encryption & secrets

- `users.github_access_token_enc` and `users.github_refresh_token_enc` use pgcrypto symmetric encryption. The key is provisioned via Supabase Vault and never resides in the application database tables.
- The Vault secret name is `devastra_token_encryption_key`. It is a database-managed Vault entry, not a `.env.local` value. Do not rename it after users have encrypted tokens unless a dedicated key-migration procedure re-encrypts existing values.
- Decryption happens server-side only, inside sync execution. Tokens never appear in API responses, server logs (Sentry `beforeSend` scrubs — ADR-49), or client bundles.

## Migrations

Drizzle Kit. Migration files are committed to the repo and applied manually with `drizzle-kit migrate` before each production deploy. Schema is split by feature in `lib/db/schema/*.ts` (see `docs/code-architecture.md`).

Pivot migrations are **add-only** (ADR — `docs/adr.md` ADR-51): new columns have safe defaults, new tables are independent. No drops or column renames; backward-compat code can run during deploy gap.

## Source-agnostic design

`source` + `external_id` columns on `activities` and `repositories` allow future non-GitHub sources (GitLab, Bitbucket) to be added without schema migration — only a new `SourceClient` implementation and tech-catalog entries. See `docs/adr.md` ADR-16.

## Connection pooling

`DATABASE_URL` points to Supabase's transaction-mode pooler (`:6543`). `DIRECT_URL` (used only by `drizzle-kit` migrations) points to direct connection (`:5432`).

`postgres-js` driver must be configured with `prepare: false` because transaction-mode pooler does not support session-bound prepared statements (`docs/adr.md` ADR-51).

Runtime code must not use the direct `:5432` connection string. Local real-GitHub E2E can open many short-lived RSC, Server Action, and Inngest requests at once; using the direct connection at runtime can hit Supabase session limits before the app has a chance to recover.
