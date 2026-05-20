'use client'
import { useEffect, useMemo, useState } from 'react'
import type { PointerEvent } from 'react'
import { voronoiCells } from '@/features/constellation/render/voronoi'
import { brightnessDescriptor } from '@/features/constellation/render/magnitude'
import { getPublicTech } from '@/features/territories/tech-catalog-public'
import { CLUSTER_LABELS } from '../cluster-labels'
import { useConstellationState } from '../state'
import { resolveTechLabelLayouts } from '../label-layout'
import {
  DEFAULT_SEMANTIC_SCALE_PROFILE,
  type SemanticConstellationScaleProfile,
} from '../semantic-scale-profile'
import type { ConstellationData } from '../types'
import type { TerritoryType } from '@/features/territories/registry'

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
  return `${CLUSTER_LABELS[type]} cluster — ${stars} stars lit, stage ${t?.stage ?? 1}`
}

function ariaForStar(l: ConstellationData['landmarks'][number]): string {
  const since = l.firstUnlockedAt ? `, lit since ${formatShortDate(l.firstUnlockedAt)}` : ''
  return `${techDisplayName(l.tech_key)} — ${brightnessDescriptor(l.weight)}${since}`
}

interface A11yOverlayProps {
  data: ConstellationData
  viewport?: 'desktop' | 'mobile' | 'og'
  semanticProfile?: SemanticConstellationScaleProfile
  canvasSize?: { width: number | null; height: number | null }
  svgTransform?: string
  onClusterClick?: (type: TerritoryType) => void
  onStarClick?: (territory: TerritoryType, tech_key: string) => void
}

export function A11yOverlay({
  data,
  viewport = 'desktop',
  semanticProfile = DEFAULT_SEMANTIC_SCALE_PROFILE,
  canvasSize,
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

  const labelLayouts = useMemo(
    () => resolveTechLabelLayouts({ data, viewport, semanticProfile, canvasSize }),
    [canvasSize, data, semanticProfile, viewport],
  )

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
          {labelLayouts.map((layout) => {
            return (
              <g key={layout.tech_key}>
                <circle
                  cx={layout.star.x}
                  cy={layout.star.y}
                  r={starHitRadius}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={ariaForStar(layout.landmark)}
                  className="pointer-events-auto cursor-pointer focus:outline-none focus-visible:stroke-sky-300/70 focus-visible:stroke-1"
                  onPointerEnter={(e) => showStarTooltip(layout.landmark, e)}
                  onPointerMove={(e) => showStarTooltip(layout.landmark, e)}
                  onPointerLeave={hideStarTooltip}
                  onClick={() => onStarClick?.(layout.landmark.territory, layout.tech_key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onStarClick?.(layout.landmark.territory, layout.tech_key)
                    }
                  }}
                />

                {/* Pointer target for the visible tech label above the star.
                  Drei's Html labels are visual-only; this invisible rect makes
                  hovering the text itself trigger the same label brightening
                  without adding a second keyboard focus stop. */}
                <rect
                  x={layout.rect.x}
                  y={layout.rect.y}
                  width={layout.rect.width}
                  height={layout.rect.height}
                  rx={5}
                  fill="transparent"
                  aria-hidden="true"
                  className="pointer-events-auto cursor-pointer"
                  onPointerEnter={() => showTechLabelHover(layout.tech_key)}
                  onPointerLeave={hideTechLabelHover}
                  onClick={() => onStarClick?.(layout.landmark.territory, layout.tech_key)}
                />
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
