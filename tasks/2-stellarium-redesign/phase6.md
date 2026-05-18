# Phase 6: Tech Stars + Connections

## Preparation

Read these docs first:

- `/docs/adr.md` ADR-61 (tech stars use spectral palette, Airy disk + diffraction spikes), ADR-63 (Voronoi)
- `/docs/screens.md` §C Canvas — Tech stars layer, Connection lines layer
- `/docs/code-architecture.md` — `features/constellation/render/` consumers
- `/CLAUDE.md` — tech-star colors via spectral palette, NOT cluster color
- `/tasks/2-stellarium-redesign/docs-diff.md`

Verify previous phase outputs:

- Phase 5: MilkyWay + TerritoryBoundaries mounted in Scene
- Phase 2: `palette.ts`, `magnitude.ts`, `mst.ts`, `coords.ts`, `anchors.ts` implemented + tested

Read the current code:

- `app/_components/Constellation/ConstellationSVG.tsx` — legacy renderer's tech star and connection logic for reference (existing positions, jitter, MST)
- `features/territories/tech-catalog.ts` — tech_key catalog with `{x, y}` placeholders
- `app/_components/Constellation/star-positions.ts` — current placement helpers

## Work

This phase mounts tech stars (50 positions) and MST connections.

### 1. Implement `layers/TechStars.tsx`

Use `THREE.Points` for instanced rendering with custom shaders.

```tsx
'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { AIRY_DISK_FRAG } from '../shaders/airy-disk.frag'
import { DIFFRACTION_SPIKE_FRAG } from '../shaders/diffraction-spike.frag'
import { spectralColorFor, spectralHex } from '@/features/constellation/render/palette'
import { magnitudeFor, topQuintileThreshold } from '@/features/constellation/render/magnitude'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { getStarPositions } from '@/app/_components/Constellation/star-positions'
import type { ConstellationData } from '../types'

interface TechStarsProps {
  data: ConstellationData
  viewport?: 'desktop' | 'mobile' | 'og'
}

export function TechStars({ data, viewport = 'desktop' }: TechStarsProps) {
  const stars = useMemo(() => {
    // Resolve star positions via existing getStarPositions() helper.
    // Filter to lit stars (firstUnlockedAt !== null AND weight >= 5).
    const lit = data.landmarks.filter(l => l.firstUnlockedAt !== null && l.weight >= 5)
    const threshold = topQuintileThreshold(lit.map(l => l.weight))
    return lit.map(landmark => {
      const pos = /* resolve viewBox position for landmark.tech_key */
      const m = magnitudeFor(landmark.weight, threshold)
      const color = spectralColorFor(landmark.tech_key)
      return {
        worldPos: viewBoxToWorld(pos),
        color,
        size: m.coreRadius * 2,        // diameter in viewBox units
        intensity: m.intensity,
        showSpikes: m.showSpikes,
        spikeLength: m.spikeLength,
      }
    })
  }, [data.landmarks])

  // Build geometry + material for the core (Airy disk).
  const coreGeom = useMemo(() => { /* positions, sizes, colors, intensities as attributes */ }, [stars])
  const coreMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: /* sets gl_PointSize from aSize, passes color */,
    fragmentShader: AIRY_DISK_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])

  // Build a second set of points for diffraction spikes (only top-N).
  const spikeStars = stars.filter(s => s.showSpikes)
  // (similar geometry + DIFFRACTION_SPIKE_FRAG material)

  return (
    <group renderOrder={10}>
      <points args={[coreGeom, coreMaterial]} />
      {spikeStars.length > 0 && <points args={[spikeGeom, spikeMaterial]} />}
    </group>
  )
}
```

### 2. Shaders — Airy disk

`shaders/airy-disk.frag.ts`:

```ts
export const AIRY_DISK_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vIntensity;
  void main() {
    // Soft circular core with a slight central concentration
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d) * 2.0;
    if (r > 1.0) discard;
    // Two-layer falloff: bright core (~0..0.3) + soft halo (0.3..1.0)
    float core = pow(1.0 - r, 6.0) * 1.0;
    float halo = pow(1.0 - r, 1.6) * 0.45;
    float alpha = clamp(core + halo, 0.0, 1.0);
    gl_FragColor = vec4(vColor * vIntensity * (1.0 + core * 0.6), alpha);
  }
`
```

Vertex shader (`airy-disk.vert.ts` — create it):

```ts
export const AIRY_DISK_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aIntensity;
  varying vec3 vColor;
  varying float vIntensity;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // gl_PointSize is in fragment space — scale aSize from viewBox units
    gl_PointSize = aSize * 12.0;  // calibration constant, tune in dev/map
    vColor = aColor;
    vIntensity = aIntensity;
  }
`
```

### 3. Shaders — Diffraction spikes

`shaders/diffraction-spike.frag.ts`:

```ts
export const DIFFRACTION_SPIKE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vIntensity;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    // Cross pattern: bright along the axes, fades with distance
    float horizontal = exp(-pow(d.y * 18.0, 2.0));
    float vertical   = exp(-pow(d.x * 18.0, 2.0));
    float falloff = max(0.0, 1.0 - length(d) * 1.8);
    float spike = (horizontal + vertical) * falloff;
    if (spike < 0.01) discard;
    gl_FragColor = vec4(vColor * vIntensity * spike * 0.9, spike);
  }
`
```

The spike vertex shader is the same as `airy-disk.vert.ts` but the point size is larger (use `aSpikeLength` attribute or apply a multiplier here):

```glsl
gl_PointSize = aSpikeLength * 12.0;
```

### 4. Implement `layers/Connections.tsx`

Use `features/constellation/render/mst.ts` to compute edges per cluster.

```tsx
'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { mstEdges } from '@/features/constellation/render/mst'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import type { ConstellationData } from '../types'

interface ConnectionsProps {
  data: ConstellationData
  viewport?: 'desktop' | 'mobile' | 'og'
}

export function Connections({ data, viewport = 'desktop' }: ConnectionsProps) {
  const segments = useMemo(() => {
    // Group lit landmarks by territory; for each cluster compute MST edges.
    const byCluster = /* group landmarks by territory */
    const allEdges: Array<{ a: ..., b: ... }> = []
    for (const [type, landmarks] of byCluster) {
      const positions = landmarks.map(l => /* viewBox position */)
      const edges = mstEdges(positions)
      allEdges.push(...edges)
    }
    return allEdges
  }, [data.landmarks, viewport])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const arr = new Float32Array(segments.length * 6)
    segments.forEach((e, i) => {
      const a = viewBoxToWorld(e.a)
      const b = viewBoxToWorld(e.b)
      arr[i*6+0] = a.x; arr[i*6+1] = a.y; arr[i*6+2] = a.z
      arr[i*6+3] = b.x; arr[i*6+4] = b.y; arr[i*6+5] = b.z
    })
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
    return g
  }, [segments])

  return (
    <lineSegments geometry={geom} renderOrder={5}>
      <lineBasicMaterial color="#5a6c80" transparent opacity={0.22} />
    </lineSegments>
  )
}
```

The opacity 0.22 sits in the ADR-61 range `0.15–0.25`. Color `#5a6c80` is muted blue-gray (NOT cluster color).

If a more refined glow is desired (e.g. shader-based line with soft edges), implement `line-glow.frag.ts` and use a custom ShaderMaterial. For Phase 6 the basic LineBasicMaterial is sufficient — Phase 12 can iterate if visual regression baseline shows it reads too thin.

### 5. Mount in Scene.tsx

```tsx
import { TechStars } from './layers/TechStars'
import { Connections } from './layers/Connections'

// inside the Canvas, AFTER TerritoryBoundaries:
{show('connections') && <Connections data={data} viewport={viewport} />}
{show('techstars') && <TechStars data={data} viewport={viewport} />}
```

The `data` prop must thread through `<Scene>`. If Phase 4 didn't add the `data` prop yet, add it now to the Scene props.

### 6. Resolve star positions

The existing helper for tech star positions is `app/_components/Constellation/star-positions.ts` — it reads `tech-catalog`'s `{x, y}` if defined, falls back to a deterministic hash within the cluster anchor + spread. Reuse this helper. Do NOT re-implement.

If `getStarPositions(landmarks, viewport)` doesn't yet exist with that signature, expose a small wrapper in this phase:

```ts
// app/_components/Constellation/star-positions.ts (extend, don't replace)
import { anchorFor } from '@/features/constellation/render/anchors'

export function resolveStarViewBoxPosition(
  tech_key: string,
  territory: TerritoryType,
  viewport: Viewport,
): WorldCoord {
  // 1. Look up tech-catalog entry; if {x, y} present, use it.
  // 2. Else apply the existing hash-based fallback within the cluster anchor + spread.
}
```

### 7. Visual checkpoint

Capture `/dev/map?layers=sky,milkyway,fieldstars,boundaries,connections,techstars` screenshot into `tasks/2-stellarium-redesign/visual-checkpoints/phase6.png`.

## Acceptance Criteria

```bash
# (1) Layer files have real bodies
test "$(wc -l < app/_components/Constellation/layers/TechStars.tsx)" -gt 40
test "$(wc -l < app/_components/Constellation/layers/Connections.tsx)" -gt 20

# (2) Shaders have real source
grep -q "void main" app/_components/Constellation/shaders/airy-disk.frag.ts
grep -q "void main" app/_components/Constellation/shaders/diffraction-spike.frag.ts

# (3) Scene mounts both layers
grep -q "TechStars" app/_components/Constellation/Scene.tsx
grep -q "<Connections" app/_components/Constellation/Scene.tsx

# (4) Tech stars use spectral palette, NOT cluster colors
# (greppable check: cluster color hex codes are NOT used directly in TechStars.tsx)
! grep -E "(#3b82f6|#06b6d4|#10b981|#a855f7|#f97316|#eab308)" app/_components/Constellation/layers/TechStars.tsx
# spectralHex import should be present
grep -q "spectralHex\|spectralColorFor" app/_components/Constellation/layers/TechStars.tsx

# (5) Connections use muted blue-gray, NOT cluster colors
grep -q "lineBasicMaterial" app/_components/Constellation/layers/Connections.tsx
! grep -E "color=\"#(3b82f6|06b6d4|10b981|a855f7|f97316|eab308)\"" app/_components/Constellation/layers/Connections.tsx

# (6) Build passes
npm run build

# (7) Visual checkpoint captured
mkdir -p tasks/2-stellarium-redesign/visual-checkpoints
# (run Playwright screenshot per pattern from Phase 4)
test -f tasks/2-stellarium-redesign/visual-checkpoints/phase6.png

# (8) Console errors = 0
```

## How to verify AC

Run the AC commands. All eight must pass. Set phase 6 status to `"completed"`.

## Notes

- **Tech stars do NOT twinkle.** No time-varying uniforms on the Airy disk material (intensity is constant per star). This preserves identity per ADR-61.
- **Spectral palette only.** Tech star color comes from `spectralColorFor(tech_key)`. The cluster colors (frontend=blue, backend=cyan, etc.) are ONLY used for cluster-aura events (Phase 7) — never for the star core itself.
- **Diffraction spikes** are 4-spike cross (vertical + horizontal). NOT 6-spike (Hubble-style) or 8-spike. Keep it astronomically standard (camera lens diffraction is 4-spike when the aperture has 4 straight blades — most common).
- **Spike threshold.** Use `magnitudeFor().showSpikes`, which is true for the top brightness quintile of lit stars. About 10 spike-rendered stars max in a typical dense constellation. Verify on /dev/map mock data.
- **MST per cluster, not global.** Connections must be intra-cluster only. A cross-cluster MST line would visually merge separate clusters and violate the spatial-grouping principle (ADR-61).
- **Connection opacity = 0.22.** Sits in the [0.15, 0.25] band from ADR-61. Final value can be adjusted in Phase 12.
- **No re-implementation of star positions.** Reuse `star-positions.ts` from current code. The Voronoi cells + anchors come from `features/constellation/render/*`, but each tech star's actual `{x, y}` is per the existing tech catalog + hash fallback.
- **AdditiveBlending caveat.** Tech stars use additive blending so bloom (Phase 7) makes the brightest ones glow strongly. Without bloom in Phase 6, the stars will look harsh — that's expected, Phase 7 fixes the look.
