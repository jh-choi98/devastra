import { describe, expect, it } from 'vitest'
import { backgroundStarProfileForCanvas } from './background-star-profile'

describe('backgroundStarProfileForCanvas', () => {
  it('keeps narrow canvases quieter than the desktop baseline', () => {
    const narrow = backgroundStarProfileForCanvas(390, 844, 'desktop')
    const baseline = backgroundStarProfileForCanvas(1440, 900, 'desktop')

    expect(narrow.fieldCount).toBeLessThan(baseline.fieldCount)
    expect(narrow.midCount).toBeLessThan(baseline.midCount)
    expect(narrow.midOpacity).toBeLessThan(baseline.midOpacity)
    expect(narrow.fieldSizeScale).toBeLessThan(baseline.fieldSizeScale)
    expect(narrow.fieldSpreadY).toBeGreaterThan(baseline.fieldSpreadY)
  })

  it('enlarges background stars by ten percent without changing density', () => {
    const baseline = backgroundStarProfileForCanvas(1440, 900, 'desktop')

    expect(baseline.fieldCount).toBe(2000)
    expect(baseline.midCount).toBe(420)
    expect(baseline.fieldSizeScale).toBeCloseTo(1.078, 3)
    expect(baseline.midSizeScale).toBeCloseTo(1.056, 3)
  })

  it('gives wide canvases more fill without making the sky overpowering', () => {
    const baseline = backgroundStarProfileForCanvas(1440, 900, 'desktop')
    const wide = backgroundStarProfileForCanvas(2048, 1152, 'desktop')

    expect(wide.fieldCount).toBeGreaterThan(baseline.fieldCount)
    expect(wide.midCount).toBeGreaterThan(baseline.midCount)
    expect(wide.fieldSizeScale).toBeGreaterThan(baseline.fieldSizeScale)
    expect(wide.fieldSizeScale).toBeLessThanOrEqual(1.21)
    expect(wide.midOpacity).toBeLessThanOrEqual(0.96)
  })
})
