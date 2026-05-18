import { describe, it, expect } from 'vitest'
import { buildHighlights } from '@/features/recap/slot-builder'

describe('buildHighlights', () => {
  it('returns empty kind when isEmptyWeek', () => {
    const result = buildHighlights({
      aggregations: { weekStart: new Date(), stageUps: [], newStars: [], brightenedStars: [], brightestCluster: null, activity: { active_days: 0, commits: 0, prs_shipped: 0 } },
      isFirstWeek: false,
      isEmptyWeek: true,
    })
    expect(result.kind).toBe('empty')
    expect(result.subject_pick).toBe('empty')
  })

  it('prioritizes stage_up in slot 1', () => {
    const result = buildHighlights({
      aggregations: {
        weekStart: new Date(),
        stageUps: [{ territory: 'backend_fortress', from_stage: 1, to_stage: 2 }],
        newStars: [{ tech_key: 'docker', territory: 'devops_harbor' }],
        brightenedStars: [],
        brightestCluster: { territory: 'frontend_land', growthPct: 12 },
        activity: { active_days: 4, commits: 10, prs_shipped: 2 },
      },
      isFirstWeek: false,
      isEmptyWeek: false,
    })
    expect(result.slot_1?.kind).toBe('stage_up')
    if (result.slot_1?.kind === 'stage_up') expect(result.slot_1.cluster_type).toBe('backend_fortress')
    expect(result.subject_pick).toBe('stage_up_backend_fortress')
  })

  it('falls back to brightest_cluster if no stage_up', () => {
    const result = buildHighlights({
      aggregations: {
        weekStart: new Date(),
        stageUps: [],
        newStars: [],
        brightenedStars: [],
        brightestCluster: { territory: 'frontend_land', growthPct: 18 },
        activity: { active_days: 3, commits: 7, prs_shipped: 1 },
      },
      isFirstWeek: false,
      isEmptyWeek: false,
    })
    expect(result.slot_1?.kind).toBe('brightest_cluster')
  })
})
