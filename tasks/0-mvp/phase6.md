# Phase 6: Sync Orchestration

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/flow.md` §Flow 1 step 5-6, §Flow 4
- `/docs/data-schema.md` §Sync_Jobs, §Activities, §Activity_Territories, §Territories, §Landmarks
- `/docs/adr.md` (ADR-5, ADR-12, ADR-19, ADR-22)
- `/docs/code-architecture.md` §External dependencies → Inngest event naming
- `/CLAUDE.md`
- `/tasks/0-mvp/docs-diff.md`

Then verify Phase 5's output:

- `features/territories/classifier.ts` exports `GitHubClassifier`
- `features/territories/tech-catalog.ts` has 50 entries
- `npm test -- classifier scoring` passes

## Work

Wire all sync flows through Inngest. Every event must be idempotent because Inngest delivers at-least-once.

### 1. Inngest client

`lib/inngest/client.ts`:

```ts
import 'server-only'
import { Inngest } from 'inngest'
export const inngest = new Inngest({ id: 'devatlas' })
```

`app/api/inngest/route.ts`:

```ts
import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { initialSync, incrementalSync, manualRefresh, weeklyRecapGenerate, weeklyRecapSend, syncCleanup, backfill } from '@/features/sync/runner'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [initialSync, incrementalSync, manualRefresh, weeklyRecapGenerate, weeklyRecapSend, syncCleanup, backfill],
})
```

Note: `weeklyRecapGenerate` / `weeklyRecapSend` placeholders are registered here but their bodies are implemented in Phase 10. In this phase, register them as no-op stubs that throw `NotImplemented` so the route compiles.

### 2. Event names

`features/sync/events.ts`:

```ts
export const EVENTS = {
  SYNC_INITIAL_REQUESTED: 'sync/initial.requested',
  SYNC_INCREMENTAL_SCHEDULED: 'sync/incremental.scheduled',
  SYNC_MANUAL_REQUESTED: 'sync/manual.requested',
  SYNC_BACKFILL_REQUESTED: 'sync/backfill.requested',
  SYNC_CLEANUP_SCHEDULED: 'sync/cleanup.scheduled',
  // recap events declared here; bodies in Phase 10
  RECAP_WEEKLY_GENERATED: 'recap/weekly.generated',
  RECAP_EMAIL_SEND: 'recap/email.send',
} as const
```

### 3. Sync runner orchestration

`features/sync/runner.ts` defines Inngest function definitions. Each function calls into a per-flow module.

```ts
import 'server-only'
import { inngest } from '@/lib/inngest/client'
import { EVENTS } from './events'
import * as initial from './initial'
import * as incremental from './incremental'
import * as manual from './manual'
import * as backfill_ from './backfill'
import * as cleanup from './cleanup'

export const initialSync = inngest.createFunction(
  { id: 'sync-initial', name: 'Initial sync' },
  { event: EVENTS.SYNC_INITIAL_REQUESTED },
  async ({ event, step }) => initial.run(event, step)
)

export const incrementalSync = inngest.createFunction(
  { id: 'sync-incremental', name: 'Incremental sync (daily)' },
  { cron: '0 6 * * *' },
  async ({ step }) => incremental.run(step)
)

export const manualRefresh = inngest.createFunction(
  { id: 'sync-manual', name: 'Manual refresh', concurrency: { key: 'event.data.userId', limit: 1 } },
  { event: EVENTS.SYNC_MANUAL_REQUESTED },
  async ({ event, step }) => manual.run(event, step)
)

export const syncCleanup = inngest.createFunction(
  { id: 'sync-cleanup', name: 'Stuck-job cleanup' },
  { cron: '*/5 * * * *' },
  async ({ step }) => cleanup.run(step)
)

export const backfill = inngest.createFunction(
  { id: 'sync-backfill', name: 'Reclassify activities' },
  { event: EVENTS.SYNC_BACKFILL_REQUESTED },
  async ({ event, step }) => backfill_.run(event, step)
)

// Phase 10 stubs:
export const weeklyRecapGenerate = inngest.createFunction(
  { id: 'recap-generate', name: 'Generate weekly recap' },
  { cron: '0 9 * * 0' },
  async () => { throw new Error('Implemented in Phase 10') }
)
export const weeklyRecapSend = inngest.createFunction(
  { id: 'recap-send', name: 'Send recap email' },
  { event: EVENTS.RECAP_EMAIL_SEND },
  async () => { throw new Error('Implemented in Phase 10') }
)
```

### 4. Initial sync (`features/sync/initial.ts`)

Steps (each wrapped in `step.run` for retry checkpointing):

```ts
import 'server-only'
export async function run(event, step) {
  const { userId, includedRepoIds } = event.data
  // 1. create sync_jobs row (kind='initial', status='pending' → 'running')
  // 2. await step.run('fetch-token', getUsableAccessToken)
  // 3. await step.run('fetch-repos', listAuthoredRepos)  // filtered by includedRepoIds, MVP_INCLUDE_PRIVATE
  // 4. UPSERT repositories
  // 5. await step.run('fetch-activities', listAuthoredActivities)  // 12-month window
  // 6. await step.run('sample-commits', for ~50 most recent commits: fetchCommitFiles → enrich SourceActivity)
  // 7. await step.run('parse-manifests', read latest package.json / requirements.txt / go.mod / Gemfile / Cargo.toml from each repo's default branch via REST. malformed = empty array.)
  // 8. await step.run('classify-and-write', within db.transaction:
  //      - INSERT activities (ON CONFLICT DO NOTHING)
  //      - For each activity, run classifier → INSERT activity_territories (ON CONFLICT (activity_id, territory_type) DO UPDATE SET weight = EXCLUDED.weight)
  //      - For each tech_key match where weight ≥ LANDMARK_UNLOCK_THRESHOLD over user's history, UPSERT landmarks (set first_unlocked_at if newly crossing threshold))
  // 9. await step.run('recompute-denorm', recompute territories.total_weight, stage, stage_changed_at, growth_30d, last_grown_at per user per territory in one SQL block)
  // 10. sync_jobs.status = 'completed', completed_at = now()
}
```

**Atomicity rule:** steps 8 and 9 must be in `db.transaction()`. If anything inside fails, no partial state.

**Idempotency:** all writes use UPSERT. `activities` UNIQUE(user_id, source, external_id) ensures no duplicates.

**raw JSONB rule:** only `{ file_paths, additions, deletions, github_url }`. Enforce in a write helper (`lib/db/queries/activities.ts`):

```ts
import 'server-only'
const ALLOWED_RAW_KEYS = ['file_paths', 'additions', 'deletions', 'github_url'] as const
export function buildActivityRaw(input: { ... }): ActivityRawShape {
  // strip anything not in ALLOWED_RAW_KEYS
}
```

All `activities` INSERTs must go through this helper.

### 5. Incremental sync (`features/sync/incremental.ts`)

Daily at 06:00 UTC for every user with `users.github_access_token_enc IS NOT NULL`:

```ts
export async function run(step) {
  // 1. step.run('list-users') → users needing sync (token present)
  // 2. for each user, dispatch step.sendEvent('sync/incremental.scheduled', { userId }) and process via reusable helper
  // 3. delta from users.last_event_id via events API; gap-fill from contributionsCollection if last_incremental_sync_at < NOW() - 90 days
  // 4. same write path as initial sync (classify-and-write + recompute-denorm)
  // 5. update users.last_event_id, users.last_incremental_sync_at
}
```

Each user is its own Inngest step or sub-event so a single failure does not abort the cron.

### 6. Manual refresh (`features/sync/manual.ts`)

Cooldown check upfront:

```ts
const recent = await db.select().from(syncJobs)
  .where(eq(syncJobs.user_id, userId))
  .orderBy(desc(syncJobs.started_at))
  .limit(1)
if (recent && recent.started_at > NOW() - 5min) {
  return { skipped: true, reason: 'cooldown' }
}
// otherwise run same incremental delta path
```

### 7. Stuck-job cleanup (`features/sync/cleanup.ts`)

Every 5 minutes:

```sql
UPDATE sync_jobs
SET status = 'failed',
    error = 'timeout (>30min running)',
    completed_at = NOW()
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '30 minutes'
```

### 8. Backfill (`features/sync/backfill.ts`)

Manual admin trigger. Reclassifies all activities for a user (or globally if no `userId` provided in event payload):

```ts
// 1. DELETE activity_territories WHERE activity_id IN (activities of target user)
// 2. DELETE landmarks WHERE user_id = target
// 3. For each activity, run classifier from scratch (use cached manifests if available; else assume empty manifest deps)
// 4. INSERT activity_territories, INSERT landmarks
// 5. Recompute territories denorm
```

`stage` and `stage_changed_at` recomputed; if the new stage is the same as old, do not touch `stage_changed_at`.

### 9. Manual refresh trigger route

`app/api/refresh/route.ts`:

```ts
export async function POST(request) {
  const user = await requireUser()
  // dispatch sync/manual.requested event
}
```

Used by the Header refresh button (Phase 8).

### 10. Integration tests

`tests/integration/initial-sync.test.ts` — mock GitHubSourceClient; run the full pipeline against a local Drizzle DB (or skip with `skipIf` env). Verify:

- `activities`, `activity_territories`, `landmarks`, `territories` rows are written correctly
- Stage transitions trigger `stage_changed_at`
- Re-running with same input is a no-op (idempotency)
- `raw` JSONB never contains disallowed keys

`tests/integration/sync-cleanup.test.ts` — insert a stuck `sync_jobs` row, run cleanup, assert it becomes `failed`.

### 11. Idempotency assertion in code

Add a runtime assertion at the top of the activity write helper that strips disallowed keys and logs a Sentry breadcrumb if any are present (Sentry is wired in Phase 12 — for now just `console.warn` is fine).

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm run build
npm test -- initial-sync
npm test -- sync-cleanup
grep -q "ALLOWED_RAW_KEYS" lib/db/queries/activities.ts
grep -q "MVP_INCLUDE_PRIVATE" features/sync/initial.ts || grep -q "MVP_INCLUDE_PRIVATE" features/sync/sources/github.ts
grep -q "db.transaction\|withTransaction" features/sync/initial.ts
```

## How to verify AC

Run the AC commands. The integration tests must pass (using mocks where DB is unavailable in CI). The grep checks ensure key invariants are present.

If all pass, set this phase's status to `"completed"` in `/tasks/0-mvp/index.json`. If you cannot make AC pass after 3 attempts, set status to `"error"`.

## Notes

- Do NOT write to `weekly_recaps` here. Recap generation is Phase 10. The stubs in `runner.ts` exist only to satisfy the Inngest route registration.
- Do NOT make sync jobs talk to Realtime directly. Realtime emits automatically when `territories` / `landmarks` / `sync_jobs` rows change (publication set up in Phase 2).
- The 50-commit file-path sample is just for the initial sync. Incremental syncs that touch new commits via events API should also fetch files for those specific commits.
- `growth_30d` is recomputed every sync; do not try to maintain it incrementally.
- All identifiers, comments in English.
- Inngest's at-least-once delivery means transient errors retry. Permanent failures (after 5 retries) leave `sync_jobs.status = 'failed'` and the user-facing banner picks it up.
- Concurrency: `manualRefresh` uses `concurrency: { key: 'event.data.userId', limit: 1 }` to prevent two refreshes racing on the same user.
