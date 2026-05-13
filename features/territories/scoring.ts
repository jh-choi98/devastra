import 'server-only'
import { STAGE_THRESHOLDS, MAX_STAGE } from './rules'

export function computeGrowth30d(
  activities: { occurredAt: Date; weight: number }[],
): number {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  return activities
    .filter((a) => a.occurredAt > cutoff)
    .reduce((sum, a) => sum + a.weight, 0)
}

export function nextStageDelta(
  currentStage: number,
  totalWeight: number,
): { nextStage: number | null; weightUntilNext: number } {
  if (currentStage >= MAX_STAGE) return { nextStage: null, weightUntilNext: 0 }
  const nextStage = currentStage + 1
  // STAGE_THRESHOLDS is 0-indexed; stage N starts at STAGE_THRESHOLDS[N-1].
  // The threshold for nextStage is STAGE_THRESHOLDS[nextStage - 1] = STAGE_THRESHOLDS[currentStage].
  const nextThreshold = STAGE_THRESHOLDS[currentStage]
  const weightUntilNext = Math.max(0, nextThreshold - totalWeight)
  return { nextStage, weightUntilNext }
}
