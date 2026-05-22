import { describe, it, expect } from 'vitest'
import {
  BRIGHTNESS_SCALE_STOPS,
  brightnessDescriptor,
  countLitStars,
  isLitStar,
  magnitudeFor,
  topQuintileThreshold,
} from './magnitude'

describe('magnitudeFor', () => {
  it('weight 5 (minimum lit) produces a small point-like core and no spikes', () => {
    const out = magnitudeFor(5, 1000)
    expect(out.coreRadius).toBeCloseTo(0.64, 2)
    expect(out.intensity).toBeCloseTo(0.38, 2)
    expect(out.showSpikes).toBe(false)
    expect(out.spikeLength).toBe(0)
  })

  it('weight 50 produces a brighter but still point-like core and no spikes (below threshold)', () => {
    const out = magnitudeFor(50, 1000)
    expect(out.coreRadius).toBeGreaterThan(1.4)
    expect(out.coreRadius).toBeLessThan(2.2)
    expect(out.intensity).toBeGreaterThan(1.1)
    expect(out.showSpikes).toBe(false)
  })

  it('weight 500 produces a visibly brighter grade when it qualifies for spikes', () => {
    const out = magnitudeFor(500, 100)
    expect(out.coreRadius).toBeGreaterThan(3.2)
    expect(out.intensity).toBeGreaterThan(1.9)
    expect(out.showSpikes).toBe(true)
    expect(out.spikeLength).toBeGreaterThan(19)
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

  it('does not draw steady-state spikes below the bright tier', () => {
    const out = magnitudeFor(30, 5)
    expect(out.showSpikes).toBe(false)
    expect(out.spikeLength).toBe(0)
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

describe('brightnessDescriptor', () => {
  it('uses the shared five-step brightness scale', () => {
    expect(brightnessDescriptor(5)).toBe('faint')
    expect(brightnessDescriptor(10)).toBe('emerging')
    expect(brightnessDescriptor(30)).toBe('steady')
    expect(brightnessDescriptor(80)).toBe('bright')
    expect(brightnessDescriptor(200)).toBe('radiant')
  })

  it('keeps scale stops ordered from radiant to newly lit', () => {
    expect(BRIGHTNESS_SCALE_STOPS.map((stop) => stop.minWeight)).toEqual([200, 80, 30, 10, 5])
  })
})

describe('lit star helpers', () => {
  it('counts only unlocked stars at the renderable brightness floor', () => {
    const landmarks = [
      { weight: 80, firstUnlockedAt: '2026-05-01T00:00:00Z' },
      { weight: 5, firstUnlockedAt: '2026-05-02T00:00:00Z' },
      { weight: 12, firstUnlockedAt: null },
      { weight: 4, firstUnlockedAt: '2026-05-03T00:00:00Z' },
    ]

    expect(countLitStars(landmarks)).toBe(2)
    expect(landmarks.map(isLitStar)).toEqual([true, true, false, false])
  })
})
