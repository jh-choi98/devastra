import { createNoise2D } from 'simplex-noise'

export type IslandShape = {
  pathD: string
  centerX: number
  centerY: number
  radius: number
}

export function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 0x85ebca77)
    h2 = Math.imul(h2 ^ ch, 0xc2b2ae3d)
  }
  h1 ^= Math.imul(h1 ^ (h2 >>> 15), 0x735a2d97)
  h2 ^= Math.imul(h2 ^ (h1 >>> 15), 0xcaf649a9)
  h1 ^= h2 >>> 16
  h2 ^= h1 >>> 16
  return ((2097152 * (h2 >>> 0)) + (h1 >>> 11)) >>> 0
}

export function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const POINT_COUNT = 64
const NOISE_SCALE = 1.5

export function generateIslandShape(opts: {
  seed: string
  stage: number
  baseRadius?: number
  jitter?: number
}): IslandShape {
  const { seed, stage, baseRadius = 80, jitter = 0.35 } = opts
  const actualRadius = baseRadius * (1 + 0.15 * (stage - 1))

  const hash = cyrb53(seed)
  const rng = mulberry32(hash)
  const noise = createNoise2D(rng)

  const points: [number, number][] = []
  for (let i = 0; i < POINT_COUNT; i++) {
    const angle = (i / POINT_COUNT) * Math.PI * 2
    const noiseVal = noise(Math.cos(angle) * NOISE_SCALE, Math.sin(angle) * NOISE_SCALE)
    const r = actualRadius * (1 + jitter * noiseVal)
    points.push([r * Math.cos(angle), r * Math.sin(angle)])
  }

  const [x0, y0] = points[0]
  const pathD =
    `M ${x0.toFixed(2)} ${y0.toFixed(2)} ` +
    points
      .slice(1)
      .map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(' ') +
    ' Z'

  return { pathD, centerX: 0, centerY: 0, radius: actualRadius }
}
