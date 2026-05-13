import 'server-only'

import { TERRITORIES } from '@/features/territories/registry'
import type { TerritoryType } from '@/features/territories/registry'

export type OgTerritory = {
  type: TerritoryType
  stage: number
  totalWeight: number
  growth30d: number
  stageChangedAt: string | null
}

export type OgLandmark = {
  tech_key: string
  territory: TerritoryType
  weight: number
  firstUnlockedAt: string | null
}

export type OgMapData = {
  territories: OgTerritory[]
  landmarks: OgLandmark[]
}

export function getTopTerritories(
  map: OgMapData,
  n = 3,
): Array<{ type: TerritoryType; stage: number; name: string; color: string }> {
  return [...map.territories]
    .sort((a, b) => b.stage - a.stage || b.totalWeight - a.totalWeight)
    .slice(0, n)
    .map((t) => ({
      type: t.type,
      stage: t.stage,
      name: TERRITORIES[t.type]?.name ?? t.type,
      color: TERRITORIES[t.type]?.color ?? '#6B7280',
    }))
}

// Inline palette constants (same as TERRITORIES, safe for server/edge use)
export const OG_TERRITORY_COLORS: Record<TerritoryType, string> = {
  frontend_land: '#7C9DFF',
  backend_fortress: '#6B7280',
  data_pipeline_zone: '#10B981',
  testing_lab: '#A78BFA',
  devops_harbor: '#0EA5E9',
  docs_library: '#F59E0B',
}

export const OG_TERRITORY_NAMES: Record<TerritoryType, string> = {
  frontend_land: 'Frontend Land',
  backend_fortress: 'Backend Fortress',
  data_pipeline_zone: 'Data Pipeline',
  testing_lab: 'Testing Lab',
  devops_harbor: 'DevOps Harbor',
  docs_library: 'Docs Library',
}
