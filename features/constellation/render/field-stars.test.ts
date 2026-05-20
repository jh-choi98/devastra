import { describe, it, expect } from 'vitest'
import { generateFieldStarPool, generateFieldStars } from './field-stars'

describe('generateFieldStars', () => {
  it('returns the correct count per viewport', () => {
    expect(generateFieldStars('desktop').length).toBe(2000)
    expect(generateFieldStars('mobile').length).toBe(1000)
    expect(generateFieldStars('og').length).toBe(1500)
  })

  it('color distribution is close to 70/20/7/3 targets', () => {
    const stars = generateFieldStars('desktop')
    const counts: Record<string, number> = {
      white: 0,
      'blue-white': 0,
      'yellow-white': 0,
      orange: 0,
      red: 0,
    }
    for (const s of stars) counts[s.color]++
    const n = stars.length
    // Allow ±10% deviation from target
    expect(counts['white'] / n).toBeGreaterThan(0.6)
    expect(counts['white'] / n).toBeLessThan(0.8)
    expect(counts['blue-white'] / n).toBeGreaterThan(0.1)
    expect(counts['blue-white'] / n).toBeLessThan(0.3)
    // All stars accounted for
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    expect(total).toBe(n)
  })

  it('is deterministic — same viewport yields identical stars', () => {
    const a = generateFieldStars('desktop')
    const b = generateFieldStars('desktop')
    expect(a.length).toBe(b.length)
    for (let i = 0; i < a.length; i++) {
      expect(a[i].pos.x).toBeCloseTo(b[i].pos.x, 6)
      expect(a[i].pos.y).toBeCloseTo(b[i].pos.y, 6)
      expect(a[i].color).toBe(b[i].color)
      expect(a[i].size).toBe(b[i].size)
      expect(a[i].twinklePhase).toBeCloseTo(b[i].twinklePhase, 6)
    }
  })

  it('pool preserves the fixed baseline prefix for adaptive draw ranges', () => {
    const baseline = generateFieldStars('desktop')
    const pool = generateFieldStarPool('desktop')

    expect(pool.length).toBeGreaterThan(baseline.length)
    for (let i = 0; i < baseline.length; i++) {
      expect(pool[i].pos.x).toBeCloseTo(baseline[i].pos.x, 6)
      expect(pool[i].pos.y).toBeCloseTo(baseline[i].pos.y, 6)
      expect(pool[i].color).toBe(baseline[i].color)
      expect(pool[i].size).toBe(baseline[i].size)
      expect(pool[i].twinklePhase).toBeCloseTo(baseline[i].twinklePhase, 6)
    }
  })
})
