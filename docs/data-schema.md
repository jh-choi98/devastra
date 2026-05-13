# Data Schema — DevAtlas

**Scope of this doc:** entities, fields, constraints, relationships, indexes, retention. PostgreSQL via Supabase. ORM is Drizzle (`docs/code-architecture.md` §Layers). For *why* this shape, see `docs/adr.md`.

All tables live in the `public` schema with Row Level Security enabled. `auth.users` is managed by Supabase Auth.

## Entities

### Users

| field | type | nullable | constraint / note |
|---|---|---|---|
| id | uuid | no | PK, REFERENCES `auth.users(id)` ON DELETE CASCADE, set by `handle_new_user` trigger on auth signup |
| github_id | bigint | no | UNIQUE, immutable, GitHub's stable numeric ID |
| github_login | text | no | immutable, GitHub login string, used in API URLs |
| display_username | text | no | UNIQUE, mutable, used in `/{username}`; regex `^[a-z0-9-_]+$`, length 2-30; reserved-name check (see `docs/adr.md` ADR-15) |
| email | text | no | from GitHub `user:email` scope; never exposed via `users_public_view` |
| avatar_url | text | yes | GitHub avatar URL |
| timezone | text | no | IANA tz, default `'UTC'` |
| is_public | boolean | no | default `false`; controls `/{username}` visibility |
| email_recap_enabled | boolean | no | default `true` |
| github_access_token_enc | bytea | yes | pgcrypto-encrypted; key from Supabase Vault; NULL after disconnect |
| github_refresh_token_enc | bytea | yes | same encryption scheme |
| github_token_expires_at | timestamptz | yes | for JIT refresh check |
| last_event_id | text | yes | GitHub events API cursor for incremental sync |
| last_incremental_sync_at | timestamptz | yes | observability |
| last_login_at | timestamptz | yes | drives first-time vs returning reveal animation choice |
| created_at | timestamptz | no | default `now()` |

Public-facing access goes through `users_public_view` which selects only `id`, `display_username`, `avatar_url`, `is_public`, `created_at`. Tokens, email, sync state, and settings flags are never in the view.

### Repositories

| field | type | nullable | constraint / note |
|---|---|---|---|
| id | uuid | no | PK |
| user_id | uuid | no | FK → `users.id` ON DELETE CASCADE |
| source | text | no | default `'github'`; supports future `'gitlab'`, `'bitbucket'` (see `docs/adr.md` ADR-16) |
| external_repo_id | text | no | source-internal stable ID |
| owner | text | no | e.g. `'vercel'` |
| name | text | no | e.g. `'next.js'` |
| primary_language | text | yes | reported by source |
| is_included | boolean | no | default `true`; toggled in Settings |
| last_synced_at | timestamptz | yes | per-repo sync watermark |
| created_at | timestamptz | no | default `now()` |

Composite UNIQUE `(user_id, source, external_repo_id)`.

### Activities

| field | type | nullable | constraint / note |
|---|---|---|---|
| id | uuid | no | PK |
| user_id | uuid | no | FK → `users.id` ON DELETE CASCADE |
| repo_id | uuid | no | FK → `repositories.id` ON DELETE CASCADE |
| source | text | no | default `'github'` |
| external_id | text | no | commit SHA, PR node ID, or issue node ID |
| type | text | no | one of `'commit'`, `'pr'`, `'issue'` |
| occurred_at | timestamptz | no | source timestamp |
| raw | jsonb | no | restricted schema (see below) |
| created_at | timestamptz | no | default `now()` |

`raw` schema is enforced in application write path (`docs/adr.md` ADR-11):

```jsonc
{
  "file_paths": ["src/api/auth.ts"],   // for classifier
  "additions": 42,                      // for scoring weight modulation (future)
  "deletions": 12,
  "github_url": "https://github.com/owner/repo/commit/abc"
}
```

`raw` MUST NOT contain commit messages, diffs, PR titles, PR bodies, or any prose user content. PR titles for the drawer are fetched on-demand from GitHub.

Composite UNIQUE `(user_id, source, external_id)`.

### Activity_Territories

Multi-label join. One activity contributes to one or more territories with per-territory weight.

| field | type | nullable | constraint / note |
|---|---|---|---|
| activity_id | uuid | no | FK → `activities.id` ON DELETE CASCADE |
| territory_type | text | no | enum-by-convention: `frontend_land` \| `backend_fortress` \| `data_pipeline_zone` \| `testing_lab` \| `devops_harbor` \| `docs_library` |
| weight | numeric | no | computed by classifier: `(commit=1 \| pr=5 \| issue=2) × territory_affinity ∈ [0.5, 1.0]` |

PK `(activity_id, territory_type)`.

### Territories

Denormalized per-user state for read-path performance. Recomputed at the end of every sync run.

| field | type | nullable | constraint / note |
|---|---|---|---|
| user_id | uuid | no | FK → `users.id` ON DELETE CASCADE |
| type | text | no | same enum as `activity_territories.territory_type` |
| total_weight | numeric | no | default `0`; `SUM(activity_territories.weight)` over user's activities mapped to this type |
| stage | int | no | default `1`; computed from `total_weight` using thresholds `[0, 50, 200, 500, 1500]` |
| stage_changed_at | timestamptz | yes | updated only when `stage` value changes; used by weekly recap diff |
| last_grown_at | timestamptz | yes | timestamp of most recent activity contributing weight |
| growth_30d | numeric | no | default `0`; sum of weights from activities with `occurred_at > NOW() - 30 days`; recomputed each sync |
| created_at | timestamptz | no | default `now()` |

PK `(user_id, type)`.

### Landmarks

Per-user × tech_key. A landmark unlocks when cumulative weight from activities matching that tech crosses 5.

| field | type | nullable | constraint / note |
|---|---|---|---|
| user_id | uuid | no | FK → `users.id` ON DELETE CASCADE |
| tech_key | text | no | code-level catalog key (see `docs/code-architecture.md` §Features → territories) |
| territory_type | text | no | parent territory; redundant with catalog but stored for query convenience |
| weight | numeric | no | default `0`; cumulative weight, controls visual icon size |
| first_unlocked_at | timestamptz | yes | NULL until weight ≥ 5; set once and never updated |
| last_grown_at | timestamptz | yes | most recent contributing activity timestamp |

PK `(user_id, tech_key)`. Index on `(user_id, territory_type)`.

### Sync_Jobs

| field | type | nullable | constraint / note |
|---|---|---|---|
| id | uuid | no | PK |
| user_id | uuid | no | FK → `users.id` ON DELETE CASCADE |
| kind | text | no | one of `'initial'`, `'incremental'`, `'manual'`, `'backfill'` |
| status | text | no | FSM: `'pending'` → `'running'` → `'completed'` \| `'failed'` |
| progress | jsonb | yes | shape: `{ repos_analyzed: int, total: int, current_step: text }` |
| started_at | timestamptz | yes | set when status → `'running'` |
| completed_at | timestamptz | yes | set when status → `'completed'` or `'failed'` |
| error | text | yes | when status → `'failed'` |
| created_at | timestamptz | no | default `now()` |

A cron auto-fails rows stuck in `'running'` for >30 minutes (`docs/adr.md` ADR-19). 5-minute manual refresh cooldown enforced via `MAX(started_at)` check per user.

### Weekly_Recaps

| field | type | nullable | constraint / note |
|---|---|---|---|
| id | uuid | no | PK |
| user_id | uuid | no | FK → `users.id` ON DELETE CASCADE |
| week_start | date | no | Monday 00:00 UTC of the recap week |
| highlights | jsonb | no | `{ top_growth: {territory, pct}, new_landmarks: [tech_key], stage_ups: [{territory, from, to}], stats: {active_days, prs_shipped} }` |
| og_image_url | text | yes | resolves to `/api/og/recap/{id}` (no Storage; CDN-cached) |
| email_sent_at | timestamptz | yes | set when Resend confirms send |
| created_at | timestamptz | no | default `now()` |

Composite UNIQUE `(user_id, week_start)`.

### Email_Sends

Idempotency + GDPR audit log.

| field | type | nullable | constraint / note |
|---|---|---|---|
| id | uuid | no | PK |
| user_id | uuid | no | FK → `users.id` ON DELETE CASCADE |
| email_type | text | no | e.g. `'weekly_recap_active'`, `'weekly_recap_empty'` |
| related_id | uuid | yes | e.g. `weekly_recaps.id` |
| external_message_id | text | yes | Resend message ID for delivery tracking |
| bounced | boolean | no | default `false`; updated by Resend bounce webhook |
| sent_at | timestamptz | no | default `now()` |

After 3 consecutive bounces for one user, `users.email_recap_enabled` is auto-set to `false`.

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
    └── (1:N) → email_sends
```

CASCADE delete from `auth.users` removes all user data atomically.

## Indexes

| Index | Purpose |
|---|---|
| `users(github_id) UNIQUE` | auth callback lookup |
| `users(display_username) UNIQUE` | `/{username}` resolution |
| `repositories(user_id, is_included)` | sync filtering |
| `repositories(user_id, source, external_repo_id) UNIQUE` | idempotent UPSERT |
| `activities(user_id, occurred_at DESC)` | drawer recent-N queries, growth_30d window scan |
| `activities(repo_id, occurred_at DESC)` | repo-scoped recompute on include/exclude toggle |
| `activities(user_id, source, external_id) UNIQUE` | sync idempotency |
| `sync_jobs(user_id, started_at DESC)` | cooldown check |
| `landmarks(user_id, territory_type)` | drawer aggregation |
| `weekly_recaps(user_id, week_start) UNIQUE` | recap idempotency |
| `email_sends(user_id, sent_at DESC)` | bounce-rate check |

## Realtime publication

Supabase Realtime publication includes `territories`, `landmarks`, `sync_jobs` only. `activities` is excluded as too high-volume; the denorm tables capture all UI-relevant change.

## RLS policies (summary; full SQL lives in migrations)

| Table | Policy |
|---|---|
| `users` | SELECT: self OR (`is_public = true` via `users_public_view`). UPDATE: self only. |
| `repositories`, `activities`, `sync_jobs`, `email_sends` | self only (full lifecycle) |
| `activity_territories` | SELECT: via parent `activities` policy |
| `territories`, `landmarks` | SELECT: self OR `(user_id IN public users)`. UPDATE: server-side service role only |
| `weekly_recaps` | SELECT: self only. INSERT/UPDATE: server-side service role only |

## Retention & lifecycle

- All activity data retained for the lifetime of the user account.
- On `users` row delete (via `auth.users` cascade), all child rows are removed.
- `email_sends` rows are retained for delivery-tracking; they cascade with user delete (acceptable trade-off for MVP simplicity over strict log-retention compliance).
- `sync_jobs` rows are retained for observability; no scheduled cleanup yet.

## Encryption & secrets

- `users.github_access_token_enc` and `users.github_refresh_token_enc` use pgcrypto symmetric encryption. The key is provisioned via Supabase Vault and never resides in the application database tables.
- Decryption happens server-side only, inside sync execution. Tokens never appear in API responses, server logs (Sentry `beforeSend` scrubs), or client bundles.

## Migrations

Drizzle Kit. Migration files are committed to the repo and applied manually with `drizzle-kit migrate` before each production deploy. Schema is split by feature in `lib/db/schema/*.ts` (see `docs/code-architecture.md`).

## Source-agnostic design

`source` + `external_id` columns on `activities` and `repositories` allow future non-GitHub sources (GitLab, Bitbucket) to be added without schema migration — only a new `SourceClient` implementation and tech-catalog entries. See `docs/adr.md` ADR-16.
