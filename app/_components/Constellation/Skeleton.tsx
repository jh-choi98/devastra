'use client'

import { voronoiCells } from '@/features/constellation/render/voronoi'
import { anchorsFor } from '@/features/constellation/render/anchors'
import type { TerritoryType } from '@/features/territories/registry'

export interface SkeletonProps {
  viewport?: 'desktop' | 'mobile' | 'og'
}

const CLUSTER_LABELS: Record<TerritoryType, string> = {
  frontend_land: 'Frontend',
  backend_fortress: 'Backend',
  data_pipeline_zone: 'Data',
  testing_lab: 'Testing',
  devops_harbor: 'DevOps',
  docs_library: 'Docs',
}

export function Skeleton({ viewport = 'desktop' }: SkeletonProps) {
  const cells = voronoiCells(viewport)
  const anchors = anchorsFor(viewport)

  return (
    <svg
      viewBox="0 0 1000 700"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="skeleton-sky-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#020207" />
          <stop offset="1" stopColor="#050307" />
        </linearGradient>
      </defs>
      <rect width="1000" height="700" fill="url(#skeleton-sky-bg)" />
      {cells.map((cell) => (
        <polygon
          key={cell.type}
          points={cell.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#3a4555"
          strokeOpacity="0.1"
          strokeWidth="0.7"
        />
      ))}
      {anchors.map((a) => (
        <text
          key={a.type}
          x={a.x}
          y={a.y + a.spread + 18}
          fontSize="11"
          fill="#8aa0b8"
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
        >
          {CLUSTER_LABELS[a.type]}
        </text>
      ))}
    </svg>
  )
}
