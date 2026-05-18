import { describe, expect, it } from 'vitest'
import { sparseIntensityForLitStars, sparseProfileForLitStars } from './sparse-profile'

describe('sparseIntensityForLitStars', () => {
  it('does not boost an empty constellation', () => {
    expect(sparseIntensityForLitStars(0)).toBe(0)
  })

  it('decreases as the constellation fills in', () => {
    expect(sparseIntensityForLitStars(1)).toBeGreaterThan(sparseIntensityForLitStars(8))
    expect(sparseIntensityForLitStars(8)).toBeGreaterThan(sparseIntensityForLitStars(16))
  })

  it('turns off once enough tech stars are lit', () => {
    expect(sparseIntensityForLitStars(18)).toBe(0)
    expect(sparseIntensityForLitStars(40)).toBe(0)
  })
})

describe('sparseProfileForLitStars', () => {
  it('keeps the background mostly intact while boosting tech stars', () => {
    const profile = sparseProfileForLitStars(2)

    expect(profile.fieldStarOpacity).toBeGreaterThanOrEqual(0.9)
    expect(profile.midStarOpacity).toBeGreaterThanOrEqual(0.88)
    expect(profile.techStarScale).toBeGreaterThan(1)
    expect(profile.techStarIntensity).toBeGreaterThan(1)
  })

  it('uses a smaller camera zoom on mobile', () => {
    expect(sparseProfileForLitStars(2, 'desktop').cameraZoom).toBeGreaterThan(
      sparseProfileForLitStars(2, 'mobile').cameraZoom,
    )
  })
})
