'use client'

import type { TerritoryType } from '@/features/territories/registry'
import { ALL_TERRITORY_TYPES } from '@/features/territories/registry'
import { Cluster } from './Cluster'
import { Connections } from './Connections'
import { ClusterAura } from './ClusterAura'

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
  /** ISO date string. Diff visualization highlights changes since this point. */
  diffSince?: string | null
  /** Viewport mode controls cluster center positions. */
  viewport?: 'desktop' | 'mobile' | 'og'
}

// Cluster center positions per viewport (0..1 normalized within canvas).
const CLUSTER_CENTERS: Record<'desktop' | 'mobile' | 'og', Record<TerritoryType, { cx: number; cy: number; r: number }>> = {
  desktop: {
    frontend_land:      { cx: 0.20, cy: 0.30, r: 0.16 },
    backend_fortress:   { cx: 0.50, cy: 0.30, r: 0.16 },
    data_pipeline_zone: { cx: 0.80, cy: 0.30, r: 0.16 },
    testing_lab:        { cx: 0.20, cy: 0.72, r: 0.16 },
    devops_harbor:      { cx: 0.50, cy: 0.72, r: 0.16 },
    docs_library:       { cx: 0.80, cy: 0.72, r: 0.16 },
  },
  og: {
    frontend_land:      { cx: 0.18, cy: 0.32, r: 0.14 },
    backend_fortress:   { cx: 0.50, cy: 0.32, r: 0.14 },
    data_pipeline_zone: { cx: 0.82, cy: 0.32, r: 0.14 },
    testing_lab:        { cx: 0.18, cy: 0.70, r: 0.14 },
    devops_harbor:      { cx: 0.50, cy: 0.70, r: 0.14 },
    docs_library:       { cx: 0.82, cy: 0.70, r: 0.14 },
  },
  mobile: {
    frontend_land:      { cx: 0.28, cy: 0.18, r: 0.18 },
    backend_fortress:   { cx: 0.72, cy: 0.18, r: 0.18 },
    data_pipeline_zone: { cx: 0.28, cy: 0.48, r: 0.18 },
    testing_lab:        { cx: 0.72, cy: 0.48, r: 0.18 },
    devops_harbor:      { cx: 0.28, cy: 0.78, r: 0.18 },
    docs_library:       { cx: 0.72, cy: 0.78, r: 0.18 },
  },
}

export function Constellation({
  data,
  onClusterClick,
  onStarClick,
}: {
  data: ConstellationData
  onClusterClick?: (territory: TerritoryType) => void
  onStarClick?: (territory: TerritoryType, tech_key: string) => void
}) {
  const viewport = data.viewport ?? 'desktop'
  const centers = CLUSTER_CENTERS[viewport]

  return (
    <div className="relative w-full h-full">
      <svg
        viewBox="0 0 1000 700"
        className="w-full h-full"
        role="img"
        aria-label={`Constellation with ${data.landmarks.length} stars lit across ${data.territories.filter((t) => t.stage > 1).length} clusters`}
      >
        <defs>
          <linearGradient id="sky-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b1020" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
        </defs>
        <rect width="1000" height="700" fill="url(#sky-gradient)" />

        {ALL_TERRITORY_TYPES.map((type) => {
          const territory = data.territories.find((t) => t.type === type)
          const stars = data.landmarks.filter((l) => l.territory === type)
          const center = centers[type]
          const cx = center.cx * 1000
          const cy = center.cy * 700
          const radius = center.r * Math.min(1000, 700)

          return (
            <g key={type} transform={`translate(${cx.toFixed(1)}, ${cy.toFixed(1)})`}>
              <ClusterAura
                type={type}
                radius={radius}
                stage={territory?.stage ?? 1}
                stageChangedAt={territory?.stageChangedAt ?? null}
                diffSince={data.diffSince ?? null}
              />
              <Connections type={type} stars={stars} radius={radius} />
              <Cluster
                type={type}
                radius={radius}
                stage={territory?.stage ?? 1}
                growth30d={territory?.growth30d ?? 0}
                stars={stars}
                diffSince={data.diffSince ?? null}
                onClusterClick={onClusterClick ? () => onClusterClick(type) : undefined}
                onStarClick={onStarClick ? (tech_key) => onStarClick(type, tech_key) : undefined}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
