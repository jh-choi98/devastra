# Phase 7: Living Map Visualization

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/prd.md` §Mission
- `/docs/flow.md` §Flow 1 step 6-8
- `/docs/adr.md` (ADR-1, ADR-2)
- `/docs/code-architecture.md` §Directory tree → `app/_components/Map/`
- `/CLAUDE.md`
- `/tasks/0-mvp/docs-diff.md`

Then verify Phase 6's output:

- `features/sync/runner.ts` exports `initialSync`, `incrementalSync`, etc.
- `features/territories/registry.ts` exports `TERRITORIES` and `TerritoryType`
- `npm test -- initial-sync` passes

## Work

Build the visualization layer. This phase delivers pure components — no Realtime subscription yet (Phase 8 wires it).

### 1. Procedural island shape generator

`app/_components/Map/island-shape.ts`:

```ts
import { createNoise2D } from 'simplex-noise'

export type IslandShape = {
  pathD: string         // SVG path data
  centerX: number
  centerY: number
  radius: number        // bounding circle radius for landmark placement
}

export function generateIslandShape(opts: {
  seed: string                // stable: userId + ':' + territoryType
  stage: number               // 1-5
  baseRadius?: number
  jitter?: number
}): IslandShape
```

Implementation: seed the noise function via a deterministic hash of the seed string (e.g. cyrb53). Sample 64 angular points around a circle of `baseRadius × (1 + 0.15 × (stage - 1))`. Perturb each by noise(angle × scale). Return the resulting closed SVG path.

This is a pure function — same `seed + stage` always returns identical path.

### 2. Landmark placement

`app/_components/Map/landmark-placement.ts`:

```ts
export function placeLandmarks(opts: {
  islandSeed: string
  islandRadius: number
  landmarks: { tech_key: string; weight: number }[]
}): { tech_key: string; x: number; y: number; size: number }[]
```

Use the same hash-seeded RNG to place each landmark inside the island bounds. `size` scales with `weight` (e.g. `size = Math.min(24, 8 + Math.log(weight) * 4)`). Order doesn't matter for placement, but must be stable.

### 3. Map root component

`app/_components/Map/LivingMap.tsx`:

```tsx
'use client'
import { motion } from 'framer-motion'
import { Island } from './Island'
import type { TerritoryType } from '@/features/territories/registry'

export type MapData = {
  userId: string
  territories: Array<{
    type: TerritoryType
    stage: number
    totalWeight: number
    growth30d: number
    stageChangedAt: string | null
  }>
  landmarks: Array<{
    tech_key: string
    territory: TerritoryType
    weight: number
    firstUnlockedAt: string | null
  }>
  diffSince?: Date | null          // for "grown this week" badges
}

export function LivingMap({ data, onIslandClick }: {
  data: MapData
  onIslandClick?: (territory: TerritoryType) => void
}) { ... }
```

Layout: 6 islands placed at fixed angles around the viewport center (12, 2, 4, 6, 8, 10 o'clock positions). The slot-to-territory mapping is stable across loads via a deterministic order in `TERRITORIES`. Ocean background is a Tailwind dark gradient. Use `motion.svg` for entry animation.

Each `Island` is wrapped in `motion.g` with a layout transition so size changes (when stage updates) animate smoothly.

### 4. Island component

`app/_components/Map/Island.tsx`:

```tsx
'use client'
import { motion } from 'framer-motion'
import { TERRITORIES, TerritoryType } from '@/features/territories/registry'

export function Island(props: {
  type: TerritoryType
  stage: number
  growth30d: number
  recentlyGrown: boolean          // true if stage_changed_at is within last 7 days
  landmarks: Array<{ tech_key: string; weight: number; firstUnlockedAt: string | null }>
  userId: string                  // for seeding
  onClick?: () => void
}): JSX.Element
```

Render:
- SVG `<path d={shape.pathD} fill={TERRITORIES[type].color} />`
- Landmark icons placed via `placeLandmarks`. Each landmark uses a simple shape (circle/square/triangle keyed by territory's `landmarkColor`).
- Always-visible label below the island: `<text>{TERRITORIES[type].name}  Stage {stage}</text>`.
- If `recentlyGrown`, overlay a glow filter and a small badge `+{Math.round(growth30d / totalWeight * 100)}% this week`. (For now, simple Tailwind-styled `<foreignObject>` works.)
- `onClick` triggers callback.

### 5. Landmark component

`app/_components/Map/Landmark.tsx`:

```tsx
'use client'
export function Landmark(props: {
  tech_key: string
  x: number
  y: number
  size: number
  color: string
  recentlyUnlocked: boolean      // first_unlocked_at within last 7 days
}): JSX.Element
```

Each landmark renders an iconic shape sized by `size`. Tooltip on hover showing `landmarkName` from the catalog (look up via a frontend-safe registry — see step 6).

### 6. Frontend tech registry (safe, no server-only)

`features/territories/tech-catalog-public.ts`:

```ts
// Auto-generated or manually mirrored from tech-catalog.ts but without server-only constraint
import type { TerritoryType } from './registry'

export type PublicTechEntry = { tech_key: string; landmarkName: string; territory: TerritoryType }
export const PUBLIC_TECH_CATALOG: readonly PublicTechEntry[]
export function getPublicTech(key: string): PublicTechEntry | undefined
```

This file only contains the display-safe subset (no detection rules — rules live in server-only `tech-catalog.ts`). The two files must stay in sync — add a `tests/unit/tech-catalog-parity.test.ts` that imports both and asserts the `tech_key`/`landmarkName`/`territory` triples match.

### 7. Territory detail drawer

`app/_components/TerritoryDrawer.tsx`:

```tsx
'use client'
export function TerritoryDrawer(props: {
  open: boolean
  territory: TerritoryType | null
  data: TerritoryDrawerData | null     // see shape below
  onClose: () => void
}): JSX.Element

export type TerritoryDrawerData = {
  type: TerritoryType
  stage: number
  growth30d: number
  totalWeight: number
  topRepos: Array<{ owner: string; name: string; githubUrl: string }>
  recentPRs: Array<{ title: string | null; githubUrl: string }>   // titles null until Phase 8 wires on-demand fetch
  interpretation: string               // single-line summary; deterministic from data
}
```

Right-side slide-out, 40% width on desktop, full-width modal on mobile. Framer Motion `motion.aside` with x-axis enter/exit. Inside: territory name + stage badge, growth percentage, two-column section for top repos and recent PRs (each as an external link), and the single-line interpretation at the bottom.

The interpretation string is computed by a helper:

```ts
// app/_components/TerritoryDrawer/interpretation.ts
export function deriveInterpretation(data: TerritoryDrawerData): string
```

Rules (purely from data, no LLM):
- "Recent focus: {top tech_key landmarkName}" if there's one dominant landmark in the last 30d
- "Active across {N} repos this month" if growth is distributed
- "Steady territory — no new activity in 30 days" if growth_30d is 0
- Always English, always concise.

### 8. Dev demo page

`app/dev/map/page.tsx`:

```tsx
import { LivingMap } from '@/app/_components/Map/LivingMap'

const MOCK_DATA = { /* hand-crafted, covering all 6 territories with varied stages and ≥10 landmarks */ }

export default function DevMapPage() {
  return <LivingMap data={MOCK_DATA} onIslandClick={(t) => console.log('clicked', t)} />
}
```

Gate this page so it returns 404 in production:

```ts
export const dynamic = 'force-static'
export default function DevMapPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  // ...
}
```

This route is for local visual iteration; it is NOT a feature page.

### 9. Unit test for parity

`tests/unit/tech-catalog-parity.test.ts` — verify `PUBLIC_TECH_CATALOG` and the public-safe view of `TECH_CATALOG` have the same length and matching triples.

`tests/unit/island-shape.test.ts` — verify `generateIslandShape` is deterministic (same seed+stage → same path string) and that stage 5 path is larger than stage 1 path (by bounding box width).

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm run build
npm test -- tech-catalog-parity
npm test -- island-shape
# Visual check: start dev server and open /dev/map
# (manual verification — not part of automated AC)
```

## How to verify AC

Run the AC commands. Tests must pass. The build must succeed.

For visual verification, the running phase agent may launch `npm run dev` locally and check `/dev/map` renders six labeled islands. This is optional; CI cares only about the build + unit tests.

If all automated AC pass, set this phase's status to `"completed"` in `/tasks/0-mvp/index.json`. If you cannot make AC pass after 3 attempts, set status to `"error"`.

## Notes

- Do NOT wire Realtime here. Phase 8 handles Realtime + the actual `/` page that consumes `LivingMap`.
- Do NOT fetch PR titles from GitHub here. The drawer accepts `recentPRs` with `title: null` placeholders for now; Phase 8 wires the on-demand fetch.
- Do NOT introduce any animation library other than `framer-motion`.
- Do NOT use `<canvas>`. SVG only (ADR-1 implies SVG; OG images reuse the same code via `@vercel/og`).
- Island positions are stable for now (fixed angular slots). If you want to randomize them per user later, that goes through a deterministic seed too.
- All identifiers, comments, mock data labels in English.
- The `/dev/map` route is for dev only; it returns 404 in production.
