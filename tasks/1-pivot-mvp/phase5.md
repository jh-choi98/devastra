# Phase 5: State Banners + Special Moments

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/flow.md` Flow 4 (refresh banners) · Sub-flow A (stage-up) · Sub-flow B (first-ever cinematic) · Sub-flow C (long absence) · Sub-flow E (hint lifecycle) · Sub-flow G (system status) · Sub-flow K (auth edge cases)
- `/docs/screens.md` §H State overlays/banners · §I Special moments
- `/docs/adr.md` ADR-32 (recap skip) · ADR-33 (diff persistence) · ADR-37 (cluster expanded) · ADR-38 (first-ever cinematic via pending flag) · ADR-39 (long absence) · ADR-41 (hint lifecycle) · ADR-42 (system status banner) · ADR-43 (constellation persistence)
- `/CLAUDE.md` §First-ever star cinematic detection · §Long-absence threshold
- `/tasks/1-pivot-mvp/docs-diff.md`

Then verify Phase 4's output:

- `app/_components/ClusterDrawer/` works
- `app/_components/TerritoryDrawer/` is removed
- `features/feedback/misclassification.ts` + action exist
- `npm run build` passes

Carefully read the code from previous phases. Understand the design intent before working.

## Work

Implement state banners and three cinematic moments. Wire them into the main constellation page so they react to user state.

### 1. Create `app/_components/StateBanners/`

All banner components are client components and render conditionally based on props. Shared style: dim sky tone with light-text content, dismissible via X (except where noted).

#### `SyncFailedBanner.tsx`

Position: bottom of viewport. Props: `onRetry: () => void`, `onDismiss: () => void`.
Copy: `Sync failed. Your constellation is safe.` + Retry button.

#### `GitHubDisconnectedBanner.tsx`

Position: top strip (below header). Two copy variants — generic disconnect vs token-expired:

```ts
type Variant = 'disconnected' | 'token_expired'
// disconnected: "GitHub disconnected — reconnect to sync new activity"
// token_expired: "Your GitHub connection expired — Reconnect"
// Action button label: "Reconnect" → triggers OAuth flow via /api/auth/sign-in or Server Action.
```

#### `SystemStatusBanner.tsx`

Position: top strip.
Reads the active row(s) from `system_messages` (passed in as prop from server-side render).
Copy default: `Sync is delayed right now. Your constellation is safe.`
Dismissible (session-scoped via localStorage key `system_status_dismissed_${row_id}`).

#### `WelcomeBackStrip.tsx`

Position: top strip. Trigger condition computed server-side (`NOW() - last_login_at > 28 days`).
Copy: `Welcome back — your constellation has new activity` + sub-line.

```tsx
'use client'
export function WelcomeBackStrip(props: {
  diffSummary: {
    new_stars_count: number
    expanded_clusters: string[]  // cluster names like "Backend"
  }
  onDismiss: () => void
}): JSX.Element {
  // Sub-line composed: "Since your last visit: 3 stars lit · Backend expanded"
  //   - "{N} stars lit" if new_stars_count > 0
  //   - "{Cluster} expanded" for each in expanded_clusters
  //   - Join with " · "
  // X dismisses for the visit (localStorage `welcome_back_dismissed_${last_login_iso}`).
  return /* ... */ null as any
}
```

#### `ThisWeekStrip.tsx`

Position: top strip. Trigger: `weekly_recaps` row exists for current UTC week AND user has not dismissed within the same week. Composition:

```tsx
'use client'
export function ThisWeekStrip(props: {
  highlights: {
    stage_up?: { cluster_name: string; new_stars_count: number; brightened_count: number }
    // when stage_up is present, this is the priority copy (Sub-flow A integration with this-week diff)
    new_stars?: number
    growth_pct?: { cluster_name: string; pct: number }
  }
  onDismiss: () => void
}): JSX.Element {
  // If stage_up: "{cluster_name} cluster expanded · {N} stars brightened"
  // Else: "This week: {N} new stars · {Cluster} +{pct}%"
  // X dismisses for the week (localStorage `this_week_dismissed_${week_start_iso}`).
  return /* ... */ null as any
}
```

#### `HintTooltip.tsx`

Reusable floating bubble that points to a target. Used for cluster-click hint, recap-diff hint. Auto-dismisses based on rules in ADR-41.

```tsx
'use client'
export function HintTooltip(props: {
  target: 'cluster-label' | 'share-button' | 'cluster-recap-diff'
  text: string
  // Position computed from target element's bounding box.
  onDismiss: () => void
  /** Auto-dismiss timer in ms; 0 means stay until action. */
  autoDismissMs?: number
}): JSX.Element {
  return /* ... */ null as any
}
```

#### Banner priority handling

Create a shared `app/_components/StateBanners/BannerStack.tsx`:

```tsx
'use client'
export function BannerStack(props: {
  state: {
    githubDisconnected?: { variant: 'disconnected' | 'token_expired' }
    systemStatus?: { id: string; message: string; severity: 'info' | 'warning' | 'error' }
    welcomeBack?: { diffSummary: { new_stars_count: number; expanded_clusters: string[] } }
    thisWeek?: { highlights: any } // shape from ThisWeekStrip
    syncFailed?: boolean
  }
  onRetry: () => void
}): JSX.Element {
  // Top-strip priority (only one rendered at top): disconnected > systemStatus > welcomeBack > thisWeek
  // Bottom-strip: syncFailed (independent of top strip; can co-render)
  // Localstorage-based dismiss state is read by each individual banner component.
  return /* ... */ null as any
}
```

### 2. Create `app/_components/SpecialMoments/`

#### `FirstTimeReveal.tsx`

The 12s–30s cinematic for first lifetime entry. Triggered when `users.last_login_at` is NULL or the user has never seen any cluster lit.

```tsx
'use client'
import { useEffect, useState } from 'react'
import type { ConstellationData } from '@/app/_components/Constellation/Constellation'

export function FirstTimeReveal(props: {
  data: ConstellationData
  /** Called when reveal completes (~12s minimum, 30s max). */
  onComplete: () => void
}): JSX.Element {
  // Render same SVG layout as Constellation, but with timing overrides:
  //   - Cluster outlines: fade in over 1.0s on mount.
  //   - Stars: each landmark spark-animates in based on its DB insert order via Realtime subscription,
  //     with 0.1s stagger. The component subscribes to landmarks insert events.
  //   - Connection lines: appear after both endpoints lit, with dim → bright fade over 0.4s.
  //   - Cluster labels: appear when first star in cluster lights.
  //
  // Bottom-right counter (live): "{N} commits analyzed in {M} repos"
  //   Subscribes to sync_jobs.progress shape: { repos_analyzed, total, current_step }.
  //
  // Bottom strip: "Lit: Frontend · Backend · Testing" — list cluster names that have ≥1 lit star.
  //
  // Pacing:
  //   - Min 12s — if Realtime reveals everything sooner, idle until 12s mark before settle.
  //   - Max 30s — at 30s, any remaining stars batch-reveal in a 0.5s fade.
  //
  // End sequence:
  //   - Settling pulse (all stars pulse once in 0.6s).
  //   - Brightest cluster pulse + label highlight (~1s).
  //   - One-time "Click to explore" hint on the brightest cluster's label, auto-dismiss in 5s.
  //   - Call onComplete.
  //
  // Reduced-motion: skip all per-star animations; render the final state instantly; still call onComplete.
  return /* ... */ null as any
}
```

#### `FirstEverStarCinematic.tsx`

Triggered when `users.first_star_cinematic_pending = true` AND `users.first_star_cinematic_seen = false`.

```tsx
'use client'
export function FirstEverStarCinematic(props: {
  /** The newly-lit stars (from this sync run). */
  newStars: Array<{ tech_key: string; displayName: string; territory: string }>
  data: ConstellationData
  onComplete: () => void  // after ~8s
}): JSX.Element {
  // 8s sequence:
  //   1. All 6 cluster outlines slightly brighten (from baseline → 0.5 opacity in 0.5s).
  //   2. Newly lit star(s) spark in with 0.3s stagger between stars.
  //   3. Strip-area copy fades in: "Your first star lit: {displayName}" (single) or "Your first stars: {names joined}" (multi)
  //      followed (after 1.5s) by "Your constellation has begun".
  //   4. Long glow on each new star persists.
  //   5. After ~8s total, only the clusters containing new stars retain permanent activation;
  //      other clusters fade back to dim outline. Call onComplete.
  //
  // Not dismissible. ESC does nothing.
  //
  // Reduced-motion: render final state in 1s; copy fades in over 0.3s; onComplete fires at 2s.
  //
  // After onComplete, the parent should call a Server Action that sets:
  //   users.first_star_cinematic_pending = false
  //   users.first_star_cinematic_seen    = true
  return /* ... */ null as any
}
```

#### `StageUpMoment.tsx`

Triggered when the page detects a fresh `stage_changed_at` (within the visit). Part of the manual refresh / weekly recap flow.

```tsx
'use client'
export function StageUpMoment(props: {
  events: Array<{
    cluster_name: string  // "Backend"
    cluster_color: string
    cluster_center: { cx: number; cy: number; radius: number }
    from_stage: number
    to_stage: number
  }>
}): JSX.Element {
  // For each event:
  //   - Cluster aura radius expands 10-20% (animate from current radius to radius * 1.18 over 0.6s).
  //   - Aura intensity increases (opacity 0.05 → ~0.20 over 0.6s).
  //   - One ripple wave: <circle> at cluster center, r animates from radius*0.5 to radius*1.2 over 1.5s, opacity 0.4 → 0.
  //
  // Multi-event stagger: 0.3s between events (per ADR-37).
  //
  // The component is positioned absolutely on top of the constellation SVG using the cluster_center coords;
  // the parent passes the same viewport-mode-derived centers used by Constellation.
  //
  // Reduced-motion: snap to final aura state in 0.1s; skip ripple.
  return /* ... */ null as any
}
```

### 3. Hint flag Server Actions

`features/feedback/hints.actions.ts` (or co-locate in `app/(authenticated)/_actions.ts`):

```ts
'use server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { requireUser } from '@/lib/auth/session'

export async function markClusterClickHintSeen() {
  const user = await requireUser()
  await db.update(users).set({ clusterClickHintSeen: true }).where(eq(users.id, user.id))
}

export async function markShareHintSeen() {
  const user = await requireUser()
  await db.update(users).set({ shareHintSeen: true }).where(eq(users.id, user.id))
}

export async function markRecapDiffHintSeen() {
  const user = await requireUser()
  await db.update(users).set({ recapDiffHintSeen: true }).where(eq(users.id, user.id))
}

export async function markFirstStarCinematicCompleted() {
  const user = await requireUser()
  await db
    .update(users)
    .set({
      firstStarCinematicPending: false,
      firstStarCinematicSeen: true,
    })
    .where(eq(users.id, user.id))
}

export async function touchLastLoginAt() {
  const user = await requireUser()
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))
}
```

Each action returns `void` (success) or throws — caller handles failure via toast / silent.

### 4. Wire `cinematic-detection.ts` into sync

Open `features/sync/initial.ts` and `features/sync/incremental.ts` (and `manual.ts`). At the start of each, capture the previous lit-star count:

```ts
import { getPreviousLitCount, markFirstStarCinematicIfApplicable } from './cinematic-detection'

// At the top of the sync runner:
const previousLitCount = await getPreviousLitCount(userId)

// ... classification + UPSERTs ...

// At the end of the sync run, after landmarks have been UPSERTed:
await markFirstStarCinematicIfApplicable({ userId, previousLitCount })
```

### 5. Compute since-last-visit diff for welcome-back

`lib/db/queries/since-last-visit-diff.ts`:

```ts
import 'server-only'
import { and, eq, gt, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { landmarks } from '@/lib/db/schema/landmarks'
import { territories } from '@/lib/db/schema/territories'
import { withUserScopeAnd } from './_helpers'

export async function getSinceLastVisitDiff(opts: {
  userId: string
  lastLoginAt: Date | null
}): Promise<{
  new_stars_count: number
  expanded_clusters: string[]  // cluster type values that stage_changed_at > lastLoginAt
} | null> {
  if (!opts.lastLoginAt) return null
  const since = opts.lastLoginAt

  // New stars: landmarks where first_unlocked_at > since
  const [{ value: newCount }] = await db
    .select({ value: sql<number>`cast(count(*) as int)` })
    .from(landmarks)
    .where(
      withUserScopeAnd(
        opts.userId,
        landmarks.userId,
        isNotNull(landmarks.firstUnlockedAt),
        gt(landmarks.firstUnlockedAt, since),
      ),
    )

  // Expanded clusters: territories where stage_changed_at > since
  const rows = await db
    .select({ type: territories.type })
    .from(territories)
    .where(
      withUserScopeAnd(
        opts.userId,
        territories.userId,
        isNotNull(territories.stageChangedAt),
        gt(territories.stageChangedAt, since),
      ),
    )

  return {
    new_stars_count: newCount,
    expanded_clusters: rows.map((r) => r.type),
  }
}
```

### 6. Update `app/(authenticated)/page.tsx` to orchestrate everything

The authenticated main page server component must:

1. Fetch user (`requireUser()`).
2. Determine if reveal-first-time should run: `users.last_login_at` is null.
3. Compute `welcomeBackTrigger`: `last_login_at && (NOW() - last_login_at > 28 days)`.
4. Fetch the since-last-visit diff if welcomeBackTrigger is true.
5. Fetch territories + landmarks for the current user via existing queries.
6. Fetch latest `weekly_recaps` row to determine this-week diff (if any).
7. Fetch active `system_messages` row (highest severity).
8. Render the page with:
   - `<Constellation data={...} />`
   - `<BannerStack state={...} />`
   - Conditionally `<FirstTimeReveal />` / `<FirstEverStarCinematic />` / `<StageUpMoment />`
9. After page mount (client side), call `touchLastLoginAt()` Server Action to update `users.last_login_at`. **Important:** capture the previous value BEFORE updating it; the welcome-back diff uses the previous value.

The first-ever cinematic check happens client-side on mount: read `firstStarCinematicPending` from the server-rendered user object (or via a small `/api/me` fetch). If `pending && !seen`, render the cinematic, then call `markFirstStarCinematicCompleted()`.

### 7. RecapTimeline / hint mounting

Read `users.cluster_click_hint_seen`, `share_hint_seen` server-side. Pass as props to the page. The page conditionally mounts `<HintTooltip target="cluster-label" ... />` after `FirstTimeReveal` completes (or after page hydration for returning users), tied to the brightest cluster.

The cluster-click hint:
- Show twice maximum across sessions (per ADR-41). Implement via a session counter (localStorage `cluster_hint_shown_count`) AND the `cluster_click_hint_seen` DB flag.
- On first drawer open: call `markClusterClickHintSeen()` and never show again.

Share-button pulse:
- Trigger immediately after the FIRST drawer close in a session, IF `share_hint_seen` is false.
- A 1-pulse animation on the Share button. On the next user action that closes the pulse animation (or after 3s), call `markShareHintSeen()`.

### 8. System status banner data path

`lib/db/queries/system-messages.ts`:

```ts
import 'server-only'
import { and, eq, or, isNull, gt, desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { systemMessages } from '@/lib/db/schema/system-messages'

export async function getActiveSystemMessage() {
  const now = new Date()
  const rows = await db
    .select()
    .from(systemMessages)
    .where(
      and(
        eq(systemMessages.active, true),
        or(isNull(systemMessages.expiresAt), gt(systemMessages.expiresAt, now)),
      ),
    )
    .orderBy(
      // Highest severity first; ties by created_at DESC
      // Drizzle does not have a CASE order helper inline; use SQL fragment.
      // Severities: 'error' > 'warning' > 'info'
      // For simplicity, sort in app:
      desc(systemMessages.createdAt),
    )

  if (rows.length === 0) return null

  // Sort in app by severity priority.
  const SEV_RANK: Record<string, number> = { error: 3, warning: 2, info: 1 }
  rows.sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0))
  return rows[0]
}
```

### 9. Visual rendering details (reduced-motion)

In every animated component, include:

```tsx
const prefersReducedMotion = useReducedMotion()  // from SparkAnimation.tsx in Phase 3
```

And guard motion variants. If `prefersReducedMotion`, skip all motion and snap to final states. Sound: no audio. Vibration: no.

### 10. (Optional cleanup) `app/_components/PrivateProfile.tsx` is referenced by Phase 6; do not touch it here.

## Acceptance Criteria

```bash
# TypeScript builds cleanly
npm run build

# Unit tests pass
npx vitest run tests/unit

# Banner + moment components exist
test -f app/_components/StateBanners/SyncFailedBanner.tsx
test -f app/_components/StateBanners/GitHubDisconnectedBanner.tsx
test -f app/_components/StateBanners/SystemStatusBanner.tsx
test -f app/_components/StateBanners/WelcomeBackStrip.tsx
test -f app/_components/StateBanners/ThisWeekStrip.tsx
test -f app/_components/StateBanners/HintTooltip.tsx
test -f app/_components/StateBanners/BannerStack.tsx
test -f app/_components/SpecialMoments/FirstTimeReveal.tsx
test -f app/_components/SpecialMoments/FirstEverStarCinematic.tsx
test -f app/_components/SpecialMoments/StageUpMoment.tsx

# Hint actions + diff query + cinematic detection wired up
test -f features/feedback/hints.actions.ts
test -f lib/db/queries/since-last-visit-diff.ts

# cinematic-detection.ts is called from each sync entry point
git grep -l "markFirstStarCinematicIfApplicable" features/sync/ | wc -l | xargs -I{} test {} -ge 1
```

## How to verify AC

Run the AC commands above. If all pass, set the phase 5 status to `"completed"` in `/tasks/1-pivot-mvp/index.json`.
If you cannot make them pass after 3 attempts, set status to `"error"` and write the error in the phase's `"error_message"` field in index.json.

## Notes

- **`FirstTimeReveal` and `FirstEverStarCinematic` are mutually exclusive.** Per ADR-38, if a user has `first_star_cinematic_pending = true`, the FirstEverStarCinematic supersedes any first-time reveal.
- **`StageUpMoment` is additive.** It can render on top of the steady constellation alongside `ThisWeekStrip` and `WelcomeBackStrip` (within priority rules).
- **Hint flags are forward-only.** Once set to true, the page no longer shows the corresponding hint. There is no "reset hints" UI.
- **`touchLastLoginAt` must run AFTER welcomeBackDiff is captured.** Otherwise the threshold check resets and the welcome-back fires every visit.
- **No achievement copy.** New unlock surfacing is the spark + glow visual only. No "Level up!", no "+XP", no toast for unlocks.
- **System status banner is dismissible per session.** Reopen = banner returns. Founder retires the message by setting `active = false` via Supabase dashboard.
- **Reduced motion**: every animation must check `useReducedMotion()` and skip to final state. WCAG 2.3.3.
- **Do not touch the public profile page in this phase.** Phase 6 handles `/{username}` variants. This phase wires banners/moments into the authenticated main page only.
- **Realtime subscription** for FirstTimeReveal: subscribe to `landmarks` INSERT events scoped by `user_id`. Use Supabase's filter syntax. Defense-in-depth per ADR-43 (`filter: user_id=eq.${auth.uid()}`).
