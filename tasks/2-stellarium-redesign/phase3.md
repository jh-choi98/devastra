# Phase 3: Switch, Skeleton, Rename

## Preparation

Read these docs first:

- `/docs/adr.md` ADR-62 (server-side feature flag, SSR skeleton, dynamic import, fallback banner), ADR-63 (`/dev/map` env-var guard)
- `/docs/screens.md` §C Canvas (specifically the SSR / first paint subsection and the "Browser without WebGL" subsection)
- `/docs/code-architecture.md` — Constellation directory structure (Constellation.tsx → 3-way switch, ConstellationSVG.tsx → legacy), env vars `CONSTELLATION_RENDERER` + `ENABLE_DEV_MAP`
- `/CLAUDE.md` — "Constellation renderer feature flag", "/dev/map env-var guard", "Test/mock route guards"
- `/tasks/2-stellarium-redesign/docs-diff.md`

Verify previous phase outputs:

- `features/constellation/render/*` modules implemented (Phase 2)
- All scaffolding files exist under `app/_components/Constellation/` (Phase 1)
- The pre-existing dirty state from Phase 0 is still present: `Constellation.tsx` M, three deleted files (Cluster/ClusterAura/Connections), `dev/map/page.tsx` M

Read the current code:

- `app/_components/Constellation/Constellation.tsx` — current SVG renderer (~327 lines)
- `app/_components/Constellation/star-positions.ts` — current placement helpers
- `app/page.tsx` — landing page server component
- `app/[username]/page.tsx` — public profile server component
- `app/(authenticated)/page.tsx` — main authenticated page (server)
- `app/(authenticated)/_map-container.tsx` — client wrapper holding drawer state
- `app/[username]/_public-profile-map.tsx` — public profile client wrapper
- `app/dev/map/page.tsx` — dev playground

## Work

This phase performs the **structural pivot**. After this phase the renderer is feature-flagged: `CONSTELLATION_RENDERER=svg` continues to render the existing SVG implementation; `CONSTELLATION_RENDERER=webgl` (default) renders a skeleton + an empty R3F scene placeholder. The WebGL scene doesn't render anything meaningful yet — that's Phase 4+.

### 1. Rename the current renderer to `ConstellationSVG.tsx`

```bash
git mv app/_components/Constellation/Constellation.tsx \
       app/_components/Constellation/ConstellationSVG.tsx
```

Note: the pre-existing working-tree modification to `Constellation.tsx` carries through the rename. After `git mv`, `git status` will show `R  ` (renamed with modifications staged separately).

Inside the renamed file:

- Update the default export name from `Constellation` to `ConstellationSVG` so the new switch can re-export `Constellation` separately.
- Reabsorb the deleted siblings: the three files `Cluster.tsx`, `ClusterAura.tsx`, `Connections.tsx` are deleted in the working tree (from a pre-existing cleanup). If the renamed file references them via `import`, either inline their content (preferred — keeps `ConstellationSVG.tsx` self-contained as a fallback) or restore them via `git checkout HEAD -- app/_components/Constellation/Cluster.tsx ...`. Choose the inlining path so the legacy renderer stays in a single file for clean removal in a future PR.

### 2. Implement the new `Constellation.tsx` 3-way switch

Replace the placeholder created in Phase 1 (`app/_components/Constellation/Constellation.tsx` no longer exists after the rename — recreate it):

```tsx
'use client'

import { ConstellationSVG } from './ConstellationSVG'
import { ConstellationWebGL } from './ConstellationWebGL'
import type { ConstellationData } from './types'  // existing data type
// If the ConstellationData type currently lives in ConstellationSVG.tsx,
// extract it to a new app/_components/Constellation/types.ts in this phase.

export interface ConstellationProps {
  data: ConstellationData
  /** Server-side feature flag forwarded from the page. Defaults to 'webgl'. */
  renderer?: 'webgl' | 'svg'
  /** Existing optional viewport hint. */
  viewport?: 'desktop' | 'mobile' | 'og'
  /** Optional ISO timestamp for diff highlighting. */
  diffSince?: string | null
  onClusterClick?: (type: TerritoryType) => void
  onStarClick?: (tech_key: string) => void
}

export function Constellation({ renderer = 'webgl', ...props }: ConstellationProps) {
  if (renderer === 'svg') return <ConstellationSVG {...props} />
  return <ConstellationWebGL {...props} />
}
```

If `ConstellationData` is currently inline in `ConstellationSVG.tsx`, extract it now into a new `app/_components/Constellation/types.ts` so both renderers and downstream callers (including `lib/og/ConstellationImage.tsx`) can import it cleanly.

### 3. Implement `ConstellationWebGL.tsx`

```tsx
'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from './Skeleton'
import { useWebGLDetect } from './use-webgl-detect'
import type { ConstellationProps } from './Constellation'

// Lazy import the Scene to keep R3F out of the initial bundle.
const Scene = dynamic(() => import('./Scene'), {
  ssr: false,
  loading: () => null,  // Skeleton already shows during load
})

function WebGLUnsupportedBanner() {
  return (
    <div role="status" className="absolute top-4 left-1/2 -translate-x-1/2 ...">
      Your browser doesn't support advanced graphics; using simplified view.
    </div>
  )
}

export function ConstellationWebGL(props: Omit<ConstellationProps, 'renderer'>) {
  const webglOK = useWebGLDetect()

  return (
    <div className="relative w-full h-full">
      <Skeleton {...props} />
      {webglOK ? <Scene {...props} /> : <WebGLUnsupportedBanner />}
    </div>
  )
}
```

### 4. Implement `Skeleton.tsx`

SSR-safe, client component (`'use client'` directive is fine — it can still render server-side). No `useEffect`, no `useState`. Render-only.

The skeleton draws (HTML/SVG, ~3KB inline):

- Full-viewport dim background (CSS gradient: near-black `#020207` → `#050307`)
- 6 Voronoi boundary polygons as thin SVG `<polygon>` strokes (10% opacity, muted blue-gray)
- 6 cluster labels positioned per the anchor map (small blue-white sans-serif, e.g. "Backend")

Use `features/constellation/render/voronoi.ts` + `anchors.ts` to compute the layout.

```tsx
'use client'
import { voronoiCells } from '@/features/constellation/render/voronoi'
import { anchorsFor } from '@/features/constellation/render/anchors'

export interface SkeletonProps {
  viewport?: 'desktop' | 'mobile' | 'og'
}

export function Skeleton({ viewport = 'desktop' }: SkeletonProps) {
  const cells = voronoiCells(viewport)
  const anchors = anchorsFor(viewport)
  return (
    <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
      <rect width="1000" height="700" fill="url(#sky-bg)" />
      <defs>
        <linearGradient id="sky-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#020207" />
          <stop offset="1" stopColor="#050307" />
        </linearGradient>
      </defs>
      {cells.map((cell) => (
        <polygon
          key={cell.type}
          points={cell.polygon.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#3a4555"
          strokeOpacity="0.1"
          strokeWidth="0.7"
        />
      ))}
      {anchors.map((a) => (
        <text
          key={a.type}
          x={a.x}
          y={a.y + a.spread + 18}
          fontSize="11"
          fill="#8aa0b8"
          textAnchor="middle"
        >
          {clusterDisplayName(a.type)}
        </text>
      ))}
    </svg>
  )
}
```

`clusterDisplayName` returns `'Frontend' | 'Backend' | 'Data' | 'Testing' | 'DevOps' | 'Docs'` per CLAUDE.md "Territory types".

Hard rule: the Skeleton must be SSR-renderable. Run `npm run build` and verify it appears in the SSR output.

### 5. Implement `Scene.tsx` as an empty R3F canvas (placeholder)

```tsx
'use client'
import { Canvas } from '@react-three/fiber'

export default function Scene() {
  return (
    <Canvas
      className="absolute inset-0"
      dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 2}
      gl={{ antialias: true, alpha: true }}
      style={{ opacity: 0, transition: 'opacity 400ms ease-out' }}
      onCreated={({ gl }) => {
        // Phase 4+: layers mount here. For now, leave empty.
        requestAnimationFrame(() => {
          if (gl.domElement.style) gl.domElement.style.opacity = '1'
        })
      }}
    >
      {/* Phase 4+: <SkyBackground />, <MilkyWay />, <FieldStars />, etc. */}
    </Canvas>
  )
}
```

The fade-in is wired now so Phase 4+ doesn't need to revisit. Default opacity 0 → 1 over 400ms after `onCreated` fires.

### 6. Implement `use-webgl-detect.ts`

```tsx
'use client'
import { useEffect, useState } from 'react'

/**
 * Returns true if WebGL2 (or WebGL1 fallback) is available.
 * Defaults to true during SSR so the Scene is mounted optimistically;
 * once mounted client-side, this runs the actual check and may downgrade.
 */
export function useWebGLDetect(): boolean {
  const [supported, setSupported] = useState<boolean>(true)
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
      setSupported(Boolean(gl))
    } catch {
      setSupported(false)
    }
  }, [])
  return supported
}
```

### 7. Implement `state.ts` — ConstellationContext

```tsx
'use client'
import { createContext, useContext } from 'react'
import type { TerritoryType } from '@/lib/db/schema/territories'

export type CinematicMode = 'idle' | 'reveal' | 'first-ever' | 'stage-up'

export interface ConstellationState {
  selected: TerritoryType | null
  hovered: TerritoryType | null
  cinematic: CinematicMode
  reducedMotion: boolean
  setHovered: (t: TerritoryType | null) => void
  startCinematic: (mode: CinematicMode) => void
}

const ConstellationContext = createContext<ConstellationState | null>(null)

export function useConstellationState(): ConstellationState {
  const v = useContext(ConstellationContext)
  if (!v) throw new Error('useConstellationState outside ConstellationContext.Provider')
  return v
}

export { ConstellationContext }
```

The actual Provider lives inside `ConstellationWebGL.tsx` (wrapping Scene + overlays) and is wired in Phase 7/8 when these state values start being consumed. For Phase 3, just export the context + hook.

### 8. Plumb `renderer` prop from server pages → client wrappers → Constellation

For each of these server components, read `process.env.CONSTELLATION_RENDERER` and pass it down as `renderer`:

- `app/page.tsx` → `LandingHero` (or wherever `<Constellation>` is rendered in landing)
- `app/(authenticated)/page.tsx` → `_map-container.tsx`
- `app/[username]/page.tsx` → `_public-profile-map.tsx`

```tsx
// app/page.tsx (server component)
export default async function LandingPage() {
  const renderer = (process.env.CONSTELLATION_RENDERER as 'webgl' | 'svg' | undefined) ?? 'webgl'
  return <LandingHero renderer={renderer} ... />
}
```

Then each client wrapper threads it into `<Constellation renderer={renderer} ... />`.

For `app/dev/map/page.tsx`: hardcode `renderer="webgl"` since /dev/map IS the WebGL playground.

### 9. Replace `/dev/map` env-var guard

Current `app/dev/map/page.tsx` has:

```ts
if (process.env.NODE_ENV === 'production') notFound()
```

Replace with:

```ts
if (process.env.ENABLE_DEV_MAP !== '1') notFound()
```

This allows CI / Vercel preview to set `ENABLE_DEV_MAP=1` for Playwright visual regression while keeping production deploys 404.

Other test routes under `app/api/test/*` keep their `NODE_ENV === 'production'` guards (ADR-47 / ADR-63 — only `/dev/map` uses the new mechanism).

### 10. Update `app/dev/map/page.tsx` for layer toggle prep

Add support for `?layers=` query param (read on the page; pass to a small client wrapper that toggles layer visibility). For Phase 3, the wrapper just hardcodes `renderer="webgl"` and passes mock data to `<Constellation>`. Layer toggling is wired in Phase 4 when actual layers exist.

Convert the page from `force-static` to allow `searchParams` if needed:

```tsx
// app/dev/map/page.tsx
import { notFound } from 'next/navigation'
import { Constellation } from '@/app/_components/Constellation/Constellation'

export const dynamic = 'force-dynamic'

const MOCK_DATA = { /* unchanged from current state */ }

export default function DevMapPage({ searchParams }: { searchParams?: { layers?: string } }) {
  if (process.env.ENABLE_DEV_MAP !== '1' && process.env.NODE_ENV !== 'development') notFound()
  return (
    <main className="w-screen h-screen">
      <Constellation data={MOCK_DATA} renderer="webgl" />
    </main>
  )
}
```

Note: keep dev-mode access (`NODE_ENV === 'development'`) for local `npm run dev` without needing to set `ENABLE_DEV_MAP=1` every time.

### 11. Update `docs/dev-setup.md` if needed

Verify `CONSTELLATION_RENDERER` and `ENABLE_DEV_MAP` are documented (they were added by Phase 0). No edits expected here.

## Acceptance Criteria

```bash
# (1) File renames are correct
test -f app/_components/Constellation/ConstellationSVG.tsx
test -f app/_components/Constellation/Constellation.tsx
test -f app/_components/Constellation/ConstellationWebGL.tsx
test -f app/_components/Constellation/Skeleton.tsx
test -f app/_components/Constellation/Scene.tsx
test -f app/_components/Constellation/state.ts
test -f app/_components/Constellation/use-webgl-detect.ts

# (2) The new Constellation.tsx is the 3-way switch
grep -q "renderer === 'svg'" app/_components/Constellation/Constellation.tsx

# (3) Build passes
npm run build

# (4) SVG path still works
CONSTELLATION_RENDERER=svg npm run build  # type-check passes with the flag

# (5) /dev/map uses ENABLE_DEV_MAP not NODE_ENV
grep -q "ENABLE_DEV_MAP" app/dev/map/page.tsx
! grep -q "process.env.NODE_ENV === 'production'" app/dev/map/page.tsx | head -1  # NODE_ENV production check should be replaced

# (6) Server pages read CONSTELLATION_RENDERER server-side
grep -l "CONSTELLATION_RENDERER" app/page.tsx app/\(authenticated\)/page.tsx app/\[username\]/page.tsx
# Should appear in all three (or in equivalent server components that mount Constellation)

# (7) No NEXT_PUBLIC_CONSTELLATION_RENDERER anywhere
! grep -r "NEXT_PUBLIC_CONSTELLATION_RENDERER" app/ lib/ features/

# (8) Three deleted Cluster/ClusterAura/Connections files are NOT silently restored
! test -f app/_components/Constellation/Cluster.tsx
! test -f app/_components/Constellation/ClusterAura.tsx
! test -f app/_components/Constellation/Connections.tsx
```

## How to verify AC

Run the AC commands. All eight must pass. Set phase 3 status to `"completed"` in `/tasks/2-stellarium-redesign/index.json`. Up to 3 remediation attempts; on failure set status to `"error"` with `"error_message"`.

## Notes

- **The renderer feature flag is server-side only.** Never use `NEXT_PUBLIC_CONSTELLATION_RENDERER`. The value must be read in a server component and passed as a prop.
- **Do not yet implement WebGL layers.** Scene.tsx is intentionally empty. Phase 4 mounts the first layers.
- **`ConstellationSVG.tsx` continues to work.** Run a quick visual sanity check by setting `CONSTELLATION_RENDERER=svg` and verifying `/dev/map` renders the old SVG (or close to it).
- **Drawer state stays with parents.** Do NOT move drawer state into ConstellationContext. The user's plan locked this: parents own `selectedCluster`, mirror down as prop. ConstellationContext only mirrors that prop and adds `hovered` + `cinematic` (which are scene-local).
- **`docs/code-architecture.md`** directory tree is the authority for which files belong where. Cross-reference if uncertain.
- **Do not delete `Star.tsx`, `SparkAnimation.tsx`, `StarTooltip.tsx`, `star-positions.ts`** — these remain usable by `ConstellationSVG.tsx`. The legacy renderer must stay operational throughout rollout.
- **No untracked Cluster.tsx etc.** The git status pre-existing deletions are absorbed by this phase (their content is inlined into ConstellationSVG.tsx or `git rm` finalizes the deletion). Verify `git status` does NOT show those three files as untracked deletions after this phase.
