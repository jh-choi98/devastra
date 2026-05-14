# Phase 3: Constellation Renderer

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/prd.md` §Mission · §The four value pillars
- `/docs/flow.md` Flow 1 §First-time reveal · Sub-flow B (first-ever cinematic) · Sub-flow A (stage-up)
- `/docs/screens.md` §C Main constellation page · §I Special moments
- `/docs/tech-catalog.md` (display_name + `{x, y}` columns + cluster labels)
- `/docs/adr.md` ADR-2 (3-layer model) · ADR-8 (Realtime) · ADR-26 (constellation pivot) · ADR-27 (open-core MIT headers) · ADR-37 (cluster "expanded") · ADR-54 (reduced motion)
- `/CLAUDE.md` §Constellation UI vs internal DB naming · §SPDX license headers · §Server-only discipline
- `/tasks/1-pivot-mvp/docs-diff.md`

Then verify Phase 2's output:

- `lib/og/version.ts`, `lib/utils/reserved-usernames.ts`, etc. exist
- `features/sync/cinematic-detection.ts` exists
- All unit tests pass

Read the existing code to understand what is being replaced:

- `app/_components/Map/LivingMap.tsx` — current SVG canvas (will be replaced)
- `app/_components/Map/Island.tsx`, `Landmark.tsx` — current cluster + star equivalents
- `app/_components/Map/island-shape.ts`, `landmark-placement.ts` — current shape generation
- `features/territories/registry.ts` — `TERRITORIES` palette (6 entries, currently with old-style names)
- `features/territories/tech-catalog.ts` — current 58 entries (with old `landmarkName` field)
- `features/territories/tech-catalog-public.ts` — client-safe re-export

Carefully read the code from previous phases. Understand the design intent before working.

## Work

This phase replaces the `Map/` renderer with `Constellation/` and refreshes the tech catalog. It is large but self-contained: schema unchanged, only the rendering layer and catalog-display layer change.

### 1. Refresh `features/territories/tech-catalog.ts`

Add SPDX MIT header. Rename `landmarkName` field to `displayName` (plain tech name). Add `x, y` fields (optional). Use the exact display names from `docs/tech-catalog.md`.

```ts
// SPDX-License-Identifier: MIT
import 'server-only'
import type { TerritoryType } from './registry'

export type DetectionRule =
  | { kind: 'ext'; extensions: string[] }
  | { kind: 'path'; prefixes: string[] }
  | { kind: 'filename'; names: string[] }
  | { kind: 'packageJson'; packageName: string }
  | { kind: 'requirementsTxt'; packageName: string }
  | { kind: 'goMod'; modulePath: string }
  | { kind: 'gemfile'; gemName: string }
  | { kind: 'cargoToml'; crateName: string }

export type TechCatalogEntry = {
  tech_key: string
  displayName: string
  territory: TerritoryType
  rules: DetectionRule[]
  /** Normalized [0, 1] position within the cluster. Optional — falls back to
   *  deterministic hash placement when absent. Hand-tuned in design pass. */
  x?: number
  y?: number
}

export const TECH_CATALOG: readonly TechCatalogEntry[] = [
  // ── Frontend cluster ───────────────────────────────────────────────────────
  { tech_key: 'typescript', displayName: 'TypeScript', territory: 'frontend_land', rules: [{ kind: 'ext', extensions: ['.ts', '.tsx'] }] },
  { tech_key: 'javascript', displayName: 'JavaScript', territory: 'frontend_land', rules: [{ kind: 'ext', extensions: ['.js', '.jsx', '.mjs', '.cjs'] }] },
  { tech_key: 'react', displayName: 'React', territory: 'frontend_land', rules: [{ kind: 'packageJson', packageName: 'react' }] },
  { tech_key: 'nextjs', displayName: 'Next.js', territory: 'frontend_land', rules: [{ kind: 'packageJson', packageName: 'next' }] },
  { tech_key: 'vue', displayName: 'Vue', territory: 'frontend_land', rules: [{ kind: 'packageJson', packageName: 'vue' }] },
  { tech_key: 'svelte', displayName: 'Svelte', territory: 'frontend_land', rules: [{ kind: 'packageJson', packageName: 'svelte' }] },
  { tech_key: 'angular', displayName: 'Angular', territory: 'frontend_land', rules: [{ kind: 'packageJson', packageName: '@angular/core' }] },
  { tech_key: 'tailwind', displayName: 'Tailwind', territory: 'frontend_land', rules: [{ kind: 'packageJson', packageName: 'tailwindcss' }] },
  { tech_key: 'css', displayName: 'CSS', territory: 'frontend_land', rules: [{ kind: 'ext', extensions: ['.css'] }] },
  { tech_key: 'sass', displayName: 'Sass', territory: 'frontend_land', rules: [{ kind: 'ext', extensions: ['.scss', '.sass'] }] },
  { tech_key: 'vite', displayName: 'Vite', territory: 'frontend_land', rules: [{ kind: 'packageJson', packageName: 'vite' }] },
  { tech_key: 'webpack', displayName: 'Webpack', territory: 'frontend_land', rules: [{ kind: 'packageJson', packageName: 'webpack' }] },
  // ── Backend cluster ────────────────────────────────────────────────────────
  { tech_key: 'nodejs', displayName: 'Node.js', territory: 'backend_fortress', rules: [{ kind: 'filename', names: ['package.json'] }] },
  { tech_key: 'express', displayName: 'Express', territory: 'backend_fortress', rules: [{ kind: 'packageJson', packageName: 'express' }] },
  { tech_key: 'fastify', displayName: 'Fastify', territory: 'backend_fortress', rules: [{ kind: 'packageJson', packageName: 'fastify' }] },
  { tech_key: 'nestjs', displayName: 'NestJS', territory: 'backend_fortress', rules: [{ kind: 'packageJson', packageName: '@nestjs/core' }] },
  { tech_key: 'go', displayName: 'Go', territory: 'backend_fortress', rules: [{ kind: 'ext', extensions: ['.go'] }] },
  { tech_key: 'gin', displayName: 'Gin', territory: 'backend_fortress', rules: [{ kind: 'goMod', modulePath: 'gin-gonic/gin' }] },
  { tech_key: 'python', displayName: 'Python', territory: 'backend_fortress', rules: [{ kind: 'ext', extensions: ['.py'] }] },
  { tech_key: 'fastapi', displayName: 'FastAPI', territory: 'backend_fortress', rules: [{ kind: 'requirementsTxt', packageName: 'fastapi' }] },
  { tech_key: 'django', displayName: 'Django', territory: 'backend_fortress', rules: [{ kind: 'requirementsTxt', packageName: 'django' }] },
  { tech_key: 'flask', displayName: 'Flask', territory: 'backend_fortress', rules: [{ kind: 'requirementsTxt', packageName: 'flask' }] },
  { tech_key: 'rust', displayName: 'Rust', territory: 'backend_fortress', rules: [{ kind: 'ext', extensions: ['.rs'] }] },
  { tech_key: 'java', displayName: 'Java', territory: 'backend_fortress', rules: [{ kind: 'ext', extensions: ['.java'] }] },
  // ── Data cluster ───────────────────────────────────────────────────────────
  { tech_key: 'postgres', displayName: 'Postgres', territory: 'data_pipeline_zone', rules: [{ kind: 'packageJson', packageName: 'pg' }] },
  { tech_key: 'mysql', displayName: 'MySQL', territory: 'data_pipeline_zone', rules: [{ kind: 'packageJson', packageName: 'mysql2' }] },
  { tech_key: 'sqlite', displayName: 'SQLite', territory: 'data_pipeline_zone', rules: [{ kind: 'packageJson', packageName: 'better-sqlite3' }] },
  { tech_key: 'mongodb', displayName: 'MongoDB', territory: 'data_pipeline_zone', rules: [{ kind: 'packageJson', packageName: 'mongoose' }] },
  { tech_key: 'redis', displayName: 'Redis', territory: 'data_pipeline_zone', rules: [{ kind: 'packageJson', packageName: 'ioredis' }] },
  { tech_key: 'sql', displayName: 'SQL', territory: 'data_pipeline_zone', rules: [{ kind: 'ext', extensions: ['.sql'] }] },
  { tech_key: 'dbt', displayName: 'dbt', territory: 'data_pipeline_zone', rules: [{ kind: 'filename', names: ['dbt_project.yml'] }] },
  { tech_key: 'prisma', displayName: 'Prisma', territory: 'data_pipeline_zone', rules: [{ kind: 'packageJson', packageName: 'prisma' }] },
  // ── Testing cluster ────────────────────────────────────────────────────────
  { tech_key: 'jest', displayName: 'Jest', territory: 'testing_lab', rules: [{ kind: 'packageJson', packageName: 'jest' }] },
  { tech_key: 'vitest', displayName: 'Vitest', territory: 'testing_lab', rules: [{ kind: 'packageJson', packageName: 'vitest' }] },
  { tech_key: 'pytest', displayName: 'pytest', territory: 'testing_lab', rules: [{ kind: 'requirementsTxt', packageName: 'pytest' }] },
  { tech_key: 'playwright', displayName: 'Playwright', territory: 'testing_lab', rules: [{ kind: 'packageJson', packageName: '@playwright/test' }] },
  { tech_key: 'cypress', displayName: 'Cypress', territory: 'testing_lab', rules: [{ kind: 'packageJson', packageName: 'cypress' }] },
  { tech_key: 'rspec', displayName: 'RSpec', territory: 'testing_lab', rules: [{ kind: 'gemfile', gemName: 'rspec' }] },
  // ── DevOps cluster ─────────────────────────────────────────────────────────
  { tech_key: 'docker', displayName: 'Docker', territory: 'devops_harbor', rules: [{ kind: 'filename', names: ['Dockerfile'] }] },
  { tech_key: 'ghactions', displayName: 'GitHub Actions', territory: 'devops_harbor', rules: [{ kind: 'path', prefixes: ['.github/workflows/'] }] },
  { tech_key: 'terraform', displayName: 'Terraform', territory: 'devops_harbor', rules: [{ kind: 'ext', extensions: ['.tf'] }] },
  { tech_key: 'kubernetes', displayName: 'Kubernetes', territory: 'devops_harbor', rules: [{ kind: 'path', prefixes: ['k8s/'] }] },
  { tech_key: 'aws', displayName: 'AWS', territory: 'devops_harbor', rules: [{ kind: 'packageJson', packageName: 'aws-cdk-lib' }] },
  { tech_key: 'vercel', displayName: 'Vercel', territory: 'devops_harbor', rules: [{ kind: 'filename', names: ['vercel.json'] }] },
  { tech_key: 'nginx', displayName: 'Nginx', territory: 'devops_harbor', rules: [{ kind: 'filename', names: ['nginx.conf'] }] },
  // ── Docs cluster ───────────────────────────────────────────────────────────
  { tech_key: 'markdown', displayName: 'Markdown', territory: 'docs_library', rules: [{ kind: 'ext', extensions: ['.md'] }] },
  { tech_key: 'mdx', displayName: 'MDX', territory: 'docs_library', rules: [{ kind: 'ext', extensions: ['.mdx'] }] },
  { tech_key: 'jsdoc', displayName: 'JSDoc', territory: 'docs_library', rules: [{ kind: 'filename', names: ['jsdoc.json'] }] },
  { tech_key: 'storybook', displayName: 'Storybook', territory: 'docs_library', rules: [{ kind: 'path', prefixes: ['.storybook/'] }] },
  { tech_key: 'openapi', displayName: 'OpenAPI', territory: 'docs_library', rules: [{ kind: 'filename', names: ['openapi.yaml'] }] },
]
```

Also add SPDX headers to `features/territories/{rules,scoring,classifier,registry}.ts` and update `features/territories/tech-catalog-public.ts` to re-export the new shape (`displayName` instead of `landmarkName`).

**Backwards-compat note:** code currently importing `entry.landmarkName` must be updated to `entry.displayName`. Grep the repo: classifier code, drawer code, OG image code, tech-catalog-public.ts. Update all sites in the same phase.

### 2. Update `features/territories/registry.ts`

Add SPDX header. Cluster labels become plain English; aura color stays but `name` is now the short label.

```ts
// SPDX-License-Identifier: MIT
export type TerritoryType =
  | 'frontend_land'
  | 'backend_fortress'
  | 'data_pipeline_zone'
  | 'testing_lab'
  | 'devops_harbor'
  | 'docs_library'

export type TerritoryMeta = {
  /** Short, neutral cluster label rendered as the in-canvas label. */
  name: string
  /** Cluster aura color + star color base. */
  color: string
  /** Brighter accent for star centers / connection highlights. */
  accentColor: string
}

export const TERRITORIES: Record<TerritoryType, TerritoryMeta> = {
  frontend_land:     { name: 'Frontend', color: '#7C9DFF', accentColor: '#3B5BFF' },
  backend_fortress:  { name: 'Backend',  color: '#94A3B8', accentColor: '#475569' },
  data_pipeline_zone:{ name: 'Data',     color: '#34D399', accentColor: '#047857' },
  testing_lab:       { name: 'Testing',  color: '#A78BFA', accentColor: '#7C3AED' },
  devops_harbor:     { name: 'DevOps',   color: '#38BDF8', accentColor: '#0369A1' },
  docs_library:      { name: 'Docs',     color: '#FBBF24', accentColor: '#B45309' },
}

export const ALL_TERRITORY_TYPES: TerritoryType[] = Object.keys(TERRITORIES) as TerritoryType[]
```

The `shapeSeed` and `landmarkColor` fields used by the old island renderer can be removed — confirm no other call site reads them, otherwise keep them through this phase and clean up in Phase 12.

### 3. Create `features/territories/star-positions.ts` (MIT)

Deterministic hash-based fallback. When catalog `x, y` is present, use it; otherwise hash `tech_key` into `[0.15, 0.85]² safe area`. Used by both live renderer and OG.

```ts
// SPDX-License-Identifier: MIT
import { TECH_CATALOG } from './tech-catalog'
import type { TerritoryType } from './registry'

export type StarPosition = { x: number; y: number; tech_key: string; territory: TerritoryType }

// Mulberry32 PRNG for deterministic placement
function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function cyrb53(str: string): number {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

// SAFE area within a cluster (avoid 0/1 edges) — see docs/tech-catalog.md design principles
const SAFE_MIN = 0.15
const SAFE_MAX = 0.85
const SAFE_RANGE = SAFE_MAX - SAFE_MIN

function fallbackPosition(tech_key: string): { x: number; y: number } {
  const rng = mulberry32(cyrb53(tech_key))
  return {
    x: SAFE_MIN + rng() * SAFE_RANGE,
    y: SAFE_MIN + rng() * SAFE_RANGE,
  }
}

let cached: StarPosition[] | null = null

export function getStarPositions(): StarPosition[] {
  if (cached) return cached
  cached = TECH_CATALOG.map((entry) => ({
    tech_key: entry.tech_key,
    territory: entry.territory,
    x: entry.x ?? fallbackPosition(entry.tech_key).x,
    y: entry.y ?? fallbackPosition(entry.tech_key).y,
  }))
  return cached
}

export function getStarPosition(tech_key: string): StarPosition | undefined {
  return getStarPositions().find((p) => p.tech_key === tech_key)
}
```

### 4. Create `app/_components/Constellation/` directory

Files:

#### `Constellation.tsx` (client component, root)

```tsx
'use client'

import type { TerritoryType } from '@/features/territories/registry'
import { ALL_TERRITORY_TYPES } from '@/features/territories/registry'
import { Cluster } from './Cluster'
import { Connections } from './Connections'
import { ClusterAura } from './ClusterAura'

export type ConstellationData = {
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
  /** ISO date string. Diff visualization highlights changes since this point. */
  diffSince?: string | null
  /** Viewport mode controls cluster center positions. */
  viewport?: 'desktop' | 'mobile' | 'og'
}

// Cluster center positions per viewport (0..1 normalized within canvas).
// Six clusters arranged in 2 columns × 3 rows for portrait, 3 columns × 2 rows for landscape.
const CLUSTER_CENTERS: Record<'desktop' | 'mobile' | 'og', Record<TerritoryType, { cx: number; cy: number; r: number }>> = {
  desktop: {
    frontend_land:      { cx: 0.20, cy: 0.30, r: 0.16 },
    backend_fortress:   { cx: 0.50, cy: 0.30, r: 0.16 },
    data_pipeline_zone: { cx: 0.80, cy: 0.30, r: 0.16 },
    testing_lab:        { cx: 0.20, cy: 0.72, r: 0.16 },
    devops_harbor:      { cx: 0.50, cy: 0.72, r: 0.16 },
    docs_library:       { cx: 0.80, cy: 0.72, r: 0.16 },
  },
  og: {
    frontend_land:      { cx: 0.18, cy: 0.32, r: 0.14 },
    backend_fortress:   { cx: 0.50, cy: 0.32, r: 0.14 },
    data_pipeline_zone: { cx: 0.82, cy: 0.32, r: 0.14 },
    testing_lab:        { cx: 0.18, cy: 0.70, r: 0.14 },
    devops_harbor:      { cx: 0.50, cy: 0.70, r: 0.14 },
    docs_library:       { cx: 0.82, cy: 0.70, r: 0.14 },
  },
  mobile: {
    frontend_land:      { cx: 0.28, cy: 0.18, r: 0.18 },
    backend_fortress:   { cx: 0.72, cy: 0.18, r: 0.18 },
    data_pipeline_zone: { cx: 0.28, cy: 0.48, r: 0.18 },
    testing_lab:        { cx: 0.72, cy: 0.48, r: 0.18 },
    devops_harbor:      { cx: 0.28, cy: 0.78, r: 0.18 },
    docs_library:       { cx: 0.72, cy: 0.78, r: 0.18 },
  },
}

export function Constellation({
  data,
  onClusterClick,
  onStarClick,
}: {
  data: ConstellationData
  onClusterClick?: (territory: TerritoryType) => void
  onStarClick?: (territory: TerritoryType, tech_key: string) => void
}) {
  const viewport = data.viewport ?? 'desktop'
  const centers = CLUSTER_CENTERS[viewport]

  return (
    <div className="relative w-full h-full">
      <svg viewBox="0 0 1000 700" className="w-full h-full" role="img"
           aria-label={`Constellation with ${data.landmarks.length} stars lit across ${data.territories.filter(t => t.stage > 1).length} clusters`}>
        <defs>
          <linearGradient id="sky-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b1020" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
        </defs>
        <rect width="1000" height="700" fill="url(#sky-gradient)" />

        {ALL_TERRITORY_TYPES.map((type) => {
          const territory = data.territories.find((t) => t.type === type)
          const stars = data.landmarks.filter((l) => l.territory === type)
          const center = centers[type]
          const cx = center.cx * 1000
          const cy = center.cy * 700
          const radius = center.r * Math.min(1000, 700)

          return (
            <g key={type} transform={`translate(${cx.toFixed(1)}, ${cy.toFixed(1)})`}>
              <ClusterAura
                type={type}
                radius={radius}
                stage={territory?.stage ?? 1}
                stageChangedAt={territory?.stageChangedAt ?? null}
                diffSince={data.diffSince ?? null}
              />
              <Connections
                type={type}
                stars={stars}
                radius={radius}
              />
              <Cluster
                type={type}
                radius={radius}
                stage={territory?.stage ?? 1}
                growth30d={territory?.growth30d ?? 0}
                stars={stars}
                diffSince={data.diffSince ?? null}
                onClusterClick={onClusterClick ? () => onClusterClick(type) : undefined}
                onStarClick={onStarClick ? (tech_key) => onStarClick(type, tech_key) : undefined}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
```

#### `Cluster.tsx` — renders one cluster (outline + stars + label)

Signature only — implement the body:

```tsx
'use client'
import type { TerritoryType } from '@/features/territories/registry'
import { TERRITORIES } from '@/features/territories/registry'
import { Star } from './Star'
import { getStarPositions } from '@/features/territories/star-positions'

export function Cluster(props: {
  type: TerritoryType
  radius: number
  stage: number
  growth30d: number
  stars: Array<{ tech_key: string; weight: number; firstUnlockedAt: string | null }>
  diffSince: string | null
  onClusterClick?: () => void
  onStarClick?: (tech_key: string) => void
}): JSX.Element {
  // - Outline: faint circle at `radius`. Brighter when any star is lit.
  // - Label: short cluster name (TERRITORIES[type].name) positioned below the cluster (cy = radius + 18).
  //   Label is keyboard-focusable: role="button" tabIndex={0}, with onClick + Enter/Space handlers calling onClusterClick.
  // - Stars: for each star, look up position via getStarPositions(); convert {x, y} from [0,1] to cluster-local (-radius..+radius).
  //   Render <Star /> with onClick={() => onStarClick?.(tech_key)}.
  // - Mark "lit" stars: weight > 0. Unlit stars are not rendered in this view (ADR — empty cluster outlines for sparse users only in demo/landing).
  return /* ... */ null as any
}
```

Implementation rules:
- Compute `litCount = stars.filter((s) => s.weight > 0).length`. Cluster outline opacity = lit count > 0 ? 0.6 : 0.25.
- Compute hero label sites: top 1–2 stars by weight in this cluster get an inline label next to them. Tie-break by `tech_key` alphabetical.
- Recently grown indicator: `stageChangedAt` within 7 days OR a star's `firstUnlockedAt` within `diffSince` adds visual glow.

#### `Star.tsx` — renders one star (layered circles glow + spark animation hook)

```tsx
'use client'
import { motion } from 'framer-motion'
import { getPublicTech } from '@/features/territories/tech-catalog-public'

export function Star(props: {
  tech_key: string
  x: number
  y: number
  weight: number
  color: string
  accentColor: string
  /** True if first_unlocked_at is more recent than the diff threshold. Triggers spark. */
  isNew: boolean
  /** Optional hero label visible without hover. */
  heroLabel?: string
  onClick?: () => void
}): JSX.Element {
  // Size scales with weight: r = min(12, 4 + log(max(1, weight)) * 2.5)
  // Glow via layered circles (3 layers): outer r*3 opacity 0.08, mid r*2 opacity 0.18, inner r*1.4 opacity 0.4, core r*1 fill.
  // If isNew, framer-motion spark animation: small dot → plus-shape flash → settle. Use prefers-reduced-motion guard to snap to final state.
  // Hero label rendered as a <text> element to the right of the star, offset by r + 8 px.
  // Hit area: an invisible <circle> with r=Math.max(r, 12) to ensure touch-friendly target (≥24px on mobile via outer transform). onClick passes through.
  // aria-hidden on the visible decorative layers; the cluster-level <g> carries the ARIA semantics.
  return /* ... */ null as any
}
```

#### `Connections.tsx` — MST among lit stars per cluster

```tsx
'use client'
import { useMemo } from 'react'
import { getStarPositions } from '@/features/territories/star-positions'
import type { TerritoryType } from '@/features/territories/registry'

export function Connections(props: {
  type: TerritoryType
  stars: Array<{ tech_key: string; weight: number; firstUnlockedAt: string | null }>
  radius: number
}): JSX.Element | null {
  // Filter to lit stars (weight > 0). If < 2, no lines.
  // Look up positions for each lit star (cluster-local coords scaled by radius).
  // Compute Minimum Spanning Tree (Prim's algorithm — O(n²), n ≤ ~30 is trivial).
  // Render each MST edge as a <line> with stroke="#475569", strokeWidth="1", opacity="0.4".
  return /* ... */ null
}
```

#### `ClusterAura.tsx` — soft radial gradient + stage-up ripple

```tsx
'use client'
import { motion } from 'framer-motion'
import { TERRITORIES } from '@/features/territories/registry'
import type { TerritoryType } from '@/features/territories/registry'

export function ClusterAura(props: {
  type: TerritoryType
  radius: number
  stage: number
  stageChangedAt: string | null
  diffSince: string | null
}): JSX.Element {
  // Static aura: faint radial gradient at cluster center, fading to transparent at radius.
  // Color = TERRITORIES[type].color at 0.05 opacity at center.
  // Intensity scales with stage: stage 1 → 0.05, stage 5 → 0.20.
  // Ripple animation (ADR-37): if stageChangedAt > diffSince, render an expanding circle from r=radius*0.5 to r=radius*1.2 over 1.5s.
  //   Respect prefers-reduced-motion: skip the animation and just render the higher-intensity final state.
  return /* ... */ null as any
}
```

#### `StarTooltip.tsx` — desktop hover only

```tsx
'use client'
import { useState } from 'react'

export function StarTooltip(props: {
  tech_key: string
  displayName: string
  weight: number  // converted to brightness descriptor in UI
  firstUnlockedAt: string | null
  anchorRef: React.RefObject<SVGGElement>
}): JSX.Element {
  // 200ms hover delay before show; immediate hide on mouseleave.
  // Position above the star; auto-flip at viewport edge.
  // Content: "{displayName} · brightest|bright|dim · since {first_lit month}"
  //   Brightness descriptor mapping by weight quintile across this user's lit stars
  //   (passed in or computed by parent — for tooltip simplicity, pass weight + a precomputed descriptor).
  // No tooltip on mobile (handled by parent: tap → drawer).
  return /* ... */ null as any
}
```

#### `SparkAnimation.tsx` — reusable spark choreography

Helper component or framer-motion `variants` object used by `Star.tsx`. Define:

```tsx
'use client'
import { type Variants } from 'framer-motion'

// Spark sequence: small dot (scale 0.2) → plus-shape flash (scale 1.5 for 100ms) → settle (scale 1).
export const SPARK_VARIANTS: Variants = {
  initial: { scale: 0.2, opacity: 0 },
  flash:   { scale: 1.5, opacity: 1, transition: { duration: 0.15, ease: 'easeOut' } },
  settle:  { scale: 1.0, opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
}

export function useReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
```

Use `useReducedMotion()` to skip the multi-step animation and snap directly to `settle`.

### 5. Update consumers

#### `app/(authenticated)/page.tsx`

Replace `LivingMap` import with `Constellation`. Adapt the data prop name from `data.landmarks` shape — should be identical (we kept the schema). Pass `viewport="desktop"` by default; the page can detect mobile via a media query for `viewport="mobile"` if doing so client-side. For MVP: `viewport="desktop"` is fine; mobile branch can come later via a window-size hook.

#### `app/[username]/page.tsx`

Same update — visitor view also uses `Constellation`. Phase 6 will add the variant logic (visitor / owner-self / logged-in visitor); this phase just gets it rendering.

#### `app/_components/LandingDemo.tsx`

If it exists and references `LivingMap`, replace with `Constellation`. The demo data shape is identical.

#### `lib/og/ProfileImage.tsx` and `lib/og/RecapImage.tsx`

These currently render a card grid. For now (Phase 9 redoes them), update only the import paths if they reference `LivingMap` or `Map/*`. Defer real redesign to Phase 9.

### 6. Delete `app/_components/Map/`

```bash
rm -rf app/_components/Map/
```

Verify no remaining imports of `@/app/_components/Map/`:

```bash
git grep -l "app/_components/Map/" -- ':!tasks/' ':!docs/' || true
```

Expected: empty result.

### 7. Update `features/territories/tech-catalog-public.ts`

Re-export the new shape with `displayName` (not `landmarkName`). If `Landmark.tsx` was the sole consumer of `getPublicTech().landmarkName`, the new `Star.tsx` reads `getPublicTech().displayName`.

```ts
import { TECH_CATALOG } from './tech-catalog'

export type PublicTechEntry = {
  tech_key: string
  displayName: string
  territory: string
}

const map = new Map<string, PublicTechEntry>(
  TECH_CATALOG.map((entry) => [
    entry.tech_key,
    { tech_key: entry.tech_key, displayName: entry.displayName, territory: entry.territory },
  ]),
)

export function getPublicTech(tech_key: string): PublicTechEntry | undefined {
  return map.get(tech_key)
}

export function getAllPublicTech(): PublicTechEntry[] {
  return [...map.values()]
}
```

**Note:** `tech-catalog.ts` imports `'server-only'` because it carries detection rules used in server-side sync. `tech-catalog-public.ts` strips that import and re-exports a public-safe shape so client components (like `Star.tsx`) can read display names. Keep this split.

### 8. Verify no `landmarkName` references remain

```bash
git grep -l "landmarkName" -- ':!tasks/' ':!docs/' || true
```

Expected: empty.

## Acceptance Criteria

```bash
# TypeScript builds cleanly
npm run build

# All unit tests pass (catalog refresh should not break classifier tests)
npx vitest run tests/unit

# Map/ directory is gone
test ! -d app/_components/Map

# Constellation/ directory exists with all files
test -f app/_components/Constellation/Constellation.tsx
test -f app/_components/Constellation/Cluster.tsx
test -f app/_components/Constellation/Star.tsx
test -f app/_components/Constellation/Connections.tsx
test -f app/_components/Constellation/ClusterAura.tsx
test -f app/_components/Constellation/StarTooltip.tsx
test -f app/_components/Constellation/SparkAnimation.tsx
test -f features/territories/star-positions.ts

# No remaining landmarkName field references
test -z "$(git grep -l 'landmarkName' -- ':!tasks/' ':!docs/' 2>/dev/null)"

# No remaining Map/ imports
test -z "$(git grep -l 'app/_components/Map/' -- ':!tasks/' ':!docs/' 2>/dev/null)"

# SPDX MIT headers present on extractable modules
grep -q "SPDX-License-Identifier: MIT" features/territories/tech-catalog.ts
grep -q "SPDX-License-Identifier: MIT" features/territories/registry.ts
grep -q "SPDX-License-Identifier: MIT" features/territories/star-positions.ts
grep -q "SPDX-License-Identifier: MIT" features/territories/rules.ts
grep -q "SPDX-License-Identifier: MIT" features/territories/scoring.ts
grep -q "SPDX-License-Identifier: MIT" features/territories/classifier.ts
grep -q "SPDX-License-Identifier: MIT" lib/og/version.ts
```

## How to verify AC

Run the AC commands above. If all pass, set the phase 3 status to `"completed"` in `/tasks/1-pivot-mvp/index.json`.
If you cannot make them pass after 3 attempts, set status to `"error"` and write the error in the phase's `"error_message"` field in index.json.

## Notes

- This phase is the largest in the task. Take it step by step: catalog → registry → star-positions → renderer → consumers → delete Map/.
- Do NOT introduce drawer changes here — Phase 4 handles `ClusterDrawer/` (the current `TerritoryDrawer/` keeps working with the new data shape because schema is unchanged).
- Do NOT redesign OG images here — Phase 9. Only fix broken imports if `Map/*` is referenced.
- The Constellation viewport defaults to `desktop`. Mobile branch via window-size detection is acceptable to defer to Phase 11 (a11y/responsive).
- Star size formula and glow opacity values are starting points — design tuning can adjust after launch. Don't get blocked on aesthetic perfection.
- Test impact: any test that imports `Map/Island.tsx` or asserts `landmarkName` will break. Update or delete the test in this phase. Classifier / scoring unit tests should be unaffected because the catalog rules are unchanged.
- Cluster center positions are static per viewport. Mobile/og hardcoded values may need refinement during design pass — acceptable for MVP.
- Do not introduce additional dependencies in this phase. `framer-motion` already exists; that is sufficient.
