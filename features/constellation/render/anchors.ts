// SPDX-License-Identifier: MIT
import type { AnchorMap, ClusterAnchor, Viewport } from './types'
import type { TerritoryType } from '@/features/territories/registry'

/**
 * Cluster anchor positions per viewport. World coords are in viewBox units (1000x700).
 * Extracted verbatim from Constellation.tsx (lines ~32–57) so visual positioning
 * stays continuous across the renderer swap.
 */
export const ANCHORS: AnchorMap = {
  desktop: [
    { type: 'frontend_land',      x: 215, y: 205, spread: 230 },
    { type: 'backend_fortress',   x: 510, y: 165, spread: 250 },
    { type: 'data_pipeline_zone', x: 805, y: 235, spread: 220 },
    { type: 'testing_lab',        x: 235, y: 515, spread: 215 },
    { type: 'devops_harbor',      x: 535, y: 540, spread: 245 },
    { type: 'docs_library',       x: 815, y: 505, spread: 200 },
  ],
  og: [
    { type: 'frontend_land',      x: 200, y: 200, spread: 200 },
    { type: 'backend_fortress',   x: 500, y: 180, spread: 215 },
    { type: 'data_pipeline_zone', x: 800, y: 220, spread: 195 },
    { type: 'testing_lab',        x: 220, y: 500, spread: 195 },
    { type: 'devops_harbor',      x: 520, y: 525, spread: 215 },
    { type: 'docs_library',       x: 800, y: 490, spread: 180 },
  ],
  mobile: [
    { type: 'frontend_land',      x: 285, y: 130, spread: 175 },
    { type: 'backend_fortress',   x: 730, y: 145, spread: 175 },
    { type: 'data_pipeline_zone', x: 270, y: 350, spread: 165 },
    { type: 'testing_lab',        x: 730, y: 355, spread: 165 },
    { type: 'devops_harbor',      x: 285, y: 565, spread: 170 },
    { type: 'docs_library',       x: 720, y: 555, spread: 150 },
  ],
}

export function anchorsFor(viewport: Viewport): ClusterAnchor[] {
  return ANCHORS[viewport]
}

export function anchorFor(viewport: Viewport, type: TerritoryType): ClusterAnchor {
  const anchor = ANCHORS[viewport].find((a) => a.type === type)
  if (!anchor) throw new Error(`No anchor for ${viewport}/${type}`)
  return anchor
}
