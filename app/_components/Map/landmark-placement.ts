import { cyrb53, mulberry32 } from './island-shape'

export function placeLandmarks(opts: {
  islandSeed: string
  islandRadius: number
  landmarks: { tech_key: string; weight: number }[]
}): { tech_key: string; x: number; y: number; size: number }[] {
  const { islandSeed, islandRadius, landmarks } = opts
  const rng = mulberry32(cyrb53(islandSeed + ':landmarks'))

  return landmarks.map(({ tech_key, weight }) => {
    const r = islandRadius * 0.55 * Math.sqrt(rng())
    const angle = rng() * Math.PI * 2
    const x = r * Math.cos(angle)
    const y = r * Math.sin(angle)
    const size = Math.min(24, 8 + Math.log(Math.max(1, weight)) * 4)
    return { tech_key, x, y, size }
  })
}
