import 'server-only'

export const STAGE_THRESHOLDS = [0, 50, 200, 500, 1500] as const

export const MAX_STAGE = STAGE_THRESHOLDS.length // 5

export const SCORE_WEIGHTS = {
  commit: 1,
  pr: 5,
  issue: 2,
} as const

export const LANDMARK_UNLOCK_THRESHOLD = 5

export function computeStage(totalWeight: number): number {
  let stage = 1
  for (let i = 0; i < STAGE_THRESHOLDS.length; i++) {
    if (totalWeight >= STAGE_THRESHOLDS[i]) stage = i + 1
  }
  return stage
}
