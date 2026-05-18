# Phase 5: Milky Way + Territory Boundaries

## Preparation

Read these docs first:

- `/docs/adr.md` ADR-61 (Milky Way as warm wash), ADR-63 (Voronoi boundaries)
- `/docs/screens.md` §C Canvas — Milky Way nebulosity + Territory boundary lines
- `/docs/code-architecture.md` — `public/textures/` structure, `features/constellation/render/voronoi.ts`
- `/CLAUDE.md` — permitted Milky Way + ambient motion
- `/tasks/2-stellarium-redesign/docs-diff.md`
- `public/textures/LICENSE.md` (created Phase 1) — Pexels source provenance

Verify previous phase outputs:

- `Scene.tsx` mounts SkyBackground + FieldStars (Phase 4)
- `public/textures/source/milky-way-pexels-29746501.jpg` exists (Phase 1)
- `features/constellation/render/voronoi.ts` implemented and tested (Phase 2)

## Work

This phase processes the raw Pexels source into final WebP assets, then mounts the Milky Way and Territory Boundaries layers.

### 1. Process the raw Pexels source into the final textures

Write a Node.js processing script at `scripts/process-milky-way-texture.ts`:

```ts
/**
 * Processes the raw Pexels Milky Way photograph into:
 *   - public/textures/milky-way.webp        (4096×2867, q≈0.85)
 *   - public/textures/milky-way@2x.webp     (8192×5734, q≈0.80) — for high-DPR
 *   - public/textures/milky-way-fallback.jpg (1200×840, q≈0.80) — for the OG SVG embed
 *
 * Processing steps:
 *   1. Read source from public/textures/source/milky-way-pexels-29746501.jpg
 *   2. Crop to 10:7 aspect (matches viewBox 1000x700). Bias the crop so the
 *      galactic core falls on the right ~30% of the frame.
 *   3. Apply warm color grade — gentle channel mixer:
 *        R *= 1.06, G *= 1.00, B *= 0.92, then mild saturation reduction (~0.85x)
 *   4. Light Gaussian blur (radius 0.3 px) to soften pixel noise.
 *   5. Encode the three outputs at the listed resolutions / quality.
 *
 * Use `sharp` for image processing (add it as a devDependency if missing).
 */
```

Add `sharp` to devDependencies if not already present:

```bash
npm install --save-dev sharp
```

Run the script via `npx tsx scripts/process-milky-way-texture.ts`. Verify the three output files exist with correct dimensions.

Important: the crop bias. The user's reference image 3 (Stellarium with Milky Way on the right) shows the galactic core occupying the right ~30% of the canvas. Our processed texture should have the brightest dust-lane area falling roughly at the 0.7× horizontal position. If the raw Pexels image has the Milky Way running diagonal from upper-left to lower-right (image 4 in the candidate batch), crop a section where the brightest area is positioned right-of-center.

Capture the chosen crop coordinates in `tasks/2-stellarium-redesign/phase5-output.json` (the runner captures stdout; print the values).

### 2. Implement `layers/MilkyWay.tsx`

```tsx
'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { MILKY_WAY_FRAG } from '../shaders/milky-way.frag'
import { useConstellationState } from '../state'

const MILKY_WAY_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

export function MilkyWay() {
  const { reducedMotion } = useConstellationState()
  const texture = useTexture('/textures/milky-way.webp')

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTexture: { value: texture },
      uWarpAmount: { value: 0.003 },       // very subtle UV noise warp
      uBreathePeriod: { value: 45.0 },     // 45 second cycle (within 30-60s spec)
      uBreatheAmplitude: { value: 0.05 },  // ±5%
      uMotionEnabled: { value: 1.0 },
    },
    vertexShader: MILKY_WAY_VERT,
    fragmentShader: MILKY_WAY_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [texture])

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uMotionEnabled.value = reducedMotion ? 0.0 : 1.0
  })

  return (
    <mesh material={material} renderOrder={-900}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}
```

### 3. Shader — `milky-way.frag.ts`

```ts
export const MILKY_WAY_FRAG = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uTexture;
  uniform float uWarpAmount;
  uniform float uBreathePeriod;
  uniform float uBreatheAmplitude;
  uniform float uMotionEnabled;
  varying vec2 vUv;

  // Simple 2D hash + noise (cheap; for a higher-quality noise use a simplex implementation)
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    // Very subtle UV warp animated over time
    vec2 warpUv = vUv;
    warpUv.x += (noise(vUv * 3.0 + uTime * 0.02) - 0.5) * uWarpAmount * uMotionEnabled;
    warpUv.y += (noise(vUv * 3.0 - uTime * 0.02) - 0.5) * uWarpAmount * uMotionEnabled;

    vec4 tex = texture2D(uTexture, warpUv);

    // Opacity breathing — slow ±uBreatheAmplitude swing over uBreathePeriod seconds
    float breathe = 1.0 + sin(uTime * 6.2831853 / uBreathePeriod) * uBreatheAmplitude * uMotionEnabled;

    // Slight film grain
    float grain = (hash(vUv * 1000.0 + uTime * 0.1) - 0.5) * 0.04;

    // Subtle vignette
    vec2 centered = (vUv - 0.5) * 2.0;
    float vignette = 1.0 - dot(centered, centered) * 0.18;

    vec3 col = tex.rgb * breathe * vignette + vec3(grain);
    float alpha = tex.a;
    gl_FragColor = vec4(col, alpha);
  }
`
```

### 4. Implement `layers/TerritoryBoundaries.tsx`

```tsx
'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { voronoiCells } from '@/features/constellation/render/voronoi'
import { viewBoxToWorld } from '@/features/constellation/render/coords'

interface TerritoryBoundariesProps {
  viewport?: 'desktop' | 'mobile' | 'og'
}

export function TerritoryBoundaries({ viewport = 'desktop' }: TerritoryBoundariesProps) {
  const lines = useMemo(() => {
    const cells = voronoiCells(viewport)
    const segments: THREE.BufferGeometry[] = []
    cells.forEach(cell => {
      const verts = cell.polygon.map(p => viewBoxToWorld(p))
      for (let i = 0; i < verts.length; i++) {
        const a = verts[i]
        const b = verts[(i + 1) % verts.length]
        const geom = new THREE.BufferGeometry()
        geom.setAttribute('position', new THREE.Float32BufferAttribute([
          a.x, a.y, a.z,
          b.x, b.y, b.z,
        ], 3))
        segments.push(geom)
      }
    })
    return segments
  }, [viewport])

  return (
    <group renderOrder={-100}>
      {lines.map((g, i) => (
        <lineSegments key={i} geometry={g}>
          <lineBasicMaterial color="#4a5566" transparent opacity={0.1} />
        </lineSegments>
      ))}
    </group>
  )
}
```

Note: shared edges between adjacent cells are drawn twice. That's fine — opacity is so low (0.1) it doesn't visibly darken at shared edges. If you prefer to deduplicate, build a Set of canonical edge strings (`min(a,b)|max(a,b)`) and only emit each once. Either is acceptable.

### 5. Mount in Scene.tsx

```tsx
import { MilkyWay } from './layers/MilkyWay'
import { TerritoryBoundaries } from './layers/TerritoryBoundaries'

// inside the Canvas:
{show('milkyway') && <MilkyWay />}
{show('boundaries') && <TerritoryBoundaries viewport={viewport} />}
```

Render order: sky (-1000) → milkyway (-900) → fieldstars (default 0) → boundaries (-100). The boundaries should appear ON TOP of milkyway + fieldstars but UNDER tech stars (Phase 6). Adjust renderOrder if needed during testing.

### 6. Visual checkpoint

Capture `/dev/map?layers=sky,milkyway,fieldstars,boundaries` screenshot into `tasks/2-stellarium-redesign/visual-checkpoints/phase5.png`.

## Acceptance Criteria

```bash
# (1) Texture assets exist with correct sizes
test -f public/textures/milky-way.webp
test -f public/textures/milky-way@2x.webp
test -f public/textures/milky-way-fallback.jpg
# Check approximate dimensions via sharp metadata
node -e "const sharp=require('sharp'); sharp('public/textures/milky-way.webp').metadata().then(m => { if (m.width < 3500) process.exit(1); })"

# (2) Process script exists and ran
test -f scripts/process-milky-way-texture.ts

# (3) Layers have real bodies
test "$(wc -l < app/_components/Constellation/layers/MilkyWay.tsx)" -gt 30
test "$(wc -l < app/_components/Constellation/layers/TerritoryBoundaries.tsx)" -gt 20

# (4) Shader is real
grep -q "void main" app/_components/Constellation/shaders/milky-way.frag.ts

# (5) Scene mounts both layers
grep -q "MilkyWay" app/_components/Constellation/Scene.tsx
grep -q "TerritoryBoundaries" app/_components/Constellation/Scene.tsx

# (6) Build passes
npm run build

# (7) Visual checkpoint captured
mkdir -p tasks/2-stellarium-redesign/visual-checkpoints
# (See Phase 4 for the screenshot capture pattern)
test -f tasks/2-stellarium-redesign/visual-checkpoints/phase5.png

# (8) Console errors = 0 on render
```

## How to verify AC

Run the AC commands. All eight must pass. Set phase 5 status to `"completed"`.

Visual quality is NOT graded here. Phase 12 locks the baseline. As long as the texture loads and the layers render without errors, Phase 5 passes.

## Notes

- **Crop quality matters.** If the first crop attempt looks unbalanced (galactic core too far left/right/top/bottom), iterate the crop coordinates in `scripts/process-milky-way-texture.ts` and re-run. The processing script is meant to be re-runnable.
- **Do NOT commit `node_modules` changes** beyond what `npm install` legitimately produced. The `sharp` install pulls native binaries that should be in lockfile but NOT manually staged.
- **Boundary opacity 0.1.** Keep it very subtle. If it reads too strong on screenshot, drop to 0.08. Too weak, raise to 0.12. Phase 12 baseline iteration will lock the final value.
- **Milky Way breathing is decoupled from twinkle.** Both respect reduced-motion, but they have independent uniforms. Don't share `uTwinkleEnabled` across layers.
- **AdditiveBlending caveat.** With additive blending on the Milky Way, the texture's dark areas become transparent (zero contribution) and bright areas add to the sky background. That's the intended Stellarium-like blend. If the result looks washed out, reduce uTexture alpha multiplier or premultiply the texture during processing.
- **The `?layers=` toggle.** Verify each individual layer can be toggled off via the query param. `?layers=fieldstars` should show ONLY field stars (no milky way, no boundaries).
- **Production texture loading.** The texture is loaded from `/textures/milky-way.webp` (public/). Verify the path is correct under both `npm run dev` and `npm run build` + `npm start`.
- **Reduced motion.** With `prefers-reduced-motion: reduce`, the Milky Way UV warp and opacity breathing both disable (uMotionEnabled goes to 0). The static texture still renders — that's correct, it's not motion, it's composition.
