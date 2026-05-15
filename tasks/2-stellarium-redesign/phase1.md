# Phase 1: Dependencies & Scaffolding

## Preparation

First, read the documents below to fully understand the redesign:

- `/CLAUDE.md` — agent compliance, especially "Constellation visual language", "feature flag", "/dev/map env-var guard" sections
- `/docs/code-architecture.md` — directory tree (NOTE: `app/_components/Constellation/` and `features/constellation/render/` blocks), external dependencies, env vars
- `/docs/adr.md` ADR-61, ADR-62, ADR-63
- `/docs/screens.md` §C Canvas
- `/tasks/2-stellarium-redesign/docs-diff.md` (this task's documentation change record, generated after Phase 0)

Then verify Phase 0 output:

- `git log -1 --format='%s'` should show `feat(stellarium-redesign): phase 0 — stellarium-docs-commit`
- Pre-existing non-doc dirty state should still be present in working tree (Constellation.tsx M, Cluster/ClusterAura/Connections.tsx D, dev/map/page.tsx M, drizzle/migrations/0002_rls_and_triggers.sql M, public/textures/source/milky-way-pexels-29746501.jpg untracked)

Carefully read code from the previous phase (just docs). No prior code to chain from.

## Work

Install new dependencies and scaffold all new directories. **No real implementation in this phase** — only empty files / type stubs / `// TODO` markers. Phase 2+ implements them.

### 1. Install npm dependencies

Add to `package.json` dependencies:

```
three                            ^0.165
@react-three/fiber               ^8.16
@react-three/drei                ^9.108
@react-three/postprocessing      ^2.16
```

Add to `package.json` devDependencies:

```
@axe-core/playwright             ^4.10
size-limit                       ^11
@size-limit/preset-app           ^11
```

Note: `simplex-noise` is already installed. `d3-voronoi` is OPTIONAL — Phase 5 will decide whether to use it or hand-roll the 6-cell computation. Do not install it in this phase.

Run `npm install`. Commit the lockfile delta together with the package.json change.

### 2. Create `features/constellation/render/` scaffolding

Each file starts as a placeholder export with the correct shape. Phase 2 implements bodies.

Create `features/constellation/render/types.ts`:

```ts
// SPDX-License-Identifier: MIT
//
// Constellation render math — shared types.
// These types are isomorphic (used by both client WebGL renderer
// and server SVG OG renderer). Do NOT add server-only or client-only
// imports here.

import type { TerritoryType } from '@/lib/db/schema/territories'

export type Viewport = 'desktop' | 'mobile' | 'og'

export interface WorldCoord {
  x: number
  y: number
}

export interface ClusterAnchor extends WorldCoord {
  type: TerritoryType
  spread: number
}

export type AnchorMap = Record<Viewport, ClusterAnchor[]>

/** Spectral palette buckets used by tech stars and field stars. */
export type SpectralColor =
  | 'white'
  | 'blue-white'
  | 'yellow-white'
  | 'orange'
  | 'red'

export interface VoronoiCell {
  type: TerritoryType
  polygon: WorldCoord[]   // CCW vertices in viewBox units (1000x700)
}

export interface FieldStar {
  pos: WorldCoord
  size: number              // 1 | 2 | 3 (3 has visible halo)
  color: SpectralColor
  twinklePhase: number      // 0..1, deterministic
}

export interface MstEdge {
  a: WorldCoord
  b: WorldCoord
}
```

Then create empty placeholders (the file body is just `// TODO: Phase 2`):

```
features/constellation/render/anchors.ts       (// SPDX-License-Identifier: MIT)
features/constellation/render/palette.ts       (// SPDX-License-Identifier: MIT)
features/constellation/render/voronoi.ts       (// SPDX-License-Identifier: MIT)
features/constellation/render/labels.ts        (// SPDX-License-Identifier: MIT)
features/constellation/render/mst.ts           (// SPDX-License-Identifier: MIT)
features/constellation/render/magnitude.ts     (// SPDX-License-Identifier: MIT)
features/constellation/render/field-stars.ts   (// SPDX-License-Identifier: MIT)
features/constellation/render/coords.ts        (no SPDX header — internal helper, not extractable)
```

Each non-types file: SPDX header (if listed), then a stub like `export {}` or a placeholder function with the right signature. Bodies are `// TODO: Phase 2`.

Hard rule (CLAUDE.md): files under `features/constellation/render/` MUST NOT import `'server-only'`. This is the documented isomorphic exception.

### 3. Create `app/_components/Constellation/` new scaffolding (do NOT yet touch existing files)

Create these new files / directories. The existing files (`Constellation.tsx`, `Star.tsx`, `SparkAnimation.tsx`, `StarTooltip.tsx`, `star-positions.ts`) are NOT renamed or modified in this phase — Phase 3 handles that.

```
app/_components/Constellation/
├── Skeleton.tsx                  // 'use client' empty placeholder export function Skeleton() { return null }
├── Scene.tsx                     // 'use client' empty placeholder export default function Scene() { return null }
├── state.ts                      // 'use client' empty Context placeholder; export createConstellationContext() etc.
├── ConstellationWebGL.tsx        // 'use client' empty placeholder
├── use-webgl-detect.ts           // 'use client' empty hook stub returning true
├── layers/
│   ├── .gitkeep
│   ├── SkyBackground.tsx         // placeholder
│   ├── MilkyWay.tsx              // placeholder
│   ├── FieldStars.tsx            // placeholder
│   ├── TerritoryBoundaries.tsx   // placeholder
│   ├── Connections.tsx           // placeholder (new — replaces the legacy deleted one in Phase 3)
│   ├── TechStars.tsx             // placeholder
│   ├── ClusterAura.tsx           // placeholder
│   └── Labels.tsx                // placeholder
├── post/
│   ├── .gitkeep
│   ├── BloomLayer.tsx            // placeholder
│   └── VignetteLayer.tsx         // placeholder
├── camera/
│   ├── .gitkeep
│   └── ParallaxRig.tsx           // placeholder
├── overlay/
│   ├── .gitkeep
│   ├── A11yOverlay.tsx           // placeholder
│   └── TooltipHost.tsx           // placeholder
├── cinematics/
│   ├── .gitkeep
│   ├── SparkSequence.tsx         // placeholder
│   ├── StageUpRipple.tsx         // placeholder
│   ├── FirstEverCinematic.tsx    // REPLACES existing placeholder at end of Phase 9; for Phase 1 leave existing file untouched
│   └── RevealSequence.tsx        // placeholder
└── shaders/
    ├── .gitkeep
    ├── airy-disk.frag.ts         // export const AIRY_DISK_FRAG = '/* glsl */ // TODO Phase 6'
    ├── diffraction-spike.frag.ts // // TODO Phase 6
    ├── milky-way.frag.ts         // // TODO Phase 5
    ├── twinkle.vert.ts           // // TODO Phase 4
    ├── twinkle.frag.ts           // // TODO Phase 4
    └── line-glow.frag.ts         // // TODO Phase 6
```

All `.tsx` placeholder components have `'use client'` directive and a default export that returns `null`. Type stubs use `export {}` if needed.

Do NOT touch the existing `cinematics/FirstEverCinematic.tsx` if it lives outside `app/_components/Constellation/`; verify its current path first (it may be in `app/_components/SpecialMoments/FirstEverStarCinematic.tsx` per `docs/code-architecture.md`). If existing in SpecialMoments, leave it; Phase 9 migrates it.

### 4. Texture directory + LICENSE.md

The user has already saved the raw Pexels source to `public/textures/source/milky-way-pexels-29746501.jpg`. This phase commits it and writes the LICENSE doc.

Create `public/textures/LICENSE.md`:

```markdown
# Milky Way texture attribution

The Milky Way background texture used by the constellation renderer is derived from a Pexels photograph.

## Source

- **Photograph:** *Starry night sky capturing the Milky Way*
- **Photographer:** Giona Mason
- **URL:** https://www.pexels.com/photo/starry-night-sky-capturing-the-milky-way-29746501/
- **License:** [Pexels License](https://www.pexels.com/license/) — free to use, attribution recommended but not required, not for resale of unaltered copies.

The raw source is stored at `public/textures/source/milky-way-pexels-29746501.jpg` for reproducibility.

## Modifications (Phase 5)

Phase 5 of `tasks/2-stellarium-redesign/` will process the raw source into the final WebP assets used by the renderer:

- Crop to ~10:7 aspect (matching the constellation viewBox)
- Warm color grade toward sepia / ochre tones
- Light Gaussian blur (radius ≈ 0.3 px) to soften pixel-level noise
- Encode 4K WebP (`public/textures/milky-way.webp`) and high-DPR WebP (`public/textures/milky-way@2x.webp`)
- Encode JPG fallback for the OG image renderer (`public/textures/milky-way-fallback.jpg`)

The exact processing parameters used will be recorded in `tasks/2-stellarium-redesign/phase5-output.json`.

## Attribution policy

The Pexels License does not require in-product attribution. This file constitutes our public record of the source and license. If product UI is added later that surfaces credit (e.g. an "About" page), photographer name should be listed there as well.
```

Also create `public/textures/.gitignore` to mark which files are tracked:

Wait — do NOT create a .gitignore inside public/textures/ because the generated WebP/JPG files (created in Phase 5) WILL be committed. Just commit the source + LICENSE.md normally.

### 5. Update `package.json` scripts

Add (do not remove existing scripts):

```json
{
  "scripts": {
    "size": "size-limit",
    "visual:test": "playwright test tests/visual",
    "axe:test": "playwright test tests/a11y"
  }
}
```

Add `size-limit` config in `package.json`:

```json
{
  "size-limit": [
    {
      "name": "/ initial JS (excluding lazy R3F chunk)",
      "path": ".next/static/chunks/pages/_app-*.js",
      "limit": "250 KB"
    },
    {
      "name": "Constellation Scene lazy chunk (R3F + drei + postprocessing)",
      "path": ".next/static/chunks/constellation-*.js",
      "limit": "180 KB"
    }
  ]
}
```

(Glob patterns are approximations; Phase 12 will tune them based on actual emitted chunk names.)

### 6. `next.config.mjs` — no changes required this phase

Confirm `next.config.mjs` already supports static asset serving from `public/`. If a custom webpack section exists, do NOT add a `.glsl` loader (we use TS string literals — see CLAUDE.md / ADR-62).

### 7. tsconfig path alias

Verify `@/*` is mapped to `./*` (per existing `tsconfig.json`). The new `features/constellation/render/*` and `app/_components/Constellation/*` files should resolve via the existing alias.

### 8. `.gitignore` housekeeping

Verify `tsconfig.tsbuildinfo` is in `.gitignore`. If not, add it.

## Acceptance Criteria

```bash
# (1) Install succeeds and the new deps exist
npm install
test "$(jq -r '.dependencies["@react-three/fiber"]' package.json)" != "null"
test "$(jq -r '.dependencies["@react-three/drei"]' package.json)" != "null"
test "$(jq -r '.dependencies["@react-three/postprocessing"]' package.json)" != "null"
test "$(jq -r '.dependencies.three' package.json)" != "null"
test "$(jq -r '.devDependencies["@axe-core/playwright"]' package.json)" != "null"
test "$(jq -r '.devDependencies["size-limit"]' package.json)" != "null"

# (2) All scaffold files exist (sample check — extend list as needed)
test -f features/constellation/render/types.ts
test -f features/constellation/render/anchors.ts
test -f features/constellation/render/palette.ts
test -f features/constellation/render/voronoi.ts
test -f features/constellation/render/labels.ts
test -f features/constellation/render/mst.ts
test -f features/constellation/render/magnitude.ts
test -f features/constellation/render/field-stars.ts
test -f features/constellation/render/coords.ts
test -f app/_components/Constellation/Skeleton.tsx
test -f app/_components/Constellation/Scene.tsx
test -f app/_components/Constellation/state.ts
test -f app/_components/Constellation/ConstellationWebGL.tsx
test -f app/_components/Constellation/use-webgl-detect.ts
test -d app/_components/Constellation/layers
test -d app/_components/Constellation/post
test -d app/_components/Constellation/camera
test -d app/_components/Constellation/overlay
test -d app/_components/Constellation/cinematics
test -d app/_components/Constellation/shaders
test -f public/textures/LICENSE.md
test -f public/textures/source/milky-way-pexels-29746501.jpg

# (3) Build passes (placeholders compile)
npm run build

# (4) SPDX headers present in MIT files
for f in features/constellation/render/{palette,voronoi,labels,mst,magnitude,field-stars}.ts; do
  head -n 1 "$f" | grep -q "SPDX-License-Identifier: MIT" || { echo "missing SPDX in $f"; exit 1; }
done

# (5) features/constellation/render does NOT import server-only
! grep -r "server-only" features/constellation/render/
```

## How to verify AC

Run the AC commands. All five must pass. If pass, set phase 1 status to `"completed"` in `/tasks/2-stellarium-redesign/index.json`. If any fail after 3 remediation attempts, set status to `"error"` with `"error_message"` describing the failure.

## Notes

- **Placeholders only.** Do NOT implement any real logic. Phase 2 implements `features/constellation/render/*`; Phase 3+ implements UI components. A placeholder that returns `null` and a function stub that throws "Not yet implemented" are both acceptable.
- **Do NOT delete existing Constellation files** (`Constellation.tsx`, `Star.tsx`, `SparkAnimation.tsx`, `StarTooltip.tsx`, `star-positions.ts`). They survive into Phase 3 where `Constellation.tsx` is renamed to `ConstellationSVG.tsx`.
- **Do NOT modify** `drizzle/migrations/0002_rls_and_triggers.sql` (out of scope; pre-existing dirty change handled separately).
- **`features/constellation/render/*` import rules.** Pure TypeScript only. No `'use client'`, no `'server-only'`, no React, no Three.js types. Only types from `@/lib/db/schema/territories` (for `TerritoryType`) and from each other.
- **SPDX headers** must be the FIRST line of the file (above any imports, comments, or directives).
- **Commit message:** the runner handles the commit (`feat(stellarium-redesign): phase 1 — deps-and-scaffold` followed by a chore commit for runner housekeeping). Do not commit manually unless you've already made changes that need staging — in which case use the same `feat(...)` message format and stage explicitly.
