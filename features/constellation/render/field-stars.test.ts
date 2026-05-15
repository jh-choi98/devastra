import { describe, it, expect } from 'vitest'
import { generateFieldStars } from './field-stars'

describe('generateFieldStars', () => {
  it('returns the correct count per viewport', () => {
    expect(generateFieldStars('desktop').length).toBe(2000)
    expect(generateFieldStars('mobile').length).toBe(1000)
    expect(generateFieldStars('og').length).toBe(1500)
  })

  it('color distribution is close to 70/20/7/3 targets', () => {
    const stars = generateFieldStars('desktop')
    const counts: Record<string, number> = {
      'white': 0, 'blue-white': 0, 'yellow-white': 0, 'orange': 0, 'red': 0,
    }
    for (const s of stars) counts[s.color]++
    const n = stars.length
    // Allow ±10% deviation from target
    expect(counts['white'] / n).toBeGreaterThan(0.60)
    expect(counts['white'] / n).toBeLessThan(0.80)
    expect(counts['blue-white'] / n).toBeGreaterThan(0.10)
    expect(counts['blue-white'] / n).toBeLessThan(0.30)
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
})
