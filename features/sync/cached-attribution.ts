import 'server-only'

import type { ClassificationResult } from '@/features/territories/classifier'
import type { TerritoryType } from '@/features/territories/registry'

export type CachedActivityAttribution = {
  territory: TerritoryType
  weight: number
  techKeys: readonly string[]
}

export function mergeCachedActivityAttribution(
  currentResults: readonly ClassificationResult[],
  cachedRows: readonly CachedActivityAttribution[],
): ClassificationResult[] {
  if (cachedRows.length === 0) return currentResults.map(copyResult)

  const byTerritory = new Map<
    TerritoryType,
    { territory: TerritoryType; weight: number; techKeys: string[] }
  >()

  for (const result of currentResults) {
    mergeIntoTerritory(byTerritory, result.territory, result.weight, result.techKeys)
  }

  for (const row of cachedRows) {
    if (row.techKeys.length === 0) continue
    mergeIntoTerritory(byTerritory, row.territory, row.weight, row.techKeys)
  }

  return Array.from(byTerritory.values())
}

function copyResult(result: ClassificationResult): ClassificationResult {
  return {
    territory: result.territory,
    weight: result.weight,
    techKeys: [...result.techKeys],
  }
}

function mergeIntoTerritory(
  byTerritory: Map<TerritoryType, { territory: TerritoryType; weight: number; techKeys: string[] }>,
  territory: TerritoryType,
  weight: number,
  techKeys: readonly string[],
): void {
  const existing = byTerritory.get(territory)
  if (!existing) {
    byTerritory.set(territory, {
      territory,
      weight,
      techKeys: Array.from(new Set(techKeys)),
    })
    return
  }

  existing.weight = Math.max(existing.weight, weight)
  const merged = new Set(existing.techKeys)
  for (const techKey of techKeys) merged.add(techKey)
  existing.techKeys = Array.from(merged)
}
