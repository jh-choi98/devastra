// SPDX-License-Identifier: MIT
import 'server-only'
import { TECH_CATALOG } from './tech-catalog'
import type { TerritoryType } from './registry'

export type StarPosition = { x: number; y: number; tech_key: string; territory: TerritoryType }

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
