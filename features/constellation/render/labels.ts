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

const GLOBAL_CAP = 12
const SPARSE_THRESHOLD = 6

/**
 * Persistent label visibility rule (ADR-63):
 *
 *   - Top 1 lit star per active cluster (active = stage >= 2 OR has any lit stars)
 *   - PLUS globally brightest lit stars, filling up to a global cap of 12
 *   - Dedupe: cluster-top stars are not double-counted toward the global fill
 *   - If total lit stars <= 6, label ALL lit stars (sparse-state override)
 *
 * "Lit" = firstUnlockedAt !== null AND weight >= 5.
 * Brightness ordering: weight DESC, tech_key ASC tiebreak (deterministic).
 */
export function selectPersistentLabels(input: LabelSelectionInput): LabelSelectionResult {
  const { landmarks, territories } = input

  const litStars = landmarks.filter(
    (lm) => lm.firstUnlockedAt !== null && lm.weight >= 5,
  )

  if (litStars.length === 0) return { persistent: new Set() }

  // Sparse override
  if (litStars.length <= SPARSE_THRESHOLD) {
    return { persistent: new Set(litStars.map((lm) => lm.tech_key)) }
  }

  const sortedByBrightness = [...litStars].sort(
    (a, b) => b.weight - a.weight || a.tech_key.localeCompare(b.tech_key),
  )

  const stageByType = new Map(territories.map((t) => [t.type, t.stage]))

  const litByCluster = new Map<TerritoryType, typeof litStars>()
  for (const lm of litStars) {
    const arr = litByCluster.get(lm.territory) ?? []
    arr.push(lm)
    litByCluster.set(lm.territory, arr)
  }

  const persistent = new Set<string>()

  // Step 1: top-1 per active cluster
  const allTypes = Array.from(new Set([
    ...Array.from(litByCluster.keys()),
    ...territories.map((t) => t.type),
  ]))
  for (const type of allTypes) {
    const stage = stageByType.get(type) ?? 1
    const clusterLit = litByCluster.get(type) ?? []
    const isActive = stage >= 2 || clusterLit.length > 0
    if (!isActive || clusterLit.length === 0) continue

    const top = clusterLit.reduce((best, lm) =>
      lm.weight > best.weight || (lm.weight === best.weight && lm.tech_key < best.tech_key)
        ? lm
        : best,
    )
    persistent.add(top.tech_key)
  }

  // Step 2: fill globally brightest until cap
  for (const lm of sortedByBrightness) {
    if (persistent.size >= GLOBAL_CAP) break
    persistent.add(lm.tech_key)
  }

  return { persistent }
}
