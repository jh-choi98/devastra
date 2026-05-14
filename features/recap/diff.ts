import 'server-only'

import { TERRITORIES } from '@/features/territories/registry'
import type { RecapHighlights } from './generate'

export function summarizeForEmail(
  highlights: RecapHighlights,
  hasActivity: boolean,
): { lines: string[] } {
  if (!hasActivity) {
    return { lines: ['Steady week.', 'See you next Sunday.'] }
  }

  const lines: string[] = []

  if (highlights.topGrowth) {
    const name = TERRITORIES[highlights.topGrowth.territory]?.name ?? highlights.topGrowth.territory
    lines.push(`${name} grew ${highlights.topGrowth.pct}% this week`)
  }

  if (highlights.newLandmarks.length > 0) {
    const first = highlights.newLandmarks[0]
    lines.push(`New landmark: ${first.displayName}`)
  }

  const { activeDays, prsShipped } = highlights.stats
  const parts: string[] = []
  if (activeDays > 0) parts.push(`${activeDays} active day${activeDays !== 1 ? 's' : ''}`)
  if (prsShipped > 0) parts.push(`${prsShipped} PR${prsShipped !== 1 ? 's' : ''} shipped`)
  if (parts.length > 0) lines.push(parts.join(' · '))

  return { lines: lines.slice(0, 3) }
}
