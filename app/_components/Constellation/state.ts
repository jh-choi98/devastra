'use client'

import { createContext, useContext } from 'react'
import type { TerritoryType } from '@/features/territories/registry'

export type CinematicMode = 'idle' | 'reveal' | 'first-ever' | 'stage-up'

export interface ConstellationState {
  selected: TerritoryType | null
  hovered: TerritoryType | null
  /** Currently-hovered tech_key (if any). Independent of cluster hover. */
  hoveredTechKey: string | null
  cinematic: CinematicMode
  reducedMotion: boolean
  setHovered: (t: TerritoryType | null) => void
  setHoveredTechKey: (k: string | null) => void
  startCinematic: (mode: CinematicMode) => void
}

const ConstellationContext = createContext<ConstellationState | null>(null)

export function useConstellationState(): ConstellationState {
  const v = useContext(ConstellationContext)
  if (!v) throw new Error('useConstellationState outside ConstellationContext.Provider')
  return v
}

export { ConstellationContext }
