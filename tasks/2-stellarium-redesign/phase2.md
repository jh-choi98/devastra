# Phase 2: Render Math (features/constellation/render/*)

## Preparation

Read these docs first:

- `/docs/adr.md` ADR-61 (visual language), ADR-62 (shared module), ADR-63 (Voronoi + label rule)
- `/docs/screens.md` §C Canvas (especially the layer order and the label visibility rule)
- `/docs/code-architecture.md` — directory tree under `features/constellation/render/`, isomorphic exception, SPDX list
- `/CLAUDE.md` — "Server-only discipline" with the documented exception; "SPDX license headers" section; "Constellation visual language" section
- `/tasks/2-stellarium-redesign/docs-diff.md`

Verify Phase 1 output:

- `features/constellation/render/types.ts` exists with the type definitions
- All 8 sibling stub files exist
- SPDX headers in place on the listed MIT files
- `npm run build` passes

Read the current `app/_components/Constellation/Constellation.tsx` carefully — it contains the existing anchor map (around lines 32–57), MST algorithm (around 140–174), and jitter logic (around 87–96). Phase 2 EXTRACTS this math into pure modules.

Also read `app/_components/Constellation/star-positions.ts` (current client implementation) and `features/territories/star-positions.ts` (current server implementation). The new modules should be a clean superset.

## Work

Implement all 9 files under `features/constellation/render/`. Each must be a pure module — no React, no Three.js, no DOM, no server-only. Add a colocated `*.test.ts` for each (vitest). Every test must be deterministic — no random, no Date.now(), no network.

### File-by-file specifications

#### 1. `types.ts` — already done in Phase 1

Verify it matches Phase 1's content. Add any missing types as you implement other modules; bias toward putting all shared types HERE rather than in individual modules.

#### 2. `anchors.ts`

```ts
// SPDX-License-Identifier: MIT
import type { AnchorMap, ClusterAnchor, Viewport } from './types'

/**
 * Cluster anchor positions per viewport. World coords are in viewBox units (1000x700).
 * Extracted verbatim from the existing Constellation.tsx (lines ~32–57) so visual
 * positioning stays continuous across the renderer swap.
 */
export const ANCHORS: AnchorMap = { /* desktop, mobile, og — all 6 clusters each */ }

export function anchorsFor(viewport: Viewport): ClusterAnchor[] { ... }
export function anchorFor(viewport: Viewport, type: TerritoryType): ClusterAnchor { ... }
```

Hard rule: the 6 cluster types `frontend_land | backend_fortress | data_pipeline_zone | testing_lab | devops_harbor | docs_library` must all be present in each viewport (CLAUDE.md "Territory types"). No 7th cluster.

#### 3. `palette.ts`

```ts
// SPDX-License-Identifier: MIT
import type { SpectralColor } from './types'

/** Maps a tech_key string to a deterministic spectral color via cyrb53 hash. */
export function spectralColorFor(tech_key: string): SpectralColor

/** Returns the hex value for a given spectral color. Used by both WebGL and SVG renderers. */
export function spectralHex(color: SpectralColor): string

/**
 * Palette distribution targets (per ADR-61 § field stars / tech stars):
 *   70% white, 20% blue-white, 7% yellow-white, 3% orange/red.
 * spectralColorFor() must approximate this distribution across the set of tech_keys
 * used by the product.
 */
```

Hard rule: deterministic. Same `tech_key` always returns same color. No `Math.random`.

Suggested hex anchors (tune in Phase 6):
- `white` → `#f0f4ff`
- `blue-white` → `#a8c4ff`
- `yellow-white` → `#fff2c4`
- `orange` → `#ffb070`
- `red` → `#ff7050`

#### 4. `voronoi.ts`

```ts
// SPDX-License-Identifier: MIT
import type { Viewport, VoronoiCell } from './types'

/**
 * Computes 6 Voronoi cells for the given viewport's cluster anchors,
 * clipped to the viewBox (1000x700). Cells are returned in fixed cluster order.
 * Pure function — same viewport always yields identical cells.
 *
 * Implementation can be hand-rolled (Fortune's algorithm overkill for n=6;
 * a simple half-plane intersection works in O(n²) which is trivial here)
 * or use d3-voronoi if you choose to add it as a dependency in this phase.
 */
export function voronoiCells(viewport: Viewport): VoronoiCell[]
```

If hand-rolling: for each pair of anchors `(a, b)`, compute the perpendicular bisector; the half-plane on `a`'s side is `a`'s "claim". The intersection of all such half-planes around `a` is `a`'s cell, clipped to the viewBox rectangle.

Hard rule: cells partition the viewBox without overlap or gap. Sum of cell areas = viewBox area (1000 × 700 = 700,000).

#### 5. `labels.ts`

```ts
// SPDX-License-Identifier: MIT

export interface LabelSelectionInput {
  landmarks: Array<{ tech_key: string; weight: number; firstUnlockedAt: string | null; territory: TerritoryType }>
  territories: Array<{ type: TerritoryType; stage: number }>
}

export interface LabelSelectionResult {
  /** tech_keys whose persistent label should be rendered. */
  persistent: Set<string>
}

/**
 * Persistent label visibility rule (ADR-63):
 *
 *   - Top 1 lit star per active cluster (active = stage >= 2 OR has any lit stars)
 *   - PLUS globally brightest lit stars, filling up to a global cap of [8, 12]
 *   - Dedupe: stars already labeled via cluster-top are NOT double-counted
 *   - If total lit stars <= 6, label ALL lit stars (sparse-state override)
 *
 * "Lit" = landmarks.firstUnlockedAt !== null  AND  landmarks.weight >= 5
 * (per CLAUDE.md "Landmark unlock threshold").
 *
 * Brightness ordering is by weight DESCENDING, tiebreak by tech_key ascending
 * (so the result is deterministic).
 */
export function selectPersistentLabels(input: LabelSelectionInput): LabelSelectionResult
```

Hard rule: deterministic. Same input → same Set.

#### 6. `mst.ts`

```ts
// SPDX-License-Identifier: MIT
import type { WorldCoord, MstEdge } from './types'

/**
 * Computes the minimum spanning tree edges among lit star positions within a cluster.
 * Uses Prim's algorithm with Euclidean distance.
 * Extracted from the existing Constellation.tsx (lines ~140–174).
 *
 * For lit count 0 or 1: returns empty array.
 */
export function mstEdges(starsInCluster: WorldCoord[]): MstEdge[]
```

#### 7. `magnitude.ts`

```ts
// SPDX-License-Identifier: MIT

export interface MagnitudeOutput {
  /** core radius in viewBox units (1000x700 space). */
  coreRadius: number
  /** HDR-friendly intensity multiplier for the bloom pass. >1 means it will bloom. */
  intensity: number
  /** Whether to draw a visible diffraction spike (top-N brightest). */
  showSpikes: boolean
  /** Spike length in viewBox units, 0 if showSpikes is false. */
  spikeLength: number
}

/**
 * Maps a landmark's weight to render parameters.
 *
 *   - weight 5 (just unlocked) → coreRadius ~2px, intensity 1.0, no spikes
 *   - weight 50 (typical lit)  → coreRadius ~4px, intensity 1.5, no spikes
 *   - weight in top quintile across all lit landmarks → showSpikes=true, spikeLength scales
 *
 * The top-quintile decision needs the full landmark set; callers pre-compute
 * the quintile boundary and pass it via `topQuintileThreshold`.
 */
export function magnitudeFor(weight: number, topQuintileThreshold: number): MagnitudeOutput

/** Compute the top-quintile threshold (80th percentile) of lit landmark weights. */
export function topQuintileThreshold(weightsOfLitStars: number[]): number
```

#### 8. `field-stars.ts`

```ts
// SPDX-License-Identifier: MIT
import type { FieldStar, Viewport } from './types'

/**
 * Deterministic seeded generation of background field stars.
 *
 * Distribution targets (ADR-61):
 *   - count: 2000 desktop, 1000 mobile, 1500 og
 *   - palette: 70% white / 20% blue-white / 7% yellow-white / 3% orange-red
 *   - size:    80% 1px / 15% 2px / 5% 3px (visible halo)
 *   - non-uniform density: ~1.7x denser inside the Milky Way mask region
 *     (the mask is a soft diagonal band — see Phase 5 for the exact shape).
 *   - per-star twinkle phase in [0, 1)
 *
 * Uses cyrb53 + mulberry32 (same approach as the existing star-positions.ts
 * fallback). Seed = "devastra:field-stars:v1".
 */
export function generateFieldStars(viewport: Viewport): FieldStar[]
```

For Phase 2, the Milky Way mask can be a simple constant (e.g. a diagonal band defined inline). Phase 5 may refine the mask to match the actual texture — if so, this function is updated again.

#### 9. `coords.ts`

```ts
import type { WorldCoord } from './types'

/** Converts a viewBox (1000x700) coordinate to WebGL world coordinates ([-1, 1] x [-h/w, h/w]). */
export function viewBoxToWorld(p: WorldCoord): { x: number; y: number; z: number }

/** Inverse of viewBoxToWorld. */
export function worldToViewBox(w: { x: number; y: number }): WorldCoord

/** Converts a viewBox coordinate to a CSS pixel coordinate given a target canvas size. */
export function viewBoxToScreen(p: WorldCoord, canvasWidth: number, canvasHeight: number): { x: number; y: number }
```

No SPDX header (internal helper; not extractable per CLAUDE.md L73).

### Tests

For each of the 8 implementation modules, write a colocated test file. Each test must:

- Be deterministic (no `Math.random`, no `Date.now()`, no network).
- Cover at least the happy-path AND one edge case (e.g. empty input, single element, boundary values).
- Run under `npm test` in under 100ms per file.

Example minimum test counts:

- `anchors.test.ts` — 4 tests (each viewport has 6 distinct anchors, types correct)
- `palette.test.ts` — 3 tests (determinism, distribution approximation, all 5 colors reachable)
- `voronoi.test.ts` — 3 tests (cells partition viewBox, no overlap, deterministic across calls)
- `labels.test.ts` — 6 tests (sparse override at ≤6, cluster-top selected, global cap enforced, dedupe works, unlit excluded, deterministic)
- `mst.test.ts` — 3 tests (n=0, n=1, n=5 with known geometry)
- `magnitude.test.ts` — 4 tests (weight 5/50/500 monotone, top quintile triggers spikes)
- `field-stars.test.ts` — 3 tests (count per viewport, distribution close to target, deterministic)

## Acceptance Criteria

```bash
# (1) All 9 modules have non-empty bodies (not just // TODO)
for f in anchors palette voronoi labels mst magnitude field-stars coords; do
  test "$(wc -l < features/constellation/render/$f.ts)" -gt 5 || { echo "$f.ts seems empty"; exit 1; }
done

# (2) All have colocated tests
for f in anchors palette voronoi labels mst magnitude field-stars; do
  test -f features/constellation/render/$f.test.ts || { echo "missing $f.test.ts"; exit 1; }
done

# (3) Tests pass
npm test -- features/constellation/render

# (4) Type check passes
npm run build

# (5) No accidental server-only or React imports
! grep -rE "server-only|from 'react'|@react-three" features/constellation/render/

# (6) SPDX MIT header on MIT files
for f in palette voronoi labels mst magnitude field-stars; do
  head -n 1 features/constellation/render/$f.ts | grep -q "SPDX-License-Identifier: MIT" || { echo "missing SPDX in $f.ts"; exit 1; }
done
```

## How to verify AC

Run the AC commands. All six must pass. Set phase 2 status to `"completed"` in `/tasks/2-stellarium-redesign/index.json`. Up to 3 remediation attempts allowed; on failure set status to `"error"` with `"error_message"`.

## Notes

- **Pure functions only.** No side effects. Caller passes all inputs as arguments.
- **Reuse cyrb53 + mulberry32** from existing `app/_components/Constellation/star-positions.ts` and `features/territories/star-positions.ts` if you can share it. Otherwise inline it — it is only ~20 lines.
- **Voronoi correctness matters.** Test that the 6 cells exactly partition the viewBox. An off-by-one or floating-point slop is a real bug that will leave visible gaps between cluster regions in Phase 5.
- **Anchor extraction.** Read `app/_components/Constellation/Constellation.tsx` carefully for the existing desktop/mobile/og anchor positions. Do NOT change positions — preserve continuity with the current renderer.
- **`labels.ts` is the most subtle.** Walk through the rule by hand with a 4-lit / 7-lit / 30-lit scenario in your tests to make sure the algorithm behaves correctly at each transition.
- **Do not touch UI components yet.** This phase is render math only. `app/_components/Constellation/*` is untouched.
