import { useRef } from 'react'
import type { ConstellationData } from '../types'
import type { TerritoryType } from '@/features/territories/registry'

export interface NewlyLitLandmark {
  tech_key: string
  territory: TerritoryType
}

/**
 * Computes per-render diffs against the previous data snapshot.
 * Returns newly-lit landmarks and clusters that staged up.
 * Uses a ref so the diff is stable across React Strict Mode double-invocations —
 * SparkSequence's own firedKeys ref prevents duplicate sparks.
 */
export function useDataDiff(data: ConstellationData): {
  newlyLit: NewlyLitLandmark[]
  stagedUp: TerritoryType[]
} {
  const prev = useRef<ConstellationData | null>(null)

  const newlyLit: NewlyLitLandmark[] = []
  const stagedUp: TerritoryType[] = []

  if (prev.current) {
    const wasLit = new Set(
      prev.current.landmarks
        .filter(l => l.firstUnlockedAt !== null && l.weight >= 5)
        .map(l => l.tech_key),
    )
    data.landmarks.forEach(l => {
      if (l.firstUnlockedAt !== null && l.weight >= 5 && !wasLit.has(l.tech_key)) {
        newlyLit.push({ tech_key: l.tech_key, territory: l.territory })
      }
    })

    const prevStages = new Map(prev.current.territories.map(t => [t.type, t.stage]))
    data.territories.forEach(t => {
      const prevStage = prevStages.get(t.type) ?? 1
      if (t.stage > prevStage) stagedUp.push(t.type)
    })
  }

  prev.current = data
  return { newlyLit, stagedUp }
}
