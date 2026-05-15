# Phase 7: Cluster Aura + Bloom/Vignette + Parallax

## Preparation

Read these docs first:

- `/docs/adr.md` ADR-61 (cluster aura event-only, single active), ADR-62 (postprocessing budget)
- `/docs/screens.md` §C Canvas — Cluster aura (event-only), Postprocessing, Camera/parallax, Reduced motion
- `/CLAUDE.md` — permitted bounded ambient motion, persistent aura forbidden in steady state
- `/tasks/2-stellarium-redesign/docs-diff.md`

Verify previous phase outputs:

- Phase 6: TechStars + Connections mounted, using spectral palette + muted blue-gray
- Tech stars look harsh without bloom (expected, this phase fixes)

## Work

This phase adds three things: the event-only ClusterAura layer, postprocessing (Bloom + Vignette), and the ParallaxRig camera tilt.

### 1. Implement `layers/ClusterAura.tsx`

Renders ONE radial-gradient quad per active cluster. State drives which clusters are "active" and their fade-in opacity.

Activation priority (ADR-61):
```
cinematic/stage-up > drawer-selected > hover > none
```

Only one cluster aura is fully active at a time. Hover on a *different* cluster while drawer-selected stays on cluster X → boundary line of Y highlights (Phase 8 wires this) but Y's aura does NOT activate.

```tsx
'use client'
import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { anchorFor } from '@/features/constellation/render/anchors'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { useConstellationState } from '../state'
import type { TerritoryType } from '@/lib/db/schema/territories'

const CLUSTER_COLORS: Record<TerritoryType, string> = {
  frontend_land:      '#3b82f6',  // blue
  backend_fortress:   '#06b6d4',  // cyan
  data_pipeline_zone: '#10b981',  // green
  testing_lab:        '#a855f7',  // purple
  devops_harbor:      '#f97316',  // orange
  docs_library:       '#eab308',  // yellow
}

interface ClusterAuraProps {
  viewport?: 'desktop' | 'mobile' | 'og'
}

export function ClusterAura({ viewport = 'desktop' }: ClusterAuraProps) {
  const { selected, hovered, cinematic } = useConstellationState()

  // Compute active cluster per priority order
  const activeCluster: TerritoryType | null = useMemo(() => {
    if (cinematic !== 'idle') {
      // Phase 9 wires which cluster a cinematic targets.
      // For Phase 7, treat cinematic as not selecting a specific cluster
      // unless extended state.cinematicTarget is set.
      return null
    }
    if (selected) return selected
    if (hovered) return hovered
    return null
  }, [cinematic, selected, hovered])

  // Smooth opacity transition (~200ms fade in/out)
  const opacityRef = useRef(0)
  useFrame((_, dt) => {
    const target = activeCluster ? 0.55 : 0
    opacityRef.current += (target - opacityRef.current) * Math.min(1, dt * 5)
  })

  if (!activeCluster && opacityRef.current < 0.001) return null

  const anchor = anchorFor(viewport, activeCluster ?? 'frontend_land')
  const world = viewBoxToWorld({ x: anchor.x, y: anchor.y })
  const radius = (anchor.spread / 1000) * 2 // approximate scale to NDC space

  // Quad with radial-gradient fragment shader
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(activeCluster ? CLUSTER_COLORS[activeCluster] : '#000') },
      uOpacity: { value: 0 },
    },
    vertexShader: /* standard quad */,
    fragmentShader: /* radial gradient: brightest at center, fades over the quad */,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [activeCluster])

  useFrame(() => {
    material.uniforms.uOpacity.value = opacityRef.current
    if (activeCluster) material.uniforms.uColor.value.set(CLUSTER_COLORS[activeCluster])
  })

  return (
    <mesh material={material} position={[world.x, world.y, 0]} renderOrder={3}>
      <planeGeometry args={[radius * 2, radius * 2]} />
    </mesh>
  )
}
```

(Code is illustrative; final implementation may use `<shaderMaterial>` JSX form, or a more refined fade-curve. The behavioral contract is what matters.)

### 2. Postprocessing — Bloom + Vignette

`post/BloomLayer.tsx`:

```tsx
'use client'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { useReducedMotion } from '../hooks/useReducedMotion'

export function PostStack({ isMobile }: { isMobile: boolean }) {
  const reducedMotion = useReducedMotion()
  // Bloom stays even with reducedMotion — it's composition, not motion.
  return (
    <EffectComposer
      multisampling={0}
      // Half-resolution render target on mobile (ADR-62)
      resolutionScale={isMobile ? 0.5 : 1.0}
    >
      <Bloom
        intensity={0.5}
        luminanceThreshold={0.75}
        luminanceSmoothing={0.9}
        radius={1.0}
        mipmapBlur
      />
      <Vignette eskil={false} offset={0.5} darkness={0.5} />
    </EffectComposer>
  )
}
```

(Drei's `<EffectComposer>` from `@react-three/postprocessing` wraps everything inside the Canvas with the post effects.)

Split into separate files if you prefer (`post/BloomLayer.tsx`, `post/VignetteLayer.tsx`), but a single `PostStack` is fine since both effects belong inside the same `<EffectComposer>` for performance.

### 3. Camera — `camera/ParallaxRig.tsx`

```tsx
'use client'
import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useReducedMotion } from '../hooks/useReducedMotion'

const MAX_TILT_DEG = 2.5

export function ParallaxRig() {
  const { camera } = useThree()
  const target = useRef({ x: 0, y: 0 })
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (reducedMotion) return
    const onMove = (e: PointerEvent) => {
      // Normalize mouse position to [-1, 1]
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1
      target.current = { x: nx * MAX_TILT_DEG, y: ny * MAX_TILT_DEG }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [reducedMotion])

  useFrame((_, dt) => {
    if (reducedMotion) return
    // Smoothly interpolate camera rotation toward target tilt
    const t = Math.min(1, dt * 3)
    camera.rotation.x += (target.current.y * Math.PI / 180 - camera.rotation.x) * t
    camera.rotation.y += (target.current.x * Math.PI / 180 - camera.rotation.y) * t
  })

  return null
}
```

Note: with an orthographic camera the visual effect of small rotations is subtle but still works for the parallax feel. If results are visually flat, consider translating the camera instead of rotating, or switching to a perspective camera with a very long focal length. The contract is: ±2–3° micro tilt that responds to mouse movement, disabled under reduced motion.

### 4. Mount in Scene.tsx

```tsx
import { ClusterAura } from './layers/ClusterAura'
import { PostStack } from './post/BloomLayer'
import { ParallaxRig } from './camera/ParallaxRig'

// inside the Canvas, AFTER all base layers but BEFORE labels:
{show('aura') && <ClusterAura viewport={viewport} />}
<ParallaxRig />
<PostStack isMobile={isMobile} />
```

`isMobile` derived from viewport: `const isMobile = viewport === 'mobile'`.

### 5. Update `state.ts` to support hover

Phase 3 added the placeholder. Now wire `hovered` to actually be updated by interaction (Phase 8 wires the actual mouse handlers; Phase 7 just makes sure the state machine supports it).

```ts
// state.ts — extend the Context value
interface ConstellationState {
  selected: TerritoryType | null
  hovered: TerritoryType | null
  cinematic: CinematicMode
  reducedMotion: boolean
  setHovered: (t: TerritoryType | null) => void
  setCinematic: (m: CinematicMode) => void
}
```

The Scene mounts the Provider with `useState` for `hovered` and `cinematic`. `selected` is passed down from the parent as a prop (drawer state stays in parents per the locked architecture).

```tsx
// inside Scene.tsx
const [hovered, setHovered] = useState<TerritoryType | null>(null)
const [cinematic, setCinematic] = useState<CinematicMode>('idle')

const value = useMemo(() => ({
  selected: props.selectedCluster ?? null,
  hovered,
  cinematic,
  reducedMotion,
  setHovered,
  setCinematic,
}), [props.selectedCluster, hovered, cinematic, reducedMotion])

return (
  <ConstellationContext.Provider value={value}>
    <Canvas>...</Canvas>
  </ConstellationContext.Provider>
)
```

(`selectedCluster` is a new prop on Scene; thread it through `ConstellationWebGL` → `Scene`. The parents — `_map-container.tsx` and `_public-profile-map.tsx` — already track which cluster's drawer is open in their own state and pass it via the `Constellation` prop chain. If they don't yet, Phase 3 should have set it up; if missing, add now.)

### 6. Visual checkpoint

Capture `/dev/map?layers=all` screenshot WITH `?cluster=backend_fortress` (or any test param triggering an active aura) into `tasks/2-stellarium-redesign/visual-checkpoints/phase7.png`.

For the screenshot test fixture, the `/dev/map` mock data should include a `?cluster=` query param that sets `selected` in the mock state — add this convenience for testing if not already present.

## Acceptance Criteria

```bash
# (1) Files have real bodies
test "$(wc -l < app/_components/Constellation/layers/ClusterAura.tsx)" -gt 40
test "$(wc -l < app/_components/Constellation/post/BloomLayer.tsx)" -gt 10
test "$(wc -l < app/_components/Constellation/camera/ParallaxRig.tsx)" -gt 25

# (2) Scene mounts all three
grep -q "ClusterAura" app/_components/Constellation/Scene.tsx
grep -q "PostStack\|EffectComposer" app/_components/Constellation/Scene.tsx
grep -q "ParallaxRig" app/_components/Constellation/Scene.tsx

# (3) Bloom uses mobile resolution scale 0.5
grep -q "resolutionScale" app/_components/Constellation/post/BloomLayer.tsx

# (4) Cluster aura uses cluster colors (one of the six allowed hexes)
grep -E "(#3b82f6|#06b6d4|#10b981|#a855f7|#f97316|#eab308)" app/_components/Constellation/layers/ClusterAura.tsx

# (5) Parallax respects reduced motion
grep -q "reducedMotion\|prefers-reduced-motion" app/_components/Constellation/camera/ParallaxRig.tsx

# (6) Build passes
npm run build

# (7) Visual checkpoint captured
mkdir -p tasks/2-stellarium-redesign/visual-checkpoints
test -f tasks/2-stellarium-redesign/visual-checkpoints/phase7.png

# (8) Console errors = 0
```

## How to verify AC

Run AC commands. All eight must pass. Set phase 7 status to `"completed"`.

## Notes

- **Cluster aura is event-only.** It must NOT render in steady state. Test by loading `/dev/map?layers=all` with no `?cluster=` param — the aura should be invisible. Then add `?cluster=backend_fortress` (or whatever the mock setup uses) — backend aura fades in.
- **Single active aura.** If two test conditions try to set both `selected` and `hovered` to different clusters, the priority order (cinematic > drawer-selected > hover) MUST hold. Verify by manually editing state in DevTools.
- **Cluster colors live in ONE place.** Define `CLUSTER_COLORS` in `ClusterAura.tsx` (or a shared constants file). Do NOT scatter cluster color hex values across multiple files. If you create a shared file, place it at `app/_components/Constellation/cluster-colors.ts` (proprietary).
- **Bloom calibration.** Threshold 0.75, intensity 0.5, radius 1.0 are starting points. After mounting, if tech stars don't bloom enough, lower threshold to 0.65. If field stars bloom too much, raise threshold to 0.85. Phase 12 locks final values.
- **Vignette is subtle.** Darkness 0.5 with offset 0.5 means edges darken ~50% at the corners. If it reads as too heavy, drop darkness to 0.35.
- **Reduced motion + Bloom.** Bloom stays ON under reduced motion. It is not animation — it is composition. Only the time-varying uniforms (twinkle, milky-way warp, parallax) disable.
- **Parallax under mobile.** No mouse events on mobile — the rig effectively no-ops. Do NOT wire to device orientation (gyro) — keep it desktop-only.
- **`isMobile` detection.** Derive from viewport prop, NOT from `window.innerWidth` (which is unreliable during SSR / hydration). The server-side render decides viewport already via the existing `viewport` resolution logic.
