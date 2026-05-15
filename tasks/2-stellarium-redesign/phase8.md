# Phase 8: Labels, Tooltips, Accessibility Overlay

## Preparation

Read these docs first:

- `/docs/adr.md` ADR-61 (label typography), ADR-63 (label visibility rule, DOM accessibility overlay)
- `/docs/screens.md` §C Canvas — Labels subsection, Star tooltip, Accessibility, Mobile tap targets
- `/CLAUDE.md` — labels are small blue-white, NOT cluster color, NOT caps
- `/tasks/2-stellarium-redesign/docs-diff.md`

Verify previous phase outputs:

- Phase 7: ClusterAura responds to `selected` + `hovered` state, Bloom + Vignette + Parallax mounted

Read the current code:

- `app/_components/Constellation/ConstellationSVG.tsx` — existing label and tooltip logic for reference
- `app/_components/Constellation/StarTooltip.tsx` — existing tooltip component
- `features/constellation/render/labels.ts` — label visibility rule (Phase 2)

## Work

This phase wires labels, tooltips, and the DOM accessibility overlay.

### 1. Implement `layers/Labels.tsx`

Use drei's `<Html>` to overlay HTML inside the R3F scene. Labels are positioned at viewBox coordinates converted to world space, then drei projects them back to screen.

```tsx
'use client'
import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { selectPersistentLabels } from '@/features/constellation/render/labels'
import { anchorFor } from '@/features/constellation/render/anchors'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { resolveStarViewBoxPosition } from '../star-positions'
import type { ConstellationData } from '../types'
import type { TerritoryType } from '@/lib/db/schema/territories'

const CLUSTER_LABELS: Record<TerritoryType, string> = {
  frontend_land:      'Frontend',
  backend_fortress:   'Backend',
  data_pipeline_zone: 'Data',
  testing_lab:        'Testing',
  devops_harbor:      'DevOps',
  docs_library:       'Docs',
}

interface LabelsProps {
  data: ConstellationData
  viewport?: 'desktop' | 'mobile' | 'og'
}

export function Labels({ data, viewport = 'desktop' }: LabelsProps) {
  const persistent = useMemo(
    () => selectPersistentLabels({ landmarks: data.landmarks, territories: data.territories }),
    [data.landmarks, data.territories]
  )

  // Determine which lit stars are persistently labeled
  const persistentLandmarks = data.landmarks.filter(l => persistent.persistent.has(l.tech_key))

  return (
    <group renderOrder={20}>
      {/* Cluster labels — one per cluster, fixed position */}
      {Object.entries(CLUSTER_LABELS).map(([type, label]) => {
        const a = anchorFor(viewport, type as TerritoryType)
        const w = viewBoxToWorld({ x: a.x, y: a.y + a.spread + 18 })
        return (
          <Html
            key={type}
            position={[w.x, w.y, 0]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <span className="text-[11px] tracking-normal text-sky-200/85 font-sans">
              {label}
            </span>
          </Html>
        )
      })}

      {/* Tech star labels — only the persistent set */}
      {persistentLandmarks.map(l => {
        const pos = resolveStarViewBoxPosition(l.tech_key, l.territory, viewport)
        const w = viewBoxToWorld({ x: pos.x, y: pos.y - 14 })  // 14px above the star
        return (
          <Html
            key={l.tech_key}
            position={[w.x, w.y, 0]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <span className="text-[10px] text-slate-200/80 font-sans">
              {techDisplayName(l.tech_key)}
            </span>
          </Html>
        )
      })}
    </group>
  )
}
```

`techDisplayName(tech_key)` returns the human display name from `features/territories/tech-catalog.ts` (e.g. `react` → `React`, `nodejs` → `Node.js`). If a helper doesn't yet exist, import the catalog and look it up.

Hard rules (ADR-61):
- Cluster labels: always rendered, ONE per cluster.
- Tech star labels: ONLY the persistent set from `selectPersistentLabels`. Others get a hover tooltip (next step).
- NO cluster colors, NO caps, NO letter-spacing. Use `text-slate-200/80` or `text-sky-200/85` (Tailwind muted blue-white).
- Pointer-events: none. Labels are visual only; click handling goes through the a11y overlay.

### 2. Implement `overlay/TooltipHost.tsx`

The tooltip shows on hover over any lit star that is NOT already persistently labeled. (The persistent ones already display their name.)

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useConstellationState } from '../state'
import type { ConstellationData } from '../types'

interface TooltipHostProps {
  data: ConstellationData
}

interface TooltipState {
  tech_key: string
  x: number  // screen px
  y: number  // screen px
}

export function TooltipHost({ data }: TooltipHostProps) {
  const [tip, setTip] = useState<TooltipState | null>(null)

  // The A11yOverlay (next step) raises pointer events with the tech_key + screen coord.
  // TooltipHost subscribes via a custom event or a small Context bus.
  useEffect(() => {
    const onStarHover = (e: CustomEvent<TooltipState | null>) => setTip(e.detail)
    window.addEventListener('constellation:star-hover' as any, onStarHover)
    return () => window.removeEventListener('constellation:star-hover' as any, onStarHover)
  }, [])

  if (!tip) return null

  const landmark = data.landmarks.find(l => l.tech_key === tip.tech_key)
  if (!landmark) return null

  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: tip.x + 14,
        top: tip.y - 32,
        zIndex: 50,
        pointerEvents: 'none',
      }}
      className="bg-slate-900/95 text-slate-100 text-xs px-3 py-1.5 rounded shadow-lg"
    >
      {techDisplayName(tip.tech_key)} · {brightnessDescriptor(landmark.weight)} · since {formatShortDate(landmark.firstUnlockedAt)}
    </div>
  )
}
```

`brightnessDescriptor(weight)` maps quintile to: `brightest | bright | mid | dim | very dim` (product-language labels per `docs/screens.md` §D.1). Add this helper to `features/constellation/render/magnitude.ts` if it doesn't exist (it's pure, isomorphic — fine to put there).

### 3. Implement `overlay/A11yOverlay.tsx`

DOM-positioned invisible buttons. Each button is sized to be at least 24×24px tap target (44px ideal on mobile) and positioned over the corresponding visual element.

The overlay covers:
- 6 cluster boundary cells (anchored at cluster center, sized to roughly fill the Voronoi cell)
- Persistently-labeled tech stars only ("hero" stars)

```tsx
'use client'
import { useMemo, useEffect, useRef } from 'react'
import { voronoiCells } from '@/features/constellation/render/voronoi'
import { selectPersistentLabels } from '@/features/constellation/render/labels'
import { anchorFor } from '@/features/constellation/render/anchors'
import { resolveStarViewBoxPosition } from '../star-positions'
import { useConstellationState } from '../state'
import type { ConstellationData } from '../types'

interface A11yOverlayProps {
  data: ConstellationData
  viewport?: 'desktop' | 'mobile' | 'og'
  onClusterClick?: (type: TerritoryType) => void
  onStarClick?: (tech_key: string) => void
}

export function A11yOverlay({ data, viewport = 'desktop', onClusterClick, onStarClick }: A11yOverlayProps) {
  const { setHovered } = useConstellationState()
  const overlayRef = useRef<HTMLDivElement>(null)

  // Compute cells + hero stars
  const cells = useMemo(() => voronoiCells(viewport), [viewport])
  const heroStars = useMemo(() => {
    const persistent = selectPersistentLabels({ landmarks: data.landmarks, territories: data.territories })
    return data.landmarks.filter(l => persistent.persistent.has(l.tech_key))
  }, [data])

  // For each cell, render a transparent button positioned absolutely over the SVG cell area.
  // For each hero star, render a 44x44 transparent button at its screen position.
  // Coordinate conversion: viewBox (1000x700) → CSS px via container size.

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none"
      aria-label="Constellation accessibility overlay"
    >
      <svg
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
      >
        {/* Cluster cell buttons */}
        {cells.map(cell => (
          <polygon
            key={cell.type}
            points={cell.polygon.map(p => `${p.x},${p.y}`).join(' ')}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={ariaForCluster(cell.type, data)}
            className="pointer-events-auto focus:outline-none focus-visible:stroke-2 focus-visible:stroke-sky-300/60"
            onPointerEnter={() => setHovered(cell.type)}
            onPointerLeave={() => setHovered(null)}
            onClick={() => onClusterClick?.(cell.type)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClusterClick?.(cell.type)
              }
            }}
          />
        ))}

        {/* Hero star buttons */}
        {heroStars.map(l => {
          const pos = resolveStarViewBoxPosition(l.tech_key, l.territory, viewport)
          return (
            <circle
              key={l.tech_key}
              cx={pos.x}
              cy={pos.y}
              r={6}  // 12px diameter in viewBox; CSS-scaled may grow to ≥24px on screen
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={ariaForStar(l)}
              className="pointer-events-auto focus:outline-none focus-visible:stroke-1 focus-visible:stroke-sky-300/70"
              onPointerEnter={(e) => {
                window.dispatchEvent(new CustomEvent('constellation:star-hover', {
                  detail: { tech_key: l.tech_key, x: e.clientX, y: e.clientY }
                }))
              }}
              onPointerLeave={() => {
                window.dispatchEvent(new CustomEvent('constellation:star-hover', { detail: null }))
              }}
              onClick={() => onStarClick?.(l.tech_key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onStarClick?.(l.tech_key)
                }
              }}
            />
          )
        })}
      </svg>
    </div>
  )
}

function ariaForCluster(type: TerritoryType, data: ConstellationData): string {
  const t = data.territories.find(x => x.type === type)
  const stars = data.landmarks.filter(l => l.territory === type && l.firstUnlockedAt && l.weight >= 5).length
  return `${clusterDisplayName(type)} cluster — ${stars} stars lit, stage ${t?.stage ?? 1}`
}

function ariaForStar(l: ConstellationData['landmarks'][number]): string {
  return `${techDisplayName(l.tech_key)} — ${brightnessDescriptor(l.weight)}, lit since ${formatShortDate(l.firstUnlockedAt!)}`
}
```

Hard rules (ADR-63):
- Only the 6 cluster cells + the persistently-labeled (hero) tech stars are accessibility targets.
- Field stars and unlabeled lit stars are NOT accessible (no DOM nodes for them).
- Keyboard: tab through cells → tab through hero stars. Enter / Space activates the click handler.

### 4. Mount labels + overlay in `ConstellationWebGL.tsx`

Labels live inside the Scene (drei's `<Html>` works inside `<Canvas>`). The A11yOverlay + TooltipHost live OUTSIDE the canvas (regular DOM).

```tsx
// ConstellationWebGL.tsx
return (
  <div className="relative w-full h-full">
    <Skeleton {...props} />
    {webglOK ? (
      <>
        <Scene {...props} />
        <A11yOverlay data={props.data} viewport={props.viewport} onClusterClick={props.onClusterClick} onStarClick={props.onStarClick} />
        <TooltipHost data={props.data} />
      </>
    ) : (
      <WebGLUnsupportedBanner />
    )}
  </div>
)
```

Within Scene, mount `<Labels data={data} viewport={viewport} />` inside the `<Canvas>` (drei's `<Html>` requires the R3F context).

### 5. Drawer wiring sanity check

The `onClusterClick` / `onStarClick` handlers come from the parent (`_map-container.tsx` for authenticated, `_public-profile-map.tsx` for public). Verify both parents already pass these handlers (they should — drawer state is owned by the parent). If a parent doesn't pass the prop, add it.

### 6. axe accessibility test

Create `tests/a11y/dev-map.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('/dev/map passes WCAG AA', async ({ page }) => {
  // Requires ENABLE_DEV_MAP=1 in env
  await page.goto('http://localhost:3000/dev/map?layers=all')
  await page.waitForLoadState('networkidle')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})
```

If `playwright.config.ts` doesn't already include a tests/a11y/ directory, add it.

### 7. Visual checkpoint

Capture `/dev/map?layers=all` screenshot into `tasks/2-stellarium-redesign/visual-checkpoints/phase8.png`.

## Acceptance Criteria

```bash
# (1) Files exist with real bodies
test "$(wc -l < app/_components/Constellation/layers/Labels.tsx)" -gt 40
test "$(wc -l < app/_components/Constellation/overlay/A11yOverlay.tsx)" -gt 50
test "$(wc -l < app/_components/Constellation/overlay/TooltipHost.tsx)" -gt 20

# (2) Labels use NEUTRAL blue-white colors, NOT cluster colors
! grep -E "(#3b82f6|#06b6d4|#10b981|#a855f7|#f97316|#eab308)" app/_components/Constellation/layers/Labels.tsx
grep -qE "(sky-200|slate-200|slate-100|text-\\[1[01]px\\])" app/_components/Constellation/layers/Labels.tsx

# (3) ConstellationWebGL mounts overlay + tooltip
grep -q "A11yOverlay" app/_components/Constellation/ConstellationWebGL.tsx
grep -q "TooltipHost" app/_components/Constellation/ConstellationWebGL.tsx

# (4) Scene mounts Labels inside Canvas
grep -q "<Labels" app/_components/Constellation/Scene.tsx

# (5) Build passes
npm run build

# (6) axe test exists
test -f tests/a11y/dev-map.spec.ts

# (7) axe test passes
ENABLE_DEV_MAP=1 npm run dev &
DEV_PID=$!
sleep 8
npm run axe:test
kill $DEV_PID || true

# (8) Visual checkpoint captured
mkdir -p tasks/2-stellarium-redesign/visual-checkpoints
test -f tasks/2-stellarium-redesign/visual-checkpoints/phase8.png

# (9) Console errors = 0
```

## How to verify AC

Run AC commands. All nine must pass. Set phase 8 status to `"completed"`.

## Notes

- **Labels are visual ONLY.** `pointer-events: none` on the `<Html>` wrapper. All click/hover routing goes through `<A11yOverlay>`. This keeps the visual layer (Labels) and the interaction layer (A11yOverlay) cleanly separated — they happen to share positions but serve different purposes.
- **No cluster-colored labels.** Labels are small blue-white. If a label color must differentiate (e.g. an active cluster's label brighter), use opacity/weight changes, NOT hue.
- **A11y units.** ONLY cluster cells + hero lit stars are accessibility targets. Do not add DOM buttons for field stars or non-hero lit stars — that bloats DOM and adds no semantic value (per ADR-63).
- **Tab order.** Default DOM order = cluster cells first (in display order: frontend, backend, data, testing, devops, docs), then hero stars (in weight-descending order). Verify with Tab key in a real browser.
- **Mobile tap targets.** The `r={6}` circles in viewBox space scale up with the container. At a 1440px-wide desktop, viewBox r=6 ≈ 8-9 CSS px → small. We rely on the CSS-px tap area being at least 24px on mobile. Phase 12 verifies this on real device emulation.
- **CustomEvent for tooltip.** Using `window.dispatchEvent` for star-hover → TooltipHost is the simplest cross-component bus without adding state library. If a global listener feels fragile, refactor to a React Context (e.g. extend ConstellationContext with `hoveredStar` + `setHoveredStar`). Either is fine; pick the path with less churn.
- **Drawer doesn't open here.** Phase 8 just wires the click handlers to call `onClusterClick` / `onStarClick`. The parents' existing drawer state handles the actual drawer UI. No new drawer code in this phase.
