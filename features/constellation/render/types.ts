// SPDX-License-Identifier: MIT
//
// Constellation render math — shared types.
// These types are isomorphic (used by both client WebGL renderer
// and server SVG OG renderer). Do NOT add server-side or client-side
// restricted imports here.

import type { TerritoryType } from '@/features/territories/registry'

export type Viewport = 'desktop' | 'mobile' | 'og'

export interface WorldCoord {
  x: number
  y: number
}

export interface ClusterAnchor extends WorldCoord {
  type: TerritoryType
  spread: number
}

export type AnchorMap = Record<Viewport, ClusterAnchor[]>

/** Spectral palette buckets used by tech stars and field stars. */
export type SpectralColor =
  | 'white'
  | 'blue-white'
  | 'yellow-white'
  | 'orange'
  | 'red'

export interface VoronoiCell {
  type: TerritoryType
  polygon: WorldCoord[]   // CCW vertices in viewBox units (1000x700)
}

export interface FieldStar {
  pos: WorldCoord
  size: number              // 1 | 2 | 3 (3 has visible halo)
  color: SpectralColor
  twinklePhase: number      // 0..1, deterministic
}

export interface MstEdge {
  a: WorldCoord
  b: WorldCoord
}
