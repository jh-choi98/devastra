# Phase 1: Schema Migration & DB Foundation

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/prd.md`
- `/docs/data-schema.md` (Entities · Indexes · RLS · Connection pooling)
- `/docs/code-architecture.md` §Layers · §RLS bypass · §External dependencies · §Configuration & secrets
- `/docs/adr.md` ADR-46 (RLS bypass policy) · ADR-51 (add-only + pooler) · ADR-57 (manual gate)
- `/CLAUDE.md` (server-only · idempotency · migrations are add-only)
- `/tasks/1-pivot-mvp/docs-diff.md` (this task's documentation change record)

Then verify Phase 0's output:

- All pivot docs are committed (HEAD has them)
- `git status` is clean
- `lib/db/schema/users.ts` and other schema files exist with pre-pivot shape

Carefully read the code from previous phases. Understand the design intent before working.

## Work

This phase introduces all data-layer changes needed for the pivot. It is **add-only** (ADR-51) — no drops, no column renames.

### 1. Update `lib/db/schema/users.ts`

Add five new boolean columns. Final shape:

```ts
import { pgTable, uuid, bigint, text, boolean, timestamp, customType } from 'drizzle-orm/pg-core'

const bytea = customType<{ data: Buffer }>({
  dataType() { return 'bytea' },
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  githubId: bigint('github_id', { mode: 'number' }).notNull().unique(),
  githubLogin: text('github_login').notNull(),
  displayUsername: text('display_username').notNull().unique(),
  email: text('email').notNull(),
  avatarUrl: text('avatar_url'),
  timezone: text('timezone').notNull().default('UTC'),
  isPublic: boolean('is_public').notNull().default(false),
  emailRecapEnabled: boolean('email_recap_enabled').notNull().default(true),
  githubAccessTokenEnc: bytea('github_access_token_enc'),
  githubRefreshTokenEnc: bytea('github_refresh_token_enc'),
  githubTokenExpiresAt: timestamp('github_token_expires_at', { withTimezone: true }),
  lastEventId: text('last_event_id'),
  lastIncrementalSyncAt: timestamp('last_incremental_sync_at', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  // NEW — onboarding hints (ADR-41)
  clusterClickHintSeen: boolean('cluster_click_hint_seen').notNull().default(false),
  shareHintSeen: boolean('share_hint_seen').notNull().default(false),
  recapDiffHintSeen: boolean('recap_diff_hint_seen').notNull().default(false),
  // NEW — first-ever star cinematic (ADR-38)
  firstStarCinematicSeen: boolean('first_star_cinematic_seen').notNull().default(false),
  firstStarCinematicPending: boolean('first_star_cinematic_pending').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

### 2. Create `lib/db/schema/username-history.ts`

```ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const usernameHistory = pgTable('username_history', {
  oldUsername: text('old_username').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
})
```

### 3. Create `lib/db/schema/misclassification-feedback.ts`

```ts
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users'
import { repositories } from './repositories'

export const misclassificationFeedback = pgTable(
  'misclassification_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    techKey: text('tech_key').notNull(),
    territoryType: text('territory_type').notNull(),
    relatedRepoId: uuid('related_repo_id').references(() => repositories.id, { onDelete: 'set null' }),
    // enum: 'wrong_category' | 'shouldnt_be_lit' | 'not_mine' | 'other'
    category: text('category').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('misclassification_feedback_user_created_idx').on(table.userId, table.createdAt),
    index('misclassification_feedback_tech_created_idx').on(table.techKey, table.createdAt),
  ],
)
```

### 4. Create `lib/db/schema/tech-global-stats.ts`

```ts
import { pgTable, text, integer, numeric, timestamp } from 'drizzle-orm/pg-core'

export const techGlobalStats = pgTable('tech_global_stats', {
  techKey: text('tech_key').primaryKey(),
  litUserCount: integer('lit_user_count').notNull().default(0),
  eligibleUserCount: integer('eligible_user_count').notNull().default(0),
  litPercentage: numeric('lit_percentage').notNull().default('0'),
  computedAt: timestamp('computed_at', { withTimezone: true }),
})
```

### 5. Create `lib/db/schema/system-messages.ts`

```ts
import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const systemMessages = pgTable('system_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  message: text('message').notNull(),
  // enum: 'info' | 'warning' | 'error'
  severity: text('severity').notNull().default('info'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
})
```

### 6. Update `lib/db/schema/index.ts`

Add re-exports for the four new tables.

### 7. Update `lib/db/client.ts` — `prepare: false` for pooler

Final shape:

```ts
import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!, { prepare: false })

export const db = drizzle(client, { schema })
```

**Critical:** the `prepare: false` flag is required because `DATABASE_URL` points to Supabase's transaction-mode pooler (port 6543), which does not support session-bound prepared statements. Removing this flag will produce runtime errors that look like data corruption.

### 8. Add `DIRECT_URL` to `.env.example`

`drizzle.config.ts` should use `DIRECT_URL` for migrations (direct connection, port 5432), while runtime queries use `DATABASE_URL` (pooler, port 6543).

Update `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Runtime queries — transaction-mode pooler (port 6543)
DATABASE_URL=postgres://postgres.your-project:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
# Drizzle Kit migrations only — direct connection (port 5432)
DIRECT_URL=postgres://postgres.your-project:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres

GITHUB_OAUTH_CLIENT_ID=your-github-oauth-client-id
GITHUB_OAUTH_CLIENT_SECRET=your-github-oauth-client-secret

# OAuth callback origin allowlist — comma-separated; ADR-47
APP_HOSTNAME_ALLOWLIST=localhost:3000,devastra.app

INNGEST_EVENT_KEY=your-inngest-event-key
INNGEST_SIGNING_KEY=your-inngest-signing-key

RESEND_API_KEY=your-resend-api-key
RESEND_WEBHOOK_SECRET=your-resend-webhook-secret

# Unsubscribe JWT signing — generate with: openssl rand -base64 64
UNSUBSCRIBE_TOKEN_SECRET=replace-with-openssl-rand-base64-64
# Bump to revoke all outstanding tokens (ADR-48)
UNSUBSCRIBE_TOKEN_VERSION=1

# OG cache version (ADR-52) — bump on global renderer change
OG_RENDER_VERSION=devastra-1

SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Also update `drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/db/schema',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
})
```

### 9. Create `lib/db/queries/_helpers.ts` (RLS bypass guard rail)

This is the most security-critical addition. Per ADR-46, all Drizzle queries against per-user tables MUST flow through `withUserScope`.

```ts
import 'server-only'
import { eq, and, type SQL } from 'drizzle-orm'
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core'

/**
 * RLS bypass guard rail (ADR-46).
 *
 * Drizzle's direct Postgres connection bypasses RLS. This helper produces
 * a WHERE clause that scopes a query to a single user. All reads against
 * activities, territories, landmarks, email_sends, weekly_recaps,
 * misclassification_feedback, sync_jobs MUST use this helper.
 *
 * Usage:
 *   const rows = await db.select().from(landmarks).where(withUserScope(userId, landmarks.userId))
 */
export function withUserScope(userId: string, userIdColumn: PgColumn): SQL {
  return eq(userIdColumn, userId)
}

/**
 * Compose user scope with additional conditions.
 *
 * Usage:
 *   const rows = await db.select().from(landmarks).where(
 *     withUserScopeAnd(userId, landmarks.userId, eq(landmarks.techKey, 'react'))
 *   )
 */
export function withUserScopeAnd(
  userId: string,
  userIdColumn: PgColumn,
  ...additional: (SQL | undefined)[]
): SQL {
  const conds = [eq(userIdColumn, userId), ...additional.filter(Boolean)] as SQL[]
  return and(...conds)!
}
```

### 10. Generate migration

Run `npm run db:generate`. This creates a new SQL file in `drizzle/migrations/` containing:

- `ALTER TABLE users` adding the 5 new boolean columns (each `NOT NULL DEFAULT false`).
- `CREATE TABLE username_history` with PK on `old_username`.
- `CREATE TABLE misclassification_feedback` with two composite indexes.
- `CREATE TABLE tech_global_stats` with PK on `tech_key`.
- `CREATE TABLE system_messages`.

### 11. Append RLS policies to the new migration

Drizzle Kit will not author RLS policies — append them by hand to the same migration file (or to a paired `0002_rls_pivot_tables.sql` if cleaner). Use existing `drizzle/migrations/0001_rls_and_triggers.sql` as the style template.

```sql
-- username_history (ADR-30) — public SELECT for redirect resolution; writes service-role
ALTER TABLE public.username_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "username_history_select" ON public.username_history
  FOR SELECT TO anon, authenticated USING (true);
-- INSERT/UPDATE/DELETE intentionally not granted to authenticated; service role bypasses RLS.

-- misclassification_feedback (ADR-40) — INSERT self; SELECT denied to all (service role only)
ALTER TABLE public.misclassification_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "misclassification_feedback_insert" ON public.misclassification_feedback
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- No SELECT/UPDATE/DELETE policy — service role handles reads.

-- tech_global_stats (ADR-28) — public SELECT; writes service-role
ALTER TABLE public.tech_global_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech_global_stats_select" ON public.tech_global_stats
  FOR SELECT TO anon, authenticated USING (true);

-- system_messages (ADR-42) — public SELECT; writes service-role (founder via Supabase dashboard SQL)
ALTER TABLE public.system_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_messages_select" ON public.system_messages
  FOR SELECT TO anon, authenticated USING (true);
```

### 12. Apply migration to dev DB

```bash
npm run db:migrate
```

Confirm migration succeeds. The new tables exist in dev DB.

### 13. Add unit test for `_helpers.ts`

`tests/unit/db-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { withUserScope, withUserScopeAnd } from '@/lib/db/queries/_helpers'
import { eq } from 'drizzle-orm'
import { landmarks } from '@/lib/db/schema/landmarks'

describe('withUserScope', () => {
  it('produces a single user_id equality clause', () => {
    const clause = withUserScope('11111111-1111-1111-1111-111111111111', landmarks.userId)
    // The clause is a SQL fragment; we check that it exists (the precise SQL string
    // depends on Drizzle internals). The contract is: it must always include a
    // user_id binding.
    expect(clause).toBeDefined()
  })

  it('composes with additional conditions', () => {
    const clause = withUserScopeAnd(
      '11111111-1111-1111-1111-111111111111',
      landmarks.userId,
      eq(landmarks.techKey, 'react'),
    )
    expect(clause).toBeDefined()
  })
})
```

### 14. Update `docs/data-schema.md` if the migration introduces any deviation

Re-read the schema section. The doc was authored with this migration's exact shape in mind, so deviation should be zero. If anything drifts (e.g. Drizzle adds an unexpected index or constraint), update `docs/data-schema.md` to match — schema is the source of truth (CLAUDE.md rule).

## Acceptance Criteria

```bash
# TypeScript builds cleanly
npm run build

# Unit tests pass
npx vitest run tests/unit/db-helpers.test.ts

# Migration file was generated
test -n "$(ls drizzle/migrations/0002_*.sql 2>/dev/null || ls drizzle/migrations/*pivot*.sql 2>/dev/null)"

# Migration applied successfully (idempotent on re-run)
npm run db:migrate

# Verify the new columns exist (requires DATABASE_URL set to dev)
node -e "
  const postgres = require('postgres')
  const sql = postgres(process.env.DATABASE_URL, { prepare: false })
  sql\`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'users' AND column_name IN (
      'cluster_click_hint_seen', 'share_hint_seen', 'recap_diff_hint_seen',
      'first_star_cinematic_seen', 'first_star_cinematic_pending'
    )
  \`.then(rows => {
    if (rows.length !== 5) { console.error('Missing user columns'); process.exit(1) }
    sql.end()
  })
"
```

## How to verify AC

Run the AC commands above. If all pass, set the phase 1 status to `"completed"` in `/tasks/1-pivot-mvp/index.json`.
If you cannot make them pass after 3 attempts, set status to `"error"` and write the error in the phase's `"error_message"` field in index.json.

## Notes

- **Add-only migrations (ADR-51).** Do not drop columns, do not rename. Existing tests should continue to pass; nothing in the existing code reads the new columns yet.
- **`prepare: false` is mandatory.** Removing it produces silent runtime errors with the transaction-mode pooler. Confirm `lib/db/client.ts` includes it.
- **RLS policies for new tables.** Append the SQL by hand; Drizzle Kit does not author RLS. Use `drizzle/migrations/0001_rls_and_triggers.sql` as the style template.
- **Do not add `DATABASE_URL` env to git.** `.env.example` only.
- **Do not write any feature code in this phase.** No UI changes, no Server Actions. This phase prepares the data layer only.
- If the migration target dev DB is not reachable, set status to `"error"` and surface the connection error — do not skip the migration step.
