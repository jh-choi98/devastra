# Phase 8: Reveal Experience

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/flow.md` §Flow 1 (steps 6-9), §Flow 2, §Flow 4
- `/docs/adr.md` (ADR-1, ADR-8, ADR-9, ADR-13)
- `/docs/data-schema.md` §Realtime publication, §Users (`last_login_at`)
- `/CLAUDE.md`
- `/tasks/0-mvp/docs-diff.md`

Then verify Phase 7's output:

- `app/_components/Map/LivingMap.tsx` exists and accepts `MapData` plus `onIslandClick`
- `app/_components/TerritoryDrawer.tsx` exists
- `npm test -- tech-catalog-parity island-shape` passes

## Work

Compose the authenticated home page. Subscribe to Supabase Realtime for progressive reveal. Wire the refresh button and on-demand PR title fetch.

### 1. Authenticated home page

`app/(authenticated)/page.tsx`:

```tsx
import { requireUser } from '@/lib/auth/session'
import { getMapDataForUser } from '@/lib/db/queries/map'
import { LivingMapContainer } from './_map-container'

export default async function HomePage() {
  const user = await requireUser()
  const initialData = await getMapDataForUser(user.id)   // territories + landmarks + diff window
  const isFirstReveal = !user.last_login_at              // before this request marks it
  // also update users.last_login_at = NOW() here
  return <LivingMapContainer userId={user.id} initial={initialData} firstReveal={isFirstReveal} />
}
```

`lib/db/queries/map.ts` (`import 'server-only'`) — composes the SELECT joining `territories` + `landmarks` for the user. Computes `diffSince = lastVisit timestamp` for the badge logic. For first-time users with no `last_login_at`, `diffSince = null`.

### 2. LivingMapContainer (client component)

`app/(authenticated)/_map-container.tsx`:

```tsx
'use client'
import { LivingMap } from '@/app/_components/Map/LivingMap'
import { TerritoryDrawer } from '@/app/_components/TerritoryDrawer'
import { useRealtimeMapData } from '@/lib/realtime/use-realtime-map-data'
import { useRevealSequence } from './_use-reveal-sequence'

export function LivingMapContainer({ userId, initial, firstReveal }: Props) {
  const data = useRealtimeMapData(userId, initial)
  const { revealComplete, syncProgressText } = useRevealSequence({ userId, firstReveal })
  // open drawer state, click handler
  return (
    <>
      <LivingMap data={data} onIslandClick={...} />
      <TerritoryDrawer ... />
      {syncProgressText && <div className="fixed bottom-4 left-4 text-xs opacity-70">{syncProgressText}</div>}
    </>
  )
}
```

### 3. Realtime subscription hook

`lib/realtime/use-realtime-map-data.ts`:

```ts
'use client'
import { createBrowserClient } from '@/lib/auth/supabase'

export function useRealtimeMapData(userId: string, initial: MapData): MapData
```

Subscribe to Postgres changes on `territories`, `landmarks`, `sync_jobs` filtered by `user_id = userId`. On update, mutate local state. Clean up subscription on unmount.

Channel name: `map:${userId}`. Subscriptions:

- `postgres_changes` on `public.territories` (event: `*`, filter: `user_id=eq.${userId}`)
- `postgres_changes` on `public.landmarks` (event: `*`, filter: `user_id=eq.${userId}`)
- `postgres_changes` on `public.sync_jobs` (event: `*`, filter: `user_id=eq.${userId}`)

On `sync_jobs` updates, parse `progress` JSON and call the reveal hook's progress setter.

### 4. Reveal sequence

`app/(authenticated)/_use-reveal-sequence.ts`:

```ts
export function useRevealSequence(opts: { userId: string; firstReveal: boolean }): {
  revealComplete: boolean
  syncProgressText: string | null
}
```

Behavior:

- If `firstReveal`, render full cinematic: 30-60s fade-from-dark + per-island staggered entry; bottom-left text reads from `sync_jobs.progress.current_step` (e.g. "{repos_analyzed}/{total} repos analyzed...").
- If not `firstReveal`, render 3-second short reveal (single fade + brief stagger).
- Returns `revealComplete = true` after the chosen duration.

`Island` already animates entry via Framer Motion variants; the container drives the orchestration via a `variants` prop or `AnimatePresence` ordering.

### 5. Header

`app/_components/Header.tsx`:

```tsx
'use client'
export function Header({ user }: { user: { display_username: string; avatar_url: string | null; is_public: boolean } }) {
  // Logo (links to /)
  // Refresh button (renders <RefreshButton userId={...} />)
  // Share button (opens <ShareModal />, implemented Phase 9 — stub here)
  // Avatar dropdown (Settings, My public profile if is_public, Sign out)
}
```

The Avatar dropdown's "Sign out" calls the `signOut()` Server Action from Phase 3.

### 6. Refresh button

`app/_components/RefreshButton.tsx`:

```tsx
'use client'
export function RefreshButton({ userId, lastSyncStartedAt }: { userId: string; lastSyncStartedAt: Date | null }) {
  // computes cooldownRemaining
  // disabled while cooldown active
  // on click: POST /api/refresh
  // shows toast on cooldown or success
}
```

API route already exists from Phase 6. The button POSTs and disables itself for 5 minutes after a successful response. While `sync_jobs.status === 'running'` (received via Realtime), the button label changes to "Syncing...".

### 7. On-demand PR title fetch

The drawer needs PR titles, but per ADR-9 we don't store them. Implement a Server Action:

```ts
// app/(authenticated)/_actions.ts
'use server'
import { z } from 'zod'
import { getUsableAccessToken } from '@/lib/github/token'
import { GitHubSourceClient } from '@/features/sync/sources/github'

const FetchPrTitlesSchema = z.object({
  prs: z.array(z.object({ owner: z.string(), repo: z.string(), number: z.number().int() })).max(10)
})

export async function fetchPrTitles(input: unknown): Promise<Record<string, string>> {
  const { prs } = FetchPrTitlesSchema.parse(input)
  const user = await requireUser()
  const token = await getUsableAccessToken(user.id)
  const client = new GitHubSourceClient(token)
  return client.fetchPullRequestTitles(prs)
}
```

`TerritoryDrawer` calls this Server Action when first opened for a territory. Cache results in component state for the session (no localStorage; ephemeral).

### 8. Diff badge logic

In `LivingMapContainer`, compute `recentlyGrown` per territory based on `stage_changed_at > diffSince` AND `growth_30d > 0`. Pass to `Island` so the glow + "+X% this week" badge renders when appropriate.

### 9. Reveal flow integration test

`tests/integration/reveal-flow.test.ts`:

- Mock Supabase Realtime channel events.
- Render `LivingMapContainer` with `firstReveal = true`.
- Assert that islands appear progressively as `territories` UPSERT events arrive.
- Assert that the progress text updates from `sync_jobs.progress`.
- Assert that `revealComplete` becomes true after the cinematic timeout.

Use Vitest + `@testing-library/react`. Mock Realtime via a simple emitter.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm run build
npm test -- reveal-flow
# Manual: npm run dev → sign in (or use Supabase local) → confirm map renders
```

## How to verify AC

Run the automated AC commands. The reveal flow test must pass. Build must succeed.

If all pass, set this phase's status to `"completed"` in `/tasks/0-mvp/index.json`. If you cannot make AC pass after 3 attempts, set status to `"error"`.

## Notes

- Do NOT fetch PR titles during sync. They are user-facing display data and are fetched on demand to respect ADR-9.
- Do NOT subscribe to Realtime for `activities` — it is not in the publication and would not work.
- Do NOT persist PR titles to local storage / cookies / DB. Session-only memory.
- Drawer Server Action limits to 10 PRs per call (`.max(10)` in Zod). This caps GitHub API cost per click.
- `last_login_at` must be updated server-side before passing `firstReveal` to the client. Otherwise a refresh shows the cinematic again.
- The cooldown check on the refresh button is informational only; the actual enforcement is server-side in `features/sync/manual.ts` (Phase 6).
- Sticky bottom-left progress text only renders during active sync; remove when `sync_jobs.status === 'completed'`.
- All identifiers, comments, copy in English.
