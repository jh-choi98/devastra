import 'server-only'
import { TERRITORIES } from '@/features/territories/registry'
import { getPublicTech } from '@/features/territories/tech-catalog-public'
import type { HighlightsPayload } from './slot-builder'

export function buildSubjectLine(h: HighlightsPayload): string {
  if (h.kind === 'empty') return 'Your sky — this week'
  if (h.kind === 'first_week') return 'Your first week on DevAstra'

  // Active week: priority stage-up > new star > brightest cluster
  if (h.slot_1?.kind === 'stage_up') {
    return `${TERRITORIES[h.slot_1.cluster_type].name} cluster expanded`
  }
  if (h.slot_2?.kind === 'new_stars') {
    const tks = h.slot_2.tech_keys
    if (tks.length === 1) {
      const name = getPublicTech(tks[0])?.displayName ?? tks[0]
      return `${name} is new this week`
    }
    return `${tks.length} new stars this week`
  }
  if (h.slot_1?.kind === 'brightest_cluster') {
    return `${TERRITORIES[h.slot_1.cluster_type].name} brightened`
  }

  return 'Your sky — this week'
}
