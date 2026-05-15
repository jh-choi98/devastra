// SPDX-License-Identifier: MIT
// Client-safe star position lookup — no server-only imports.
// Mirrors the hash logic in features/territories/star-positions.ts.
import type { TerritoryType } from '@/features/territories/registry'
import { anchorFor } from '@/features/constellation/render/anchors'
import type { Viewport } from '@/features/constellation/render/types'

type StarPositionEntry = { tech_key: string; territory: TerritoryType; x: number; y: number }

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function cyrb53(str: string): number {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57
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

// Static inline catalog entries (tech_key + territory + optional hand-tuned x/y).
// Kept in sync with features/territories/tech-catalog.ts — no server-only import.
const CATALOG_POSITIONS: Array<{ tech_key: string; territory: TerritoryType; x?: number; y?: number }> = [
  // Frontend
  { tech_key: 'typescript', territory: 'frontend_land' },
  { tech_key: 'javascript', territory: 'frontend_land' },
  { tech_key: 'react', territory: 'frontend_land' },
  { tech_key: 'nextjs', territory: 'frontend_land' },
  { tech_key: 'vue', territory: 'frontend_land' },
  { tech_key: 'svelte', territory: 'frontend_land' },
  { tech_key: 'angular', territory: 'frontend_land' },
  { tech_key: 'tailwind', territory: 'frontend_land' },
  { tech_key: 'css', territory: 'frontend_land' },
  { tech_key: 'sass', territory: 'frontend_land' },
  { tech_key: 'vite', territory: 'frontend_land' },
  { tech_key: 'webpack', territory: 'frontend_land' },
  // Backend
  { tech_key: 'nodejs', territory: 'backend_fortress' },
  { tech_key: 'express', territory: 'backend_fortress' },
  { tech_key: 'fastify', territory: 'backend_fortress' },
  { tech_key: 'nestjs', territory: 'backend_fortress' },
  { tech_key: 'go', territory: 'backend_fortress' },
  { tech_key: 'gin', territory: 'backend_fortress' },
  { tech_key: 'python', territory: 'backend_fortress' },
  { tech_key: 'fastapi', territory: 'backend_fortress' },
  { tech_key: 'django', territory: 'backend_fortress' },
  { tech_key: 'flask', territory: 'backend_fortress' },
  { tech_key: 'rust', territory: 'backend_fortress' },
  { tech_key: 'java', territory: 'backend_fortress' },
  // Data
  { tech_key: 'postgres', territory: 'data_pipeline_zone' },
  { tech_key: 'mysql', territory: 'data_pipeline_zone' },
  { tech_key: 'sqlite', territory: 'data_pipeline_zone' },
  { tech_key: 'mongodb', territory: 'data_pipeline_zone' },
  { tech_key: 'redis', territory: 'data_pipeline_zone' },
  { tech_key: 'sql', territory: 'data_pipeline_zone' },
  { tech_key: 'dbt', territory: 'data_pipeline_zone' },
  { tech_key: 'prisma', territory: 'data_pipeline_zone' },
  // Testing
  { tech_key: 'jest', territory: 'testing_lab' },
  { tech_key: 'vitest', territory: 'testing_lab' },
  { tech_key: 'pytest', territory: 'testing_lab' },
  { tech_key: 'playwright', territory: 'testing_lab' },
  { tech_key: 'cypress', territory: 'testing_lab' },
  { tech_key: 'rspec', territory: 'testing_lab' },
  // DevOps
  { tech_key: 'docker', territory: 'devops_harbor' },
  { tech_key: 'ghactions', territory: 'devops_harbor' },
  { tech_key: 'terraform', territory: 'devops_harbor' },
  { tech_key: 'kubernetes', territory: 'devops_harbor' },
  { tech_key: 'aws', territory: 'devops_harbor' },
  { tech_key: 'vercel', territory: 'devops_harbor' },
  { tech_key: 'nginx', territory: 'devops_harbor' },
  // Docs
  { tech_key: 'markdown', territory: 'docs_library' },
  { tech_key: 'mdx', territory: 'docs_library' },
  { tech_key: 'jsdoc', territory: 'docs_library' },
  { tech_key: 'storybook', territory: 'docs_library' },
  { tech_key: 'openapi', territory: 'docs_library' },
]

let cached: StarPositionEntry[] | null = null

export function getClientStarPositions(): StarPositionEntry[] {
  if (cached) return cached
  cached = CATALOG_POSITIONS.map((entry) => {
    const fb = fallbackPosition(entry.tech_key)
    return {
      tech_key: entry.tech_key,
      territory: entry.territory,
      x: entry.x ?? fb.x,
      y: entry.y ?? fb.y,
    }
  })
  return cached
}

export function getClientStarPosition(tech_key: string): StarPositionEntry | undefined {
  return getClientStarPositions().find((p) => p.tech_key === tech_key)
}

function jitter(tech_key: string): { dx: number; dy: number } {
  let h = 2166136261 >>> 0
  for (let i = 0; i < tech_key.length; i++) {
    h ^= tech_key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const a = ((h >>> 0) % 1000) / 1000
  const b = ((h >>> 10) % 1000) / 1000
  return { dx: (a - 0.5) * 28, dy: (b - 0.5) * 28 }
}

/** Returns a viewBox-space {x, y} position for a tech star (1000x700 canvas). */
export function resolveStarViewBoxPosition(
  tech_key: string,
  territory: TerritoryType,
  viewport: Viewport,
): { x: number; y: number } {
  const pos = getClientStarPosition(tech_key)
  const anchor = anchorFor(viewport, territory)
  const j = jitter(tech_key)
  const nx = pos?.x ?? 0.5
  const ny = pos?.y ?? 0.5
  return {
    x: anchor.x + (nx - 0.5) * anchor.spread * 2 + j.dx,
    y: anchor.y + (ny - 0.5) * anchor.spread * 2 + j.dy,
  }
}
