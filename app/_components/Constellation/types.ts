import type { TerritoryType } from '@/features/territories/registry'

export type ConstellationData = {
  userId: string
  territories: Array<{
    type: TerritoryType
    stage: number
    totalWeight: number
    growth30d: number
    stageChangedAt: string | null
  }>
  landmarks: Array<{
    tech_key: string
    territory: TerritoryType
    weight: number
    firstUnlockedAt: string | null
  }>
  diffSince?: string | null
  viewport?: 'desktop' | 'mobile' | 'og'
}

export interface ConstellationProps {
  data: ConstellationData
  /** Server-side feature flag forwarded from the page. Defaults to 'webgl'. */
  renderer?: 'webgl' | 'svg'
  onClusterClick?: (type: TerritoryType) => void
  onStarClick?: (territory: TerritoryType, tech_key: string) => void
}
