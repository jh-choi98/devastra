'use client'
import { useMemo } from 'react'
import { voronoiCells } from '@/features/constellation/render/voronoi'
import { selectPersistentLabels } from '@/features/constellation/render/labels'
import { brightnessDescriptor } from '@/features/constellation/render/magnitude'
import { resolveStarViewBoxPosition } from '../star-positions'
import { getPublicTech } from '@/features/territories/tech-catalog-public'
import { useConstellationState } from '../state'
import type { ConstellationData } from '../types'
import type { TerritoryType } from '@/features/territories/registry'

const CLUSTER_DISPLAY_NAMES: Record<TerritoryType, string> = {
  frontend_land:      'Frontend',
  backend_fortress:   'Backend',
  data_pipeline_zone: 'Data',
  testing_lab:        'Testing',
  devops_harbor:      'DevOps',
  docs_library:       'Docs',
}

function techDisplayName(tech_key: string): string {
  return getPublicTech(tech_key)?.displayName ?? tech_key
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function ariaForCluster(type: TerritoryType, data: ConstellationData): string {
  const t = data.territories.find(x => x.type === type)
  const stars = data.landmarks.filter(
    l => l.territory === type && l.firstUnlockedAt !== null && l.weight >= 5,
  ).length
  return `${CLUSTER_DISPLAY_NAMES[type]} cluster — ${stars} stars lit, stage ${t?.stage ?? 1}`
}

function ariaForStar(l: ConstellationData['landmarks'][number]): string {
  const since = l.firstUnlockedAt ? `, lit since ${formatShortDate(l.firstUnlockedAt)}` : ''
  return `${techDisplayName(l.tech_key)} — ${brightnessDescriptor(l.weight)}${since}`
}

interface A11yOverlayProps {
  data: ConstellationData
  viewport?: 'desktop' | 'mobile' | 'og'
  onClusterClick?: (type: TerritoryType) => void
  onStarClick?: (territory: TerritoryType, tech_key: string) => void
}

export function A11yOverlay({ data, viewport = 'desktop', onClusterClick, onStarClick }: A11yOverlayProps) {
  const { setHovered } = useConstellationState()

  const cells = useMemo(() => voronoiCells(viewport), [viewport])

  const heroStars = useMemo(() => {
    const persistent = selectPersistentLabels({ landmarks: data.landmarks, territories: data.territories })
    return data.landmarks
      .filter(l => persistent.persistent.has(l.tech_key) && l.firstUnlockedAt !== null && l.weight >= 5)
      .sort((a, b) => b.weight - a.weight || a.tech_key.localeCompare(b.tech_key))
  }, [data])

  return (
    <div
      role="region"
      aria-label="Constellation accessibility overlay"
      className="absolute inset-0 pointer-events-none"
    >
      <svg
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
      >
        {/* Cluster cell buttons — tab order: frontend, backend, data, testing, devops, docs (ADR-63) */}
        {cells.map(cell => (
          <polygon
            key={cell.type}
            points={cell.polygon.map(p => `${p.x},${p.y}`).join(' ')}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={ariaForCluster(cell.type, data)}
            className="pointer-events-auto cursor-pointer focus:outline-none focus-visible:stroke-2 focus-visible:stroke-sky-300/60"
            onPointerEnter={() => setHovered(cell.type)}
            onPointerLeave={() => setHovered(null)}
            onClick={() => onClusterClick?.(cell.type)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClusterClick?.(cell.type)
              }
            }}
          />
        ))}

        {/* Hero star buttons — persistent-labeled stars only (ADR-63). Tab order: weight-descending. */}
        {heroStars.map(l => {
          const pos = resolveStarViewBoxPosition(l.tech_key, l.territory, viewport)
          return (
            <circle
              key={l.tech_key}
              cx={pos.x}
              cy={pos.y}
              r={6}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={ariaForStar(l)}
              className="pointer-events-auto cursor-pointer focus:outline-none focus-visible:stroke-1 focus-visible:stroke-sky-300/70"
              onPointerEnter={e => {
                window.dispatchEvent(
                  new CustomEvent('constellation:star-hover', {
                    detail: { tech_key: l.tech_key, x: e.clientX, y: e.clientY },
                  }),
                )
              }}
              onPointerLeave={() => {
                window.dispatchEvent(
                  new CustomEvent('constellation:star-hover', { detail: null }),
                )
              }}
              onClick={() => onStarClick?.(l.territory, l.tech_key)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onStarClick?.(l.territory, l.tech_key)
                }
              }}
            />
          )
        })}
      </svg>
    </div>
  )
}
