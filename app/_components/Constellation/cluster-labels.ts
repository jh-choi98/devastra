import type { TerritoryType } from '@/features/territories/registry'
import type { Viewport } from '@/features/constellation/render/types'

export const CLUSTER_LABELS: Record<TerritoryType, string> = {
  frontend_land: 'Frontend',
  backend_fortress: 'Backend',
  data_pipeline_zone: 'Data',
  testing_lab: 'Testing',
  devops_harbor: 'DevOps',
  docs_library: 'Docs',
}

export const CLUSTER_LABEL_GLOW: Record<TerritoryType, string> = {
  frontend_land: '96, 165, 250',
  backend_fortress: '103, 232, 249',
  data_pipeline_zone: '110, 231, 183',
  testing_lab: '196, 181, 253',
  devops_harbor: '251, 191, 136',
  docs_library: '253, 224, 148',
}

export function clusterLabelFontSize(viewport: Viewport): number {
  if (viewport === 'mobile') return 10.8
  if (viewport === 'og') return 12
  return 13.2
}

export function estimateClusterLabelWidth(label: string, fontSize: number): number {
  return Math.max(52, label.length * fontSize * 0.6 + 20)
}

export function clusterLabelHeight(fontSize: number): number {
  return fontSize * 1.38 + 8
}
