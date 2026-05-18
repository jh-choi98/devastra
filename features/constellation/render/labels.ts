// SPDX-License-Identifier: MIT
import type { TerritoryType } from '@/features/territories/registry'

export interface LabelSelectionInput {
  landmarks: Array<{
    tech_key: string
    weight: number
    firstUnlockedAt: string | null
    territory: TerritoryType
  }>
  territories: Array<{ type: TerritoryType; stage: number }>
}

export interface LabelSelectionResult {
  /** tech_keys whose persistent label should be rendered. */
  persistent: Set<string>
}

/**
 * Persistent label visibility rule (ADR-63, amended):
 *
 *   - Label every lit tech star, regardless of brightness.
 *   - Exclude unlit / below-threshold catalog anchors.
 *
 * "Lit" = firstUnlockedAt !== null AND weight >= 5.
 */
export function selectPersistentLabels(input: LabelSelectionInput): LabelSelectionResult {
  const litStars = input.landmarks.filter(
    (lm) => lm.firstUnlockedAt !== null && lm.weight >= 5,
  )
  return { persistent: new Set(litStars.map((lm) => lm.tech_key)) }
}
