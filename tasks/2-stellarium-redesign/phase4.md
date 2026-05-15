# Phase 4: Scene, Sky, Field Stars

## Preparation

Read these docs first:

- `/docs/adr.md` ADR-61, ADR-62
- `/docs/screens.md` §C Canvas — Sky background layer + Field stars layer specs, Reduced motion subsection
- `/docs/code-architecture.md` — directory tree (layers/), shaders/ note (TS string literals)
- `/CLAUDE.md` — "Constellation visual language", forbidden list (twinkle bounded), permitted list (bounded ambient motion)
- `/tasks/2-stellarium-redesign/docs-diff.md`

Verify previous phase outputs:

- `Constellation.tsx` is the 3-way switch (Phase 3)
- `Scene.tsx` exists with an empty R3F Canvas (Phase 3)
- `Skeleton.tsx` renders background + boundaries + cluster labels
- `features/constellation/render/field-stars.ts` is implemented + tested (Phase 2)

Read the current code:

- `app/_components/Constellation/Scene.tsx` — empty Canvas placeholder
- `features/constellation/render/field-stars.ts` — deterministic field-star generation
- `app/dev/map/page.tsx` — playground

## Work

This phase mounts the first two real WebGL layers: `SkyBackground` (full-screen gradient quad) and `FieldStars` (instanced points with twinkle). Plus the `?layers=` query-param toggle infrastructure for `/dev/map`.

### 1. Layer toggle infrastructure on `/dev/map`

Update `app/dev/map/page.tsx` to extract layer toggles from `searchParams.layers`:

```tsx
const layers = new Set((searchParams?.layers ?? 'all').split(','))
// Pass to a small client wrapper that maps allowed layer names to boolean flags.
```

Allowed layer tokens: `sky`, `milkyway`, `fieldstars`, `boundaries`, `connections`, `techstars`, `aura`, `labels`, or `all`. When `all` is present, every layer renders. The client wrapper passes the resolved boolean flags to `<Constellation>` via a new optional `layerOverrides` prop, which forwards to `<Scene>`.

For Phase 4 only `sky` and `fieldstars` actually exist; the others are recognized but no-op until later phases mount them.

### 2. Implement `layers/SkyBackground.tsx`

A single full-screen quad in NDC space rendering a subtle vertical near-black gradient.

```tsx
'use client'
import { useMemo } from 'react'
import * as THREE from 'three'

export function SkyBackground() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        // Near-black gradient — zenith #020207 to edge #050307
        // Approximate using vertical NDC position (y in [-1, 1])
        float t = (gl_FragCoord.y / 700.0); // tune via uniforms if needed
        vec3 zenith = vec3(0.008, 0.008, 0.027);
        vec3 edge   = vec3(0.020, 0.012, 0.027);
        gl_FragColor = vec4(mix(edge, zenith, t), 1.0);
      }
    `,
    depthWrite: false,
    depthTest: false,
  }), [])

  return (
    <mesh material={material} renderOrder={-1000}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}
```

Place at the lowest renderOrder so all other layers draw on top.

### 3. Implement `layers/FieldStars.tsx`

Instanced points using `THREE.Points` with a custom ShaderMaterial. Uses `features/constellation/render/field-stars.ts` for deterministic positions/colors.

```tsx
'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { generateFieldStars } from '@/features/constellation/render/field-stars'
import { spectralHex } from '@/features/constellation/render/palette'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { TWINKLE_VERT } from '../shaders/twinkle.vert'
import { TWINKLE_FRAG } from '../shaders/twinkle.frag'
import { useConstellationState } from '../state'

interface FieldStarsProps {
  viewport?: 'desktop' | 'mobile' | 'og'
}

export function FieldStars({ viewport = 'desktop' }: FieldStarsProps) {
  const { reducedMotion } = useConstellationState()
  const stars = useMemo(() => generateFieldStars(viewport), [viewport])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const positions = new Float32Array(stars.length * 3)
    const sizes = new Float32Array(stars.length)
    const colors = new Float32Array(stars.length * 3)
    const phases = new Float32Array(stars.length)
    stars.forEach((s, i) => {
      const w = viewBoxToWorld(s.pos)
      positions[i*3+0] = w.x
      positions[i*3+1] = w.y
      positions[i*3+2] = w.z
      sizes[i] = s.size
      const c = new THREE.Color(spectralHex(s.color))
      colors[i*3+0] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b
      phases[i] = s.twinklePhase
    })
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    return g
  }, [stars])

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTwinkleAmplitude: { value: 0.10 }, // ±10% per ADR-61
      uTwinkleEnabled: { value: 1.0 },
    },
    vertexShader: TWINKLE_VERT,
    fragmentShader: TWINKLE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])

  // Drive twinkle uniform; respect reduced motion
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uTwinkleEnabled.value = reducedMotion ? 0.0 : 1.0
  })

  return <points args={[geom, material]} />
}
```

### 4. Shaders — `twinkle.vert.ts` / `twinkle.frag.ts`

Replace the Phase 1 placeholders with real shader source.

`shaders/twinkle.vert.ts`:

```ts
export const TWINKLE_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uTime;
  uniform float uTwinkleAmplitude;
  uniform float uTwinkleEnabled;
  varying vec3 vColor;
  varying float vIntensity;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Twinkle: per-star sinusoid offset by aPhase
    float t = uTime * 0.6 + aPhase * 6.2831853;
    float twinkle = 1.0 + sin(t) * uTwinkleAmplitude * uTwinkleEnabled;

    // Point size scales by aSize; perspective-correct attenuation
    gl_PointSize = aSize * twinkle * 1.5;
    vColor = aColor;
    vIntensity = twinkle;
  }
`
```

`shaders/twinkle.frag.ts`:

```ts
export const TWINKLE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vIntensity;

  void main() {
    // Soft circular point (no hard pixel edges)
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d) * 2.0;
    if (r > 1.0) discard;
    float alpha = pow(1.0 - r, 1.6);
    gl_FragColor = vec4(vColor * vIntensity, alpha);
  }
`
```

### 5. Mount the layers in `Scene.tsx`

```tsx
'use client'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { SkyBackground } from './layers/SkyBackground'
import { FieldStars } from './layers/FieldStars'
import { ConstellationContext } from './state'
import { useReducedMotion } from './hooks/useReducedMotion' // create this if not already

interface SceneProps {
  viewport?: 'desktop' | 'mobile' | 'og'
  layerOverrides?: Partial<{
    sky: boolean
    milkyway: boolean
    fieldstars: boolean
    boundaries: boolean
    connections: boolean
    techstars: boolean
    aura: boolean
    labels: boolean
  }>
}

export default function Scene({ viewport = 'desktop', layerOverrides }: SceneProps) {
  const reducedMotion = useReducedMotion()
  // Provider boilerplate omitted — instantiate ConstellationState with sensible defaults

  const show = (key: keyof NonNullable<typeof layerOverrides>) =>
    layerOverrides?.[key] ?? true

  return (
    <Canvas
      className="absolute inset-0"
      dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 2}
      gl={{ antialias: true, alpha: true }}
      orthographic
      camera={{ position: [0, 0, 5], zoom: 1, near: 0.1, far: 100 }}
      style={{ opacity: 0, transition: 'opacity 400ms ease-out' }}
      onCreated={({ gl }) => requestAnimationFrame(() => (gl.domElement.style.opacity = '1'))}
    >
      <ConstellationContext.Provider value={/* state object */ ...}>
        <Suspense fallback={null}>
          {show('sky') && <SkyBackground />}
          {show('fieldstars') && <FieldStars viewport={viewport} />}
          {/* Phase 5+: <MilkyWay />, <TerritoryBoundaries />, ... */}
        </Suspense>
      </ConstellationContext.Provider>
    </Canvas>
  )
}
```

Use an **orthographic camera** at z=5 looking at origin. World coordinates from `coords.ts` produce a flat 2.5D scene (we don't need perspective; bloom + additive blending sells the depth).

### 6. `useReducedMotion` hook

```tsx
'use client'
import { useEffect, useState } from 'react'

export function useReducedMotion(): boolean {
  const [r, setR] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setR(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setR(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return r
}
```

Place this in `app/_components/Constellation/hooks/useReducedMotion.ts` (create the `hooks/` directory).

### 7. Visual checkpoint

After the layers mount, capture a screenshot. Run `/dev/map?layers=sky,fieldstars` locally with `npm run dev` to verify visually. The screenshot is also captured automatically by the AC.

## Acceptance Criteria

```bash
# (1) Build passes
npm run build

# (2) Layer files exist with non-empty bodies
test "$(wc -l < app/_components/Constellation/layers/SkyBackground.tsx)" -gt 10
test "$(wc -l < app/_components/Constellation/layers/FieldStars.tsx)" -gt 30

# (3) Shaders have real source (not Phase 1 placeholder)
grep -q "void main" app/_components/Constellation/shaders/twinkle.vert.ts
grep -q "void main" app/_components/Constellation/shaders/twinkle.frag.ts

# (4) Scene mounts the two layers
grep -q "SkyBackground" app/_components/Constellation/Scene.tsx
grep -q "FieldStars" app/_components/Constellation/Scene.tsx

# (5) Visual checkpoint screenshot captured
# Start dev server in background, hit /dev/map, screenshot, kill server.
# This is a one-shot capture; baseline lock is Phase 12.
mkdir -p tasks/2-stellarium-redesign/visual-checkpoints
ENABLE_DEV_MAP=1 npm run dev &
DEV_PID=$!
sleep 8
npx playwright screenshot --browser=chromium --viewport-size=1440,900 \
  "http://localhost:3000/dev/map?layers=sky,fieldstars" \
  tasks/2-stellarium-redesign/visual-checkpoints/phase4.png
kill $DEV_PID || true
test -f tasks/2-stellarium-redesign/visual-checkpoints/phase4.png

# (6) Console errors on /dev/map = 0 during render
# (Captured via Playwright; if any uncaught errors appear, fail.)
```

(The bash above is illustrative — implement equivalent reliable logic. If `playwright screenshot` isn't available out of the box, write a tiny script `scripts/visual-checkpoint.ts` using Playwright API and invoke via `tsx`.)

## How to verify AC

Run the AC commands. All six must pass. Visual quality of the screenshot is NOT graded here — Phase 12 locks the baseline. Phase 4's bar is: build passes, layers mount, no console errors, screenshot file exists.

Set phase 4 status to `"completed"` in `/tasks/2-stellarium-redesign/index.json` if AC passes. Up to 3 remediation attempts.

## Notes

- **Twinkle is for field stars ONLY.** Tech stars (Phase 6) do NOT twinkle — identity is preserved per ADR-61.
- **Reduced motion path.** `uTwinkleEnabled` uniform set to 0 disables twinkle entirely. Field stars settle at neutral brightness. Verify with `prefers-reduced-motion: reduce` in DevTools.
- **Additive blending.** Field stars use `THREE.AdditiveBlending` so bloom (Phase 7) picks them up naturally. Do not set `transparent: true` without `depthWrite: false` — that would cause z-fighting.
- **Orthographic camera.** Switch from R3F's default perspective camera to orthographic. The constellation is identity, not a 3D scene; we want flat compositing.
- **DPR cap.** `dpr={Math.min(window.devicePixelRatio, 2)}` per ADR-62 mobile adaptive quality. Do NOT remove this cap.
- **viewport prop threading.** The viewport prop needs to flow from `<Constellation>` → `<ConstellationWebGL>` → `<Scene>` → `<FieldStars>`. Make sure Phase 3's prop wiring carries it.
- **No bloom yet.** Bloom is Phase 7. The stars will look harsh/pixelated without it — that's expected for now.
- **Layer toggle robustness.** `?layers=sky,fieldstars` should show only those two. `?layers=all` or omitted shows everything that exists. Future phases (5–9) add more layer tokens; the toggle wrapper should be generic.
- **Visual checkpoint screenshot is informational.** Save the path in `phase4-output.json`. The user reviews these as a batch at Phase 12.
