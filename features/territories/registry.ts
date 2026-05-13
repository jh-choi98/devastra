export type TerritoryType =
  | 'frontend_land'
  | 'backend_fortress'
  | 'data_pipeline_zone'
  | 'testing_lab'
  | 'devops_harbor'
  | 'docs_library'

export const TERRITORIES: Record<
  TerritoryType,
  {
    name: string
    color: string
    shapeSeed: string
    landmarkColor: string
  }
> = {
  frontend_land: { name: 'Frontend Land', color: '#7C9DFF', shapeSeed: 'fl', landmarkColor: '#3B5BFF' },
  backend_fortress: { name: 'Backend Fortress', color: '#6B7280', shapeSeed: 'bf', landmarkColor: '#374151' },
  data_pipeline_zone: { name: 'Data Pipeline Zone', color: '#10B981', shapeSeed: 'dpz', landmarkColor: '#047857' },
  testing_lab: { name: 'Testing Lab', color: '#A78BFA', shapeSeed: 'tl', landmarkColor: '#7C3AED' },
  devops_harbor: { name: 'DevOps Harbor', color: '#0EA5E9', shapeSeed: 'dh', landmarkColor: '#0369A1' },
  docs_library: { name: 'Docs Library', color: '#F59E0B', shapeSeed: 'dl', landmarkColor: '#B45309' },
}

export const ALL_TERRITORY_TYPES: TerritoryType[] = Object.keys(TERRITORIES) as TerritoryType[]
