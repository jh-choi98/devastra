'use client'

import { FirstEverCinematic } from '@/app/_components/Constellation/cinematics/FirstEverCinematic'
import type { ConstellationData } from '@/app/_components/Constellation/types'

interface Props {
  newStars: Array<{ tech_key: string; displayName: string; territory: string }>
  data: ConstellationData
  onComplete: () => void
}

// Thin adapter: bridges the legacy _map-container API to the new FirstEverCinematic.
export function FirstEverStarCinematic({ newStars, onComplete }: Props) {
  const landmarks = newStars.map(s => ({
    tech_key: s.tech_key,
    displayName: s.displayName,
  }))
  return <FirstEverCinematic firstStarLandmarks={landmarks} onComplete={onComplete} />
}
