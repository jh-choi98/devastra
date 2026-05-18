'use client'
import { useEffect, useMemo, useState } from 'react'
import type { PointerEvent } from 'react'
import { voronoiCells } from '@/features/constellation/render/voronoi'
import { selectPersistentLabels } from '@/features/constellation/render/labels'
import { brightnessDescriptor } from '@/features/constellation/render/magnitude'
import { resolveStarViewBoxPosition } from '../star-positions'
import {
  estimateTechLabelWidth,
  resolveTechLabelViewBoxPosition,
  techLabelFontSize,
} from '../label-position'
import { getPublicTech } from '@/features/territories/tech-catalog-public'
import { useConstellationState } from '../state'
import type { ConstellationData } from '../types'
import type { TerritoryType } from '@/features/territories/registry'

const CLUSTER_DISPLAY_NAMES: Record<TerritoryType, string> = {
  frontend_land: 'Frontend',
  backend_fortress: 'Backend',
  data_pipeline_zone: 'Data',
  testing_lab: 'Testing',
  devops_harbor: 'DevOps',
  docs_library: 'Docs',
}

const STAR_HIT_RADIUS_BY_VIEWPORT: Record<'desktop' | 'mobile' | 'og', number> = {
  desktop: 14,
  mobile: 76,
  og: 14,
}

function techDisplayName(tech_key: string): string {
  return getPublicTech(tech_key)?.displayName ?? tech_key
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function ariaForCluster(type: TerritoryType, data: ConstellationData): string {
  const t = data.territories.find((x) => x.type === type)
  const stars = data.landmarks.filter(
    (l) => l.territory === type && l.firstUnlockedAt !== null && l.weight >= 5,
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
  svgTransform?: string
  onClusterClick?: (type: TerritoryType) => void
  onStarClick?: (territory: TerritoryType, tech_key: string) => void
}

export function A11yOverlay({
  data,
  viewport = 'desktop',
  svgTransform,
  onClusterClick,
  onStarClick,
}: A11yOverlayProps) {
  const { setHovered, setHoveredTechKey } = useConstellationState()
  const [coarsePointer, setCoarsePointer] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse), (max-width: 767px)')
    const update = () => setCoarsePointer(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const starHitRadius =
    coarsePointer && viewport !== 'og' ? STAR_HIT_RADIUS_BY_VIEWPORT.mobile : STAR_HIT_RADIUS_BY_VIEWPORT[viewport]

  const cells = useMemo(() => voronoiCells(viewport), [viewport])

  const labeledStars = useMemo(() => {
    const persistent = selectPersistentLabels({
      landmarks: data.landmarks,
      territories: data.territories,
    })
    return data.landmarks
      .filter(
        (l) => persistent.persistent.has(l.tech_key) && l.firstUnlockedAt !== null && l.weight >= 5,
      )
      .sort((a, b) => b.weight - a.weight || a.tech_key.localeCompare(b.tech_key))
  }, [data])

  const showStarTooltip = (
    landmark: ConstellationData['landmarks'][number],
    e: PointerEvent<SVGElement>,
  ) => {
    setHoveredTechKey(landmark.tech_key)
    window.dispatchEvent(
      new CustomEvent('constellation:star-hover', {
        detail: { tech_key: landmark.tech_key, x: e.clientX, y: e.clientY },
      }),
    )
  }

  const hideStarTooltip = () => {
    setHoveredTechKey(null)
    window.dispatchEvent(new CustomEvent('constellation:star-hover', { detail: null }))
  }

  const showTechLabelHover = (techKey: string) => {
    setHoveredTechKey(techKey)
  }

  const hideTechLabelHover = () => {
    setHoveredTechKey(null)
  }

  return (
    <div
      role="region"
      aria-label="Constellation accessibility overlay"
      className="pointer-events-none absolute inset-0"
    >
      <svg
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
      >
        <g transform={svgTransform}>
          {/* Cluster cell buttons — tab order: frontend, backend, data, testing, devops, docs (ADR-63) */}
          {cells.map((cell) => (
            <polygon
              key={cell.type}
              points={cell.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={ariaForCluster(cell.type, data)}
              className="pointer-events-auto cursor-pointer focus:outline-none focus-visible:stroke-sky-300/60 focus-visible:stroke-2"
              onPointerEnter={() => setHovered(cell.type)}
              onPointerLeave={() => setHovered(null)}
              onClick={() => onClusterClick?.(cell.type)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onClusterClick?.(cell.type)
                }
              }}
            />
          ))}

          {/* Labeled star buttons - every lit tech star is visible and interactive. */}
          {labeledStars.map((l) => {
            const pos = resolveStarViewBoxPosition(l.tech_key, l.territory, viewport)
            const labelPos = resolveTechLabelViewBoxPosition(l.tech_key, l.territory, viewport)
            const label = techDisplayName(l.tech_key)
            const labelWidth = estimateTechLabelWidth(label, techLabelFontSize(l.weight, viewport))
            return (
              <g key={l.tech_key}>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={starHitRadius}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={ariaForStar(l)}
                  className="pointer-events-auto cursor-pointer focus:outline-none focus-visible:stroke-sky-300/70 focus-visible:stroke-1"
                  onPointerEnter={(e) => showStarTooltip(l, e)}
                  onPointerMove={(e) => showStarTooltip(l, e)}
                  onPointerLeave={hideStarTooltip}
                  onClick={() => onStarClick?.(l.territory, l.tech_key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onStarClick?.(l.territory, l.tech_key)
                    }
                  }}
                />

                {/* Pointer target for the visible tech label above the star.
                  Drei's Html labels are visual-only; this invisible rect makes
                  hovering the text itself trigger the same label brightening
                  without adding a second keyboard focus stop. */}
                <rect
                  x={labelPos.x - labelWidth / 2}
                  y={labelPos.y - 10}
                  width={labelWidth}
                  height={20}
                  rx={5}
                  fill="transparent"
                  aria-hidden="true"
                  className="pointer-events-auto cursor-pointer"
                  onPointerEnter={() => showTechLabelHover(l.tech_key)}
                  onPointerLeave={hideTechLabelHover}
                  onClick={() => onStarClick?.(l.territory, l.tech_key)}
                />
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
