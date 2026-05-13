import { describe, it, expect } from 'vitest'
import { generateIslandShape } from '@/app/_components/Map/island-shape'

function parseBoundingBox(pathD: string): { minX: number; maxX: number; minY: number; maxY: number } {
  const numbers = pathD.match(/-?\d+(?:\.\d+)?/g) ?? []
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < numbers.length - 1; i += 2) {
    xs.push(parseFloat(numbers[i]))
    ys.push(parseFloat(numbers[i + 1]))
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

describe('generateIslandShape', () => {
  it('is deterministic — same seed + stage always returns identical pathD', () => {
    const a = generateIslandShape({ seed: 'user1:frontend_land', stage: 3 })
    const b = generateIslandShape({ seed: 'user1:frontend_land', stage: 3 })
    expect(a.pathD).toBe(b.pathD)
  })

  it('different seeds produce different paths', () => {
    const a = generateIslandShape({ seed: 'user1:frontend_land', stage: 3 })
    const b = generateIslandShape({ seed: 'user2:frontend_land', stage: 3 })
    expect(a.pathD).not.toBe(b.pathD)
  })

  it('stage 5 has a wider bounding box than stage 1', () => {
    const s1 = generateIslandShape({ seed: 'user1:frontend_land', stage: 1 })
    const s5 = generateIslandShape({ seed: 'user1:frontend_land', stage: 5 })
    const bb1 = parseBoundingBox(s1.pathD)
    const bb5 = parseBoundingBox(s5.pathD)
    const width1 = bb1.maxX - bb1.minX
    const width5 = bb5.maxX - bb5.minX
    expect(width5).toBeGreaterThan(width1)
  })

  it('returns a closed SVG path ending with Z', () => {
    const shape = generateIslandShape({ seed: 'test:backend_fortress', stage: 2 })
    expect(shape.pathD.trim().endsWith('Z')).toBe(true)
  })

  it('centerX and centerY are 0', () => {
    const shape = generateIslandShape({ seed: 'test:testing_lab', stage: 1 })
    expect(shape.centerX).toBe(0)
    expect(shape.centerY).toBe(0)
  })
})
