import 'server-only'
import { TERRITORIES, type TerritoryType } from '@/features/territories/registry'
import { getPublicTech } from '@/features/territories/tech-catalog-public'

export type RecapAggregations = {
  weekStart: Date
  stageUps: Array<{ territory: TerritoryType; from_stage: number; to_stage: number }>
  newStars: Array<{ tech_key: string; territory: TerritoryType }>
  brightenedStars: Array<{ tech_key: string; territory: TerritoryType }>
  brightestCluster: { territory: TerritoryType; growthPct: number } | null
  activity: { active_days: number; commits: number; prs_shipped: number }
}

export type HighlightsPayload = {
  kind: 'active' | 'empty' | 'first_week'
  slot_1?:
    | { kind: 'stage_up'; cluster_type: TerritoryType; from_stage: number; to_stage: number }
    | { kind: 'brightest_cluster'; cluster_type: TerritoryType; growth_pct: number }
  slot_2?:
    | { kind: 'new_stars'; tech_keys: string[] }
    | { kind: 'brightened_stars'; tech_keys: string[] }
  slot_3?: { kind: 'activity'; active_days: number; commits: number; prs_shipped: number }
  subject_pick: string
  preview_text: string
}

export function buildHighlights(opts: {
  aggregations: RecapAggregations
  isFirstWeek: boolean
  isEmptyWeek: boolean
}): HighlightsPayload {
  const { aggregations: a, isFirstWeek, isEmptyWeek } = opts

  if (isEmptyWeek) {
    return {
      kind: 'empty',
      subject_pick: 'empty',
      preview_text: 'Steady week — your constellation is the same.',
    }
  }

  const kind = isFirstWeek ? 'first_week' : 'active'

  // Slot 1: stage-up > brightest cluster
  let slot_1: HighlightsPayload['slot_1']
  let subject_pick = ''
  if (a.stageUps.length > 0) {
    const s = a.stageUps[0]
    slot_1 = { kind: 'stage_up', cluster_type: s.territory, from_stage: s.from_stage, to_stage: s.to_stage }
    subject_pick = `stage_up_${s.territory}`
  } else if (a.brightestCluster) {
    slot_1 = {
      kind: 'brightest_cluster',
      cluster_type: a.brightestCluster.territory,
      growth_pct: Math.round(a.brightestCluster.growthPct),
    }
    subject_pick = `brightest_${a.brightestCluster.territory}`
  }

  // Slot 2: new stars > brightened
  let slot_2: HighlightsPayload['slot_2']
  if (a.newStars.length > 0) {
    slot_2 = { kind: 'new_stars', tech_keys: a.newStars.map((s) => s.tech_key) }
    if (!subject_pick) subject_pick = `new_stars_${a.newStars.length}`
  } else if (a.brightenedStars.length > 0) {
    slot_2 = { kind: 'brightened_stars', tech_keys: a.brightenedStars.map((s) => s.tech_key) }
  }

  // Slot 3: activity
  let slot_3: HighlightsPayload['slot_3']
  if (a.activity.commits + a.activity.prs_shipped > 0) {
    slot_3 = {
      kind: 'activity',
      active_days: a.activity.active_days,
      commits: a.activity.commits,
      prs_shipped: a.activity.prs_shipped,
    }
  }

  // Preview text: constellation change first, activity counts last
  const previewParts: string[] = []
  if (slot_1) {
    if (slot_1.kind === 'stage_up') {
      previewParts.push(`${TERRITORIES[slot_1.cluster_type].name} expanded`)
    } else {
      previewParts.push(`${TERRITORIES[slot_1.cluster_type].name} brightened`)
    }
  }
  if (slot_2 && slot_2.kind === 'new_stars') {
    previewParts.push(`${slot_2.tech_keys.length} new star${slot_2.tech_keys.length === 1 ? '' : 's'}`)
  } else if (slot_2 && slot_2.kind === 'brightened_stars') {
    previewParts.push(`${slot_2.tech_keys.length} brightened`)
  }
  if (slot_3) {
    previewParts.push(`${slot_3.commits} commits`)
  }

  return {
    kind,
    slot_1,
    slot_2,
    slot_3,
    subject_pick: subject_pick || 'active_default',
    preview_text: previewParts.join(' · '),
  }
}
