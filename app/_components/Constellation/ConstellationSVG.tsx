'use client'

import { useMemo } from 'react'
import type { TerritoryType } from '@/features/territories/registry'
import { TERRITORIES, ALL_TERRITORY_TYPES } from '@/features/territories/registry'
import { Star } from './Star'
import { resolveStarViewBoxPosition } from './star-positions'
import type { ConstellationData } from './types'

type Anchor = { cx: number; cy: number; spread: number }

// One full sky, 1000×700 canvas. Anchors are loosely placed so clusters bleed
// into each other instead of sitting in rigid circles.
const CLUSTER_ANCHORS: Record<'desktop' | 'mobile' | 'og', Record<TerritoryType, Anchor>> = {
  desktop: {
    frontend_land:      { cx: 215, cy: 205, spread: 230 },
    backend_fortress:   { cx: 510, cy: 165, spread: 250 },
    data_pipeline_zone: { cx: 805, cy: 235, spread: 220 },
    testing_lab:        { cx: 235, cy: 515, spread: 215 },
    devops_harbor:      { cx: 535, cy: 540, spread: 245 },
    docs_library:       { cx: 815, cy: 505, spread: 200 },
  },
  og: {
    frontend_land:      { cx: 200, cy: 200, spread: 200 },
    backend_fortress:   { cx: 500, cy: 180, spread: 215 },
    data_pipeline_zone: { cx: 800, cy: 220, spread: 195 },
    testing_lab:        { cx: 220, cy: 500, spread: 195 },
    devops_harbor:      { cx: 520, cy: 525, spread: 215 },
    docs_library:       { cx: 800, cy: 490, spread: 180 },
  },
  mobile: {
    frontend_land:      { cx: 285, cy: 130, spread: 175 },
    backend_fortress:   { cx: 730, cy: 145, spread: 175 },
    data_pipeline_zone: { cx: 270, cy: 350, spread: 165 },
    testing_lab:        { cx: 730, cy: 355, spread: 165 },
    devops_harbor:      { cx: 285, cy: 565, spread: 170 },
    docs_library:       { cx: 720, cy: 555, spread: 150 },
  },
}

// Deterministic decorative background star field. Generated once at module load
// so the same field shows server-side and client-side (no hydration flicker).
type BgStar = { x: number; y: number; r: number; o: number; tint: string }
const BG_STARS: BgStar[] = (() => {
  let seed = 0x9e3779b9 >>> 0
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out: BgStar[] = []
  for (let i = 0; i < 320; i++) {
    const big = rand()
    out.push({
      x: rand() * 1000,
      y: rand() * 700,
      r: big < 0.92 ? 0.3 + rand() * 0.7 : 0.9 + rand() * 0.7,
      o: 0.12 + rand() * 0.55,
      tint: rand() < 0.12 ? '#a8c0ff' : rand() < 0.06 ? '#ffe4b5' : '#ffffff',
    })
  }
  return out
})()

export function ConstellationSVG({
  data,
  onClusterClick,
  onStarClick,
}: {
  data: ConstellationData
  onClusterClick?: (territory: TerritoryType) => void
  onStarClick?: (territory: TerritoryType, tech_key: string) => void
}) {
  const viewport = data.viewport ?? 'desktop'
  const anchors = CLUSTER_ANCHORS[viewport]
  const diffSince = data.diffSince ?? null

  // Resolve a global (cx, cy) on the 1000×700 canvas for every lit star.
  const placedByCluster = useMemo(() => {
    const out = new Map<
      TerritoryType,
      Array<{
        tech_key: string
        weight: number
        firstUnlockedAt: string | null
        x: number
        y: number
      }>
    >()
    for (const type of ALL_TERRITORY_TYPES) out.set(type, [])

    for (const lm of data.landmarks) {
      if (lm.firstUnlockedAt === null) continue
      const { x, y } = resolveStarViewBoxPosition(lm.tech_key, lm.territory, viewport)
      out.get(lm.territory)?.push({ ...lm, x, y })
    }
    return out
  }, [data.landmarks, viewport])

  // MST connection edges per cluster, using global coords.
  const edgesByCluster = useMemo(() => {
    const out = new Map<TerritoryType, Array<{ x1: number; y1: number; x2: number; y2: number }>>()
    for (const type of ALL_TERRITORY_TYPES) {
      const stars = placedByCluster.get(type) ?? []
      if (stars.length < 2) {
        out.set(type, [])
        continue
      }
      const inMST = new Set<number>([0])
      const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
      while (inMST.size < stars.length) {
        let minD = Infinity
        let minI = -1
        let minJ = -1
        for (const i of Array.from(inMST)) {
          for (let j = 0; j < stars.length; j++) {
            if (inMST.has(j)) continue
            const dx = stars[i].x - stars[j].x
            const dy = stars[i].y - stars[j].y
            const d = dx * dx + dy * dy
            if (d < minD) {
              minD = d
              minI = i
              minJ = j
            }
          }
        }
        if (minJ === -1) break
        inMST.add(minJ)
        edges.push({ x1: stars[minI].x, y1: stars[minI].y, x2: stars[minJ].x, y2: stars[minJ].y })
      }
      out.set(type, edges)
    }
    return out
  }, [placedByCluster])

  const totalLit = Array.from(placedByCluster.values()).reduce((a, l) => a + l.length, 0)
  const activeClusters = ALL_TERRITORY_TYPES.filter((t) => (placedByCluster.get(t)?.length ?? 0) > 0).length

  return (
    <div className="relative w-full h-full">
      <svg
        data-testid="constellation-canvas"
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        role="img"
        aria-label={`Constellation with ${totalLit} stars lit across ${activeClusters} clusters`}
      >
        <defs>
          <radialGradient id="sky-glow" cx="50%" cy="42%" r="75%">
            <stop offset="0%" stopColor="#162447" />
            <stop offset="55%" stopColor="#0b1530" />
            <stop offset="100%" stopColor="#02040c" />
          </radialGradient>
          {ALL_TERRITORY_TYPES.map((type) => (
            <radialGradient key={`wash-${type}`} id={`wash-${type}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={TERRITORIES[type].color} stopOpacity="0.16" />
              <stop offset="55%" stopColor={TERRITORIES[type].color} stopOpacity="0.05" />
              <stop offset="100%" stopColor={TERRITORIES[type].color} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>

        {/* Deep sky base */}
        <rect width="1000" height="700" fill="url(#sky-glow)" />

        {/* Background decorative star field */}
        <g aria-hidden="true">
          {BG_STARS.map((s, i) => (
            <circle key={i} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)} fill={s.tint} opacity={s.o.toFixed(2)} />
          ))}
        </g>

        {/* Cluster washes — visible only where stars are lit */}
        <g aria-hidden="true">
          {ALL_TERRITORY_TYPES.map((type) => {
            const lit = placedByCluster.get(type) ?? []
            if (lit.length === 0) return null
            const a = anchors[type]
            return (
              <ellipse
                key={`wash-${type}`}
                cx={a.cx}
                cy={a.cy}
                rx={a.spread * 1.3}
                ry={a.spread * 1.05}
                fill={`url(#wash-${type})`}
              />
            )
          })}
        </g>

        {/* Constellation lines (MST) per cluster */}
        <g aria-hidden="true">
          {ALL_TERRITORY_TYPES.map((type) => {
            const edges = edgesByCluster.get(type) ?? []
            const color = TERRITORIES[type].color
            return (
              <g key={`edges-${type}`} stroke={color} strokeWidth="0.7" opacity="0.32" strokeLinecap="round">
                {edges.map((e, i) => (
                  <line
                    key={i}
                    x1={e.x1.toFixed(2)}
                    y1={e.y1.toFixed(2)}
                    x2={e.x2.toFixed(2)}
                    y2={e.y2.toFixed(2)}
                  />
                ))}
              </g>
            )
          })}
        </g>

        {/* Stars + cluster labels */}
        {ALL_TERRITORY_TYPES.map((type) => {
          const territory = data.territories.find((t) => t.type === type)
          const stage = territory?.stage ?? 1
          const lit = placedByCluster.get(type) ?? []
          if (lit.length === 0) return <g key={type} data-testid={`cluster-${type}`} />

          const meta = TERRITORIES[type]
          const anchor = anchors[type]
          return (
            <g key={type} data-testid={`cluster-${type}`}>
              {lit.map((s) => {
                const isNew = diffSince !== null && s.firstUnlockedAt !== null && s.firstUnlockedAt > diffSince
                return (
                  <g key={s.tech_key} transform={`translate(${s.x.toFixed(2)}, ${s.y.toFixed(2)})`}>
                    <Star
                      tech_key={s.tech_key}
                      x={0}
                      y={0}
                      weight={s.weight}
                      color={meta.color}
                      accentColor={meta.accentColor}
                      isNew={isNew}
                      showLabel
                      onClick={onStarClick ? () => onStarClick(type, s.tech_key) : undefined}
                    />
                  </g>
                )
              })}

              {/* Cluster label — floats below the cluster region, Stellarium-style */}
              <g
                role="button"
                tabIndex={0}
                aria-label={`${meta.name} cluster, ${lit.length} stars lit`}
                style={{ cursor: onClusterClick ? 'pointer' : 'default' }}
                onClick={onClusterClick ? () => onClusterClick(type) : undefined}
                onKeyDown={(e) => {
                  if (onClusterClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onClusterClick(type)
                  }
                }}
              >
                <text
                  x={anchor.cx}
                  y={anchor.cy + anchor.spread + 26}
                  textAnchor="middle"
                  fontSize="11"
                  fill={meta.color}
                  fillOpacity="0.75"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="500"
                  letterSpacing="3"
                >
                  {meta.name.toUpperCase()}
                  {stage >= 3 && (
                    <tspan dx="6" fill="#64748b" letterSpacing="2">
                      · STAGE {stage}
                    </tspan>
                  )}
                </text>
              </g>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
