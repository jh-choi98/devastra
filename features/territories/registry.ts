// SPDX-License-Identifier: MIT
export type TerritoryType =
  | 'frontend_land'
  | 'backend_fortress'
  | 'data_pipeline_zone'
  | 'testing_lab'
  | 'devops_harbor'
  | 'docs_library'

export type TerritoryMeta = {
  /** Short, neutral cluster label rendered as the in-canvas label. */
  name: string
  /** Cluster aura color + star color base. */
  color: string
  /** Brighter accent for star centers / connection highlights. */
  accentColor: string
}

export const TERRITORIES: Record<TerritoryType, TerritoryMeta> = {
  frontend_land:      { name: 'Frontend', color: '#7C9DFF', accentColor: '#3B5BFF' },
  backend_fortress:   { name: 'Backend',  color: '#94A3B8', accentColor: '#475569' },
  data_pipeline_zone: { name: 'Data',     color: '#34D399', accentColor: '#047857' },
  testing_lab:        { name: 'Testing',  color: '#A78BFA', accentColor: '#7C3AED' },
  devops_harbor:      { name: 'DevOps',   color: '#38BDF8', accentColor: '#0369A1' },
  docs_library:       { name: 'Docs',     color: '#FBBF24', accentColor: '#B45309' },
}

export const ALL_TERRITORY_TYPES: TerritoryType[] = Object.keys(TERRITORIES) as TerritoryType[]
