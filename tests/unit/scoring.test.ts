import { describe, it, expect } from 'vitest'
import { computeStage, STAGE_THRESHOLDS, MAX_STAGE } from '../../features/territories/rules'
import { computeGrowth30d, nextStageDelta } from '../../features/territories/scoring'

// ---------------------------------------------------------------------------
// computeStage
// ---------------------------------------------------------------------------
describe('computeStage', () => {
  it('returns 1 at weight 0', () => expect(computeStage(0)).toBe(1))
  it('returns 1 at weight 49', () => expect(computeStage(49)).toBe(1))
  it('returns 2 at weight 50', () => expect(computeStage(50)).toBe(2))
  it('returns 2 at weight 199', () => expect(computeStage(199)).toBe(2))
  it('returns 3 at weight 200', () => expect(computeStage(200)).toBe(3))
  it('returns 3 at weight 499', () => expect(computeStage(499)).toBe(3))
  it('returns 4 at weight 500', () => expect(computeStage(500)).toBe(4))
  it('returns 4 at weight 1499', () => expect(computeStage(1499)).toBe(4))
  it('returns 5 at weight 1500', () => expect(computeStage(1500)).toBe(5))
  it('returns 5 at weight 99999', () => expect(computeStage(99999)).toBe(5))

  it('stage thresholds match STAGE_THRESHOLDS constant', () => {
    // Stage N starts at STAGE_THRESHOLDS[N-1]
    for (let i = 0; i < STAGE_THRESHOLDS.length; i++) {
      const threshold = STAGE_THRESHOLDS[i]
      expect(computeStage(threshold)).toBe(i + 1)
    }
  })

  it('MAX_STAGE equals 5', () => {
    expect(MAX_STAGE).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// computeGrowth30d
// ---------------------------------------------------------------------------
describe('computeGrowth30d', () => {
  function daysAgo(n: number): Date {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
  }

  it('returns 0 for empty array', () => {
    expect(computeGrowth30d([])).toBe(0)
  })

  it('includes activities within 30 days', () => {
    const activities = [
      { occurredAt: daysAgo(1), weight: 5 },
      { occurredAt: daysAgo(15), weight: 3 },
      { occurredAt: daysAgo(29), weight: 2 },
    ]
    expect(computeGrowth30d(activities)).toBe(10)
  })

  it('excludes activities older than 30 days', () => {
    const activities = [
      { occurredAt: daysAgo(10), weight: 8 },
      { occurredAt: daysAgo(31), weight: 100 },
    ]
    expect(computeGrowth30d(activities)).toBe(8)
  })

  it('excludes activity exactly at the 30-day boundary (strict >)', () => {
    // Exactly 30 days ago is NOT included (occurredAt > cutoff, not >=)
    const activities = [
      { occurredAt: daysAgo(30), weight: 50 },
      { occurredAt: daysAgo(29), weight: 10 },
    ]
    const result = computeGrowth30d(activities)
    expect(result).toBe(10)
  })

  it('sums weights from multiple recent activities', () => {
    const activities = Array.from({ length: 5 }, (_, i) => ({
      occurredAt: daysAgo(i + 1),
      weight: 2,
    }))
    expect(computeGrowth30d(activities)).toBe(10)
  })

  it('returns 0 when all activities are older than 30 days', () => {
    const activities = [
      { occurredAt: daysAgo(35), weight: 100 },
      { occurredAt: daysAgo(60), weight: 200 },
    ]
    expect(computeGrowth30d(activities)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// nextStageDelta
// ---------------------------------------------------------------------------
describe('nextStageDelta', () => {
  it('stage 1 → stage 2, threshold 50', () => {
    const result = nextStageDelta(1, 0)
    expect(result).toEqual({ nextStage: 2, weightUntilNext: 50 })
  })

  it('stage 1 with weight 30 → 20 until next', () => {
    const result = nextStageDelta(1, 30)
    expect(result).toEqual({ nextStage: 2, weightUntilNext: 20 })
  })

  it('stage 1 with weight 49 → 1 until next', () => {
    const result = nextStageDelta(1, 49)
    expect(result).toEqual({ nextStage: 2, weightUntilNext: 1 })
  })

  it('stage 2 → stage 3, threshold 200', () => {
    const result = nextStageDelta(2, 50)
    expect(result).toEqual({ nextStage: 3, weightUntilNext: 150 })
  })

  it('stage 3 → stage 4, threshold 500', () => {
    const result = nextStageDelta(3, 200)
    expect(result).toEqual({ nextStage: 4, weightUntilNext: 300 })
  })

  it('stage 4 → stage 5, threshold 1500', () => {
    const result = nextStageDelta(4, 500)
    expect(result).toEqual({ nextStage: 5, weightUntilNext: 1000 })
  })

  it('stage 5 (max) → null, weightUntilNext 0', () => {
    const result = nextStageDelta(5, 2000)
    expect(result).toEqual({ nextStage: null, weightUntilNext: 0 })
  })

  it('weightUntilNext is 0 when already past next threshold', () => {
    // Stage 1 but weight is already 100 (past stage 2 threshold of 50)
    // computeStage would return 3, but nextStageDelta takes currentStage as given
    const result = nextStageDelta(1, 100)
    expect(result.weightUntilNext).toBe(0)
  })
})
