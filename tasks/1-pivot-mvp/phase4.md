# Phase 4: Cluster Drawer

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/flow.md` Flow 1 §post-reveal exploration · Sub-flow D §Misclassification feedback
- `/docs/screens.md` §D.1 Cluster drawer · §D.2 Star tooltip · §E.3 Misclassification feedback modal
- `/docs/tech-catalog.md` §Detection rule grammar (Product-facing copy mapping)
- `/docs/data-schema.md` §Misclassification_Feedback · §RLS policies (misclassification_feedback)
- `/docs/adr.md` ADR-9 (raw restriction) · ADR-40 (drawer explainability + feedback)
- `/CLAUDE.md` §Constellation UI vs internal DB naming · §`raw` JSONB restriction
- `/tasks/1-pivot-mvp/docs-diff.md`

Then verify Phase 3's output:

- `app/_components/Constellation/` exists with renderer files
- `app/_components/Map/` is removed
- `features/territories/tech-catalog.ts` has `displayName` field
- `features/territories/tech-catalog-public.ts` exposes `getPublicTech().displayName`
- `npm run build` passes

Read the existing code:

- `app/_components/TerritoryDrawer.tsx` and `app/_components/TerritoryDrawer/` — current drawer (will be replaced)
- `lib/db/queries/drawer.ts` — current drawer data query (territory + landmarks + recent PR fetch)
- `lib/github/rest.ts` or `lib/github/graphql.ts` — current PR title fetch path

Carefully read the code from previous phases. Understand the design intent before working.

## Work

Replace `TerritoryDrawer/` with `ClusterDrawer/`. Add per-star "Why is this lit?" explanation + misclassification feedback. Wire into Constellation main page.

### 1. Create `app/_components/ClusterDrawer/`

#### `ClusterDrawer.tsx` — root drawer component (client)

```tsx
'use client'
import type { TerritoryType } from '@/features/territories/registry'
import { TERRITORIES } from '@/features/territories/registry'
import { StarRow } from './StarRow'
import { RecentPRs } from './RecentPRs'

export type ClusterDrawerData = {
  type: TerritoryType
  stage: number
  growth30d: number
  stageChangedAt: string | null
  litStars: Array<{
    tech_key: string
    displayName: string
    weight: number
    firstUnlockedAt: string | null
    topContributingRepo: { owner: string; name: string } | null
  }>
}

export function ClusterDrawer(props: {
  data: ClusterDrawerData
  /** When opened via star click, focus this star's row. */
  focusedTechKey?: string
  /** Visitor variant adds a CTA footer. Owner sees no footer CTA. */
  variant: 'owner' | 'visitor'
  onClose: () => void
}): JSX.Element {
  // Layout:
  //   Desktop: right side panel, 480px fixed width (overlay over canvas).
  //   Mobile: bottom sheet — half-screen default, swipe up for full screen.
  //
  // Header:
  //   - Cluster name: TERRITORIES[type].name (e.g. "Backend")
  //   - Status: "Active this week" if any litStar has firstUnlockedAt in last 7 days OR growth30d > 0
  //             "· Recently expanded" appended if stageChangedAt within last 7 days
  //   - Stage shown as small footer text (e.g. "Stage 2") — secondary disclosure per ADR-37.
  //
  // Body (top to bottom):
  //   1. Lit stars list — one StarRow per litStar, sorted by weight DESC (alpha tie-break).
  //      If focusedTechKey matches a row: highlight background + auto-scroll into view + auto-expand its WhyExpansion.
  //   2. Recent PRs section — <RecentPRs userId={...} cluster={type} />.
  //   3. (visitor only) CTA footer: "Want to see yours? Create yours, free →" linking to `/?from=profile&inviter=${ownerUsername}` (parent passes context).
  //
  // Dismissal:
  //   - X button (always visible top-right).
  //   - Outside click (overlay backdrop).
  //   - ESC key.
  //   - Mobile swipe-down (touch event handler on the sheet).
  //
  // Use framer-motion for slide-in (desktop) / slide-up (mobile).

  return /* ... */ null as any
}
```

#### `StarRow.tsx` — one lit star with inline "Why is this lit?" expansion

```tsx
'use client'
import { useState } from 'react'
import { WhyExpansion } from './WhyExpansion'

export function StarRow(props: {
  tech_key: string
  displayName: string
  weight: number
  firstUnlockedAt: string | null
  topContributingRepo: { owner: string; name: string } | null
  brightnessDescriptor: 'brightest' | 'bright' | 'dim'
  highlighted: boolean       // when focused from star click
  expandedByDefault: boolean // when focused, expansion opens automatically
  ownerUserId: string
  territoryType: string
  /** Visitor view: feedback button is hidden. */
  hideFeedback: boolean
}): JSX.Element {
  const [expanded, setExpanded] = useState(props.expandedByDefault)

  // Row content (single click toggles expansion):
  //   - Star icon (small filled circle using cluster color — visual mirror of canvas star)
  //   - displayName
  //   - brightnessDescriptor
  //   - "since {month} {year}" computed from firstUnlockedAt
  //   - "from {owner}/{name}" if topContributingRepo is present
  //
  // When expanded: render <WhyExpansion ... /> below the row.

  return /* ... */ null as any
}
```

#### `WhyExpansion.tsx` — per-star detection rule + feedback button

```tsx
'use client'
import { useState } from 'react'
import { MisclassificationModal } from './MisclassificationModal'

/**
 * Maps a detection-rule kind to product-facing copy (per docs/tech-catalog.md).
 * The classifier emits which rule matched per star; here we summarize.
 */
function ruleToCopy(rule: {
  kind: string
  // payload fields vary; keep generic
}): string {
  switch (rule.kind) {
    case 'ext':              return 'extension-based files'
    case 'path':             return 'specific path prefixes'
    case 'filename':         return 'a known filename'
    case 'packageJson':      return 'package.json dependency'
    case 'requirementsTxt':  return 'requirements.txt dependency'
    case 'goMod':            return 'go.mod module'
    case 'gemfile':          return 'Gemfile gem'
    case 'cargoToml':        return 'Cargo.toml crate'
    default:                 return 'matched activity'
  }
}

export function WhyExpansion(props: {
  tech_key: string
  displayName: string
  /** Rule summaries derived from classifier matches for this user. */
  matchedRules: Array<{ kind: string; copy: string }>
  contributingRepos: Array<{ owner: string; name: string; matchCount: number }>
  /** Activity breakdown across this star's contributing activities. */
  activity: { commits: number; prs: number; issues: number }
  hideFeedback: boolean
  ownerUserId: string
  territoryType: string
  /** Optionally pass the repo most associated with this star, used in feedback. */
  primaryRepoId: string | null
}): JSX.Element {
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  // Render:
  //   "Lit from {rule copy 1} and {rule copy 2}." (or just one if only one)
  //   "Contributing repos: {owner1}/{repo1}, {owner2}/{repo2}, ..."  (up to 3)
  //   "{N commits} · {M PRs}" (omit zeros)
  //   Button: "This doesn't look right" → opens MisclassificationModal (unless hideFeedback).

  return /* ... */ null as any
}
```

#### `MisclassificationModal.tsx` — feedback form

```tsx
'use client'
import { useState, useTransition } from 'react'
import { submitMisclassificationFeedback } from '@/features/feedback/misclassification.actions'

export function MisclassificationModal(props: {
  tech_key: string
  territoryType: string
  relatedRepoId: string | null
  onClose: () => void
}): JSX.Element {
  const [category, setCategory] = useState<'wrong_category' | 'shouldnt_be_lit' | 'not_mine' | 'other'>('wrong_category')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit() {
    startTransition(async () => {
      const result = await submitMisclassificationFeedback({
        tech_key: props.tech_key,
        territory_type: props.territoryType,
        related_repo_id: props.relatedRepoId,
        category,
        note: note.trim() || null,
      })
      if (result.kind === 'rate_limited') {
        setError("You've reached today's feedback limit. Thanks!")
      } else if (result.kind === 'error') {
        setError('Could not submit. Try again.')
      } else {
        // Trigger toast via parent context (use sonner toast; the action returns ok)
        props.onClose()
      }
    })
  }

  // Render:
  //   Heading: "Help us understand. What looks off?"
  //   Category select (4 options)
  //   Optional textarea
  //   Footer disclaimer: "We may use this to improve classification. We won't email you about this submission."
  //   Submit button (disabled while pending)
  //   Inline error display
  //   X to close (no Cancel; this is a quick action)

  return /* ... */ null as any
}
```

#### `RecentPRs.tsx` — fetches PR titles on-demand from GitHub at view time (ADR-9)

```tsx
'use client'
import { useEffect, useState } from 'react'

type PR = { number: number; title: string; repo: string; url: string; updated_at: string }

export function RecentPRs(props: {
  userId: string
  cluster: string  // territory_type
}): JSX.Element {
  const [prs, setPrs] = useState<PR[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/drawer/recent-prs?cluster=${encodeURIComponent(props.cluster)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed'))))
      .then((data) => { if (!cancelled) { setPrs(data.prs); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError('Could not load PRs'); setLoading(false) } })
    return () => { cancelled = true }
  }, [props.cluster])

  // While loading: 3 skeleton rows.
  // On success: render up to 3 PR rows (title + repo + relative time). Last row: "See more on GitHub →" link.
  // On error: text "Could not load recent PRs."

  return /* ... */ null as any
}
```

### 2. Create the `recent-prs` API route

`app/api/drawer/recent-prs/route.ts`:

```ts
import 'server-only'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { fetchRecentPRsForUserInCluster } from '@/lib/github/graphql'

export async function GET(req: Request) {
  const user = await requireUser()
  const { searchParams } = new URL(req.url)
  const cluster = searchParams.get('cluster')

  if (!cluster) return NextResponse.json({ prs: [] })

  try {
    const prs = await fetchRecentPRsForUserInCluster({
      userId: user.id,
      githubLogin: user.githubLogin,
      territoryType: cluster,
      limit: 3,
    })
    return NextResponse.json({ prs })
  } catch {
    return NextResponse.json({ prs: [] }, { status: 200 })
    // Graceful degradation: drawer shows "Could not load recent PRs."
  }
}
```

`fetchRecentPRsForUserInCluster` lives in `lib/github/graphql.ts` (or `rest.ts`). It queries GitHub for the user's most recent PRs in repos that contribute to this cluster (look up `repositories.is_included` joined to `activity_territories` where `territory_type = cluster`).

If the function already exists with a different signature from the pre-pivot code, adapt it. PR titles are NOT stored; they are fetched on demand per ADR-9.

### 3. Create `features/feedback/misclassification.ts` + Server Action

`features/feedback/misclassification.ts`:

```ts
import 'server-only'
import { and, eq, gte, count } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { misclassificationFeedback } from '@/lib/db/schema/misclassification-feedback'

const RATE_LIMIT_COUNT = 5
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000

export type SubmitInput = {
  userId: string
  tech_key: string
  territory_type: string
  related_repo_id: string | null
  category: 'wrong_category' | 'shouldnt_be_lit' | 'not_mine' | 'other'
  note: string | null
}

export type SubmitResult =
  | { kind: 'ok' }
  | { kind: 'rate_limited' }
  | { kind: 'error'; message: string }

export async function submitMisclassificationFeedback(input: SubmitInput): Promise<SubmitResult> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)

  const [{ value: recentCount }] = await db
    .select({ value: count() })
    .from(misclassificationFeedback)
    .where(
      and(
        eq(misclassificationFeedback.userId, input.userId),
        gte(misclassificationFeedback.createdAt, since),
      ),
    )

  if (recentCount >= RATE_LIMIT_COUNT) return { kind: 'rate_limited' }

  try {
    await db.insert(misclassificationFeedback).values({
      userId: input.userId,
      techKey: input.tech_key,
      territoryType: input.territory_type,
      relatedRepoId: input.related_repo_id,
      category: input.category,
      note: input.note,
    })
    return { kind: 'ok' }
  } catch (e) {
    return { kind: 'error', message: (e as Error).message }
  }
}
```

`features/feedback/misclassification.actions.ts` (Server Action):

```ts
'use server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { submitMisclassificationFeedback as submit } from './misclassification'

const inputSchema = z.object({
  tech_key: z.string().min(1).max(60),
  territory_type: z.enum([
    'frontend_land', 'backend_fortress', 'data_pipeline_zone',
    'testing_lab', 'devops_harbor', 'docs_library',
  ]),
  related_repo_id: z.string().uuid().nullable(),
  category: z.enum(['wrong_category', 'shouldnt_be_lit', 'not_mine', 'other']),
  note: z.string().max(2000).nullable(),
})

export async function submitMisclassificationFeedback(input: z.infer<typeof inputSchema>) {
  const user = await requireUser()
  const parsed = inputSchema.parse(input)
  return submit({ userId: user.id, ...parsed })
}
```

### 4. Replace `TerritoryDrawer` usage in the main page

In `app/(authenticated)/page.tsx` (or wherever the drawer is wired up), swap the import:

```ts
import { ClusterDrawer } from '@/app/_components/ClusterDrawer/ClusterDrawer'
```

Wire the `Constellation`'s `onClusterClick` and `onStarClick` to open the drawer with `focusedTechKey` set in the star case. State shape:

```tsx
const [drawer, setDrawer] = useState<{
  cluster: TerritoryType
  focusedTechKey?: string
} | null>(null)
```

Pass `variant="owner"` from the authenticated owner page; visitor page sets `variant="visitor"` (handled in Phase 6).

### 5. Build the drawer data query

`lib/db/queries/drawer.ts` already exists for the old `TerritoryDrawer`. Update it to return the new `ClusterDrawerData` shape (with `displayName` from catalog, `topContributingRepo` resolved per landmark).

Use `withUserScope(userId, landmarks.userId)` from `_helpers.ts` per ADR-46.

Resolve `topContributingRepo`:
- Query `activity_territories` joined to `activities` joined to `repositories` filtered by `(user_id, territory_type)` and matched against the activity's classifier hit for this `tech_key`.
- If detection rule precision is hard, the simplification is acceptable: for each landmark, pick the repository that contributed the most activities of any type to this cluster.

### 6. Delete `app/_components/TerritoryDrawer/` and `app/_components/TerritoryDrawer.tsx`

```bash
rm -rf app/_components/TerritoryDrawer/
rm -f app/_components/TerritoryDrawer.tsx
```

Verify no remaining imports:

```bash
git grep -l "TerritoryDrawer" -- ':!tasks/' ':!docs/' || true
```

Expected: empty.

### 7. Update integration tests

If `tests/integration/territory-drawer.test.ts` exists, delete it. Add a placeholder `tests/integration/cluster-drawer.test.ts` smoke that:

- Creates a test user with 2 landmarks (`react`, `nextjs`) in `frontend_land`.
- Queries the drawer data via the new query function.
- Asserts: cluster name "Frontend", 2 lit stars with the expected `displayName` and `weight`, brightness ordering correct, top contributing repo populated.

The full UI is exercised in Phase 11 E2E.

## Acceptance Criteria

```bash
# TypeScript builds cleanly
npm run build

# Unit tests pass (existing + any new)
npx vitest run tests/unit

# New components exist
test -f app/_components/ClusterDrawer/ClusterDrawer.tsx
test -f app/_components/ClusterDrawer/StarRow.tsx
test -f app/_components/ClusterDrawer/WhyExpansion.tsx
test -f app/_components/ClusterDrawer/MisclassificationModal.tsx
test -f app/_components/ClusterDrawer/RecentPRs.tsx
test -f features/feedback/misclassification.ts
test -f features/feedback/misclassification.actions.ts
test -f app/api/drawer/recent-prs/route.ts

# Old drawer gone
test ! -d app/_components/TerritoryDrawer
test ! -f app/_components/TerritoryDrawer.tsx

# No stale imports
test -z "$(git grep -l 'TerritoryDrawer' -- ':!tasks/' ':!docs/' 2>/dev/null)"

# SPDX MIT header on the misclassification module is NOT required — it is proprietary
# (the renderer / classifier are MIT; the feedback / sync / drawer logic stays proprietary).
```

## How to verify AC

Run the AC commands above. If all pass, set the phase 4 status to `"completed"` in `/tasks/1-pivot-mvp/index.json`.
If you cannot make them pass after 3 attempts, set status to `"error"` and write the error in the phase's `"error_message"` field in index.json.

## Notes

- **PR titles must NOT be persisted.** Fetched on demand per ADR-9. Do not introduce a `pr_titles` table or any caching that writes them to DB.
- **Rate limit is application-level** (5 per 24h per user). Do not add a DB trigger; the Server Action handles it.
- **RLS on `misclassification_feedback`**: INSERT self only. SELECT is denied to authenticated users — service role only. The user cannot read their own feedback back. This is by design (forward-only audit).
- **`withUserScope` is mandatory** for any new Drizzle query in this phase. Per ADR-46.
- **Tooltip and drawer dismissal must coexist.** Hovering a star shows a tooltip; clicking opens the drawer. Mobile: tap → drawer (no tooltip).
- **Do not introduce any payment / paid-tier code.** Misclassification feedback is free.
- **Owner vs visitor variant**: this phase implements the data path and the `variant` prop. The visitor page (`app/[username]/page.tsx`) gets wired up in Phase 6.
- **No design polish beyond functional layout.** Spark animations, glow tuning, color contrast — those happen in Phase 11 / 12.
