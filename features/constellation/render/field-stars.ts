// SPDX-License-Identifier: MIT
import type { FieldStar, Viewport, SpectralColor } from './types'

const COUNTS: Record<Viewport, number> = {
  desktop: 2000,
  mobile:  1000,
  og:      1500,
}

// cyrb53 hash for seeding
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

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Milky Way band: soft diagonal from top-right to bottom-left.
// Band fraction of viewBox area ≈ 0.31; 43% of stars placed inside → ~1.7x density.
const BAND_ALONG_X = 900
const BAND_ALONG_Y = -600
const BAND_ALONG_LEN = Math.sqrt(BAND_ALONG_X ** 2 + BAND_ALONG_Y ** 2)
const BAND_DIR_X = BAND_ALONG_X / BAND_ALONG_LEN
const BAND_DIR_Y = BAND_ALONG_Y / BAND_ALONG_LEN
const BAND_PERP_X = -BAND_DIR_Y
const BAND_PERP_Y = BAND_DIR_X
const BAND_CENTER_X = 500
const BAND_CENTER_Y = 350
const BAND_HALF_LEN = BAND_ALONG_LEN / 2 + 100
const BAND_HALF_WIDTH = 100
const BAND_FRACTION = 0.43

function bandPosition(t: number, h: number): { x: number; y: number } {
  const along = (t - 0.5) * 2 * BAND_HALF_LEN
  return {
    x: BAND_CENTER_X + along * BAND_DIR_X + h * BAND_PERP_X,
    y: BAND_CENTER_Y + along * BAND_DIR_Y + h * BAND_PERP_Y,
  }
}

function pickColor(v: number): SpectralColor {
  // 70% white, 20% blue-white, 7% yellow-white, 3% orange-red (split evenly 2%/1%)
  const bucket = Math.floor(v * 100)
  if (bucket < 70) return 'white'
  if (bucket < 90) return 'blue-white'
  if (bucket < 97) return 'yellow-white'
  if (bucket < 99) return 'orange'
  return 'red'
}

function pickSize(v: number): 1 | 2 | 3 {
  if (v < 0.80) return 1
  if (v < 0.95) return 2
  return 3
}

/**
 * Deterministic seeded generation of background field stars.
 * Seed: "devastra:field-stars:v1"
 *
 * Distribution targets:
 *   count:   2000 desktop / 1000 mobile / 1500 og
 *   palette: 70% white / 20% blue-white / 7% yellow-white / 3% orange-red
 *   size:    80% 1px / 15% 2px / 5% 3px
 *   density: ~1.7x denser inside the Milky Way mask region
 */
export function generateFieldStars(viewport: Viewport): FieldStar[] {
  const count = COUNTS[viewport]
  const seed = cyrb53(`devastra:field-stars:v1:${viewport}`)
  const rng = mulberry32(seed >>> 0)

  const stars: FieldStar[] = []

  for (let i = 0; i < count; i++) {
    const inBand = rng() < BAND_FRACTION
    let x: number
    let y: number

    if (inBand) {
      const t = rng()
      const h = (rng() - 0.5) * 2 * BAND_HALF_WIDTH
      const pos = bandPosition(t, h)
      // Clamp to viewBox
      x = Math.min(999, Math.max(1, pos.x))
      y = Math.min(699, Math.max(1, pos.y))
    } else {
      x = rng() * 1000
      y = rng() * 700
    }

    const color = pickColor(rng())
    const size = pickSize(rng()) as 1 | 2 | 3
    const twinklePhase = rng()

    stars.push({ pos: { x, y }, size, color, twinklePhase })
  }

  return stars
}
