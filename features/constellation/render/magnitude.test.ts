import { describe, it, expect } from 'vitest'
import { magnitudeFor, topQuintileThreshold } from './magnitude'

describe('magnitudeFor', () => {
  it('weight 5 (minimum lit) produces smallest coreRadius and no spikes', () => {
    const out = magnitudeFor(5, 1000)
    expect(out.coreRadius).toBeCloseTo(2, 0)
    expect(out.intensity).toBeCloseTo(1.0, 1)
    expect(out.showSpikes).toBe(false)
    expect(out.spikeLength).toBe(0)
  })

  it('weight 50 produces mid-range coreRadius and no spikes (below threshold)', () => {
    const out = magnitudeFor(50, 1000)
    expect(out.coreRadius).toBeGreaterThan(2)
    expect(out.coreRadius).toBeLessThan(6)
    expect(out.intensity).toBeGreaterThan(1.0)
    expect(out.showSpikes).toBe(false)
  })

  it('weight monotonically increases coreRadius and intensity', () => {
    const weights = [5, 20, 50, 200, 500]
    const threshold = 10000
    const outs = weights.map((w) => magnitudeFor(w, threshold))
    for (let i = 1; i < outs.length; i++) {
      expect(outs[i].coreRadius).toBeGreaterThanOrEqual(outs[i - 1].coreRadius)
      expect(outs[i].intensity).toBeGreaterThanOrEqual(outs[i - 1].intensity)
    }
  })

  it('top-quintile threshold triggers spikes', () => {
    const threshold = topQuintileThreshold([5, 10, 20, 50, 100])
    // 80th percentile of [5,10,20,50,100] sorted = [5,10,20,50,100], idx=4 → 100
    const aboveThreshold = magnitudeFor(100, threshold)
    const belowThreshold = magnitudeFor(20, threshold)
    expect(aboveThreshold.showSpikes).toBe(true)
    expect(aboveThreshold.spikeLength).toBeGreaterThan(0)
    expect(belowThreshold.showSpikes).toBe(false)
  })
})

describe('topQuintileThreshold', () => {
  it('returns Infinity for empty array', () => {
    expect(topQuintileThreshold([])).toBe(Infinity)
  })

  it('returns the 80th percentile for a sorted array', () => {
    // [10,20,30,40,50] → idx = floor(5*0.8) = 4 → value = 50
    expect(topQuintileThreshold([10, 20, 30, 40, 50])).toBe(50)
  })

  it('handles single-element array', () => {
    expect(topQuintileThreshold([42])).toBe(42)
  })
})
