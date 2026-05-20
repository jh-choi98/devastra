import { describe, expect, it } from 'vitest'
import { semanticScaleProfileForCanvas } from './semantic-scale-profile'

describe('semanticScaleProfileForCanvas', () => {
  it('keeps the wide desktop constellation at full semantic scale', () => {
    const profile = semanticScaleProfileForCanvas(1440, 900, 'desktop')

    expect(profile.techCoreScale).toBe(1)
    expect(profile.techSpikeScale).toBe(1)
    expect(profile.techLabelScale).toBe(1)
    expect(profile.techLabelDistanceScale).toBe(1)
  })

  it('reduces mobile tech stars, spikes, and labels together', () => {
    const profile = semanticScaleProfileForCanvas(390, 844, 'mobile')

    expect(profile.techCoreScale).toBeGreaterThanOrEqual(0.74)
    expect(profile.techCoreScale).toBeLessThan(0.82)
    expect(profile.techSpikeScale).toBeLessThan(profile.techCoreScale)
    expect(profile.techLabelScale).toBeLessThan(0.85)
    expect(profile.techLabelDistanceScale).toBeGreaterThanOrEqual(0.88)
    expect(profile.techIntensityScale).toBeGreaterThan(0.94)
  })

  it('only gently compresses compact desktop canvases', () => {
    const profile = semanticScaleProfileForCanvas(800, 720, 'desktop')

    expect(profile.techCoreScale).toBeGreaterThan(0.93)
    expect(profile.techLabelScale).toBeGreaterThan(0.93)
    expect(profile.techSpikeScale).toBeGreaterThan(0.9)
  })
})
