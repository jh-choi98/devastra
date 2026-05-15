import 'server-only'
import type { TerritoryType } from '@/features/territories/registry'
import { TERRITORIES, ALL_TERRITORY_TYPES } from '@/features/territories/registry'
import { getStarPositions } from '@/features/territories/star-positions'
import { getPublicTech } from '@/features/territories/tech-catalog-public'

const CLUSTER_CENTERS: Record<TerritoryType, { cx: number; cy: number; r: number }> = {
  frontend_land:      { cx: 0.18, cy: 0.34, r: 0.13 },
  backend_fortress:   { cx: 0.50, cy: 0.34, r: 0.13 },
  data_pipeline_zone: { cx: 0.82, cy: 0.34, r: 0.13 },
  testing_lab:        { cx: 0.18, cy: 0.72, r: 0.13 },
  devops_harbor:      { cx: 0.50, cy: 0.72, r: 0.13 },
  docs_library:       { cx: 0.82, cy: 0.72, r: 0.13 },
}

export type OgTerritoryInput = {
  type: TerritoryType
  stage: number
  growth30d: number
  totalWeight: number
}

export type OgLandmarkInput = {
  tech_key: string
  territory: TerritoryType
  weight: number
  firstUnlockedAt: string | null
}

export function ConstellationOG(props: {
  width: number
  height: number
  territories: OgTerritoryInput[]
  landmarks: OgLandmarkInput[]
  diffSince?: string | null
  showHeroLabels?: boolean
}): JSX.Element {
  const { width, height, territories: _territories, landmarks } = props

  const starsByCluster = new Map<TerritoryType, OgLandmarkInput[]>()
  for (const t of ALL_TERRITORY_TYPES) starsByCluster.set(t, [])
  for (const l of landmarks) starsByCluster.get(l.territory)?.push(l)

  const allPositions = getStarPositions()

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#0b1020', position: 'relative' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="og-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b1020" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="url(#og-sky)" />

        {ALL_TERRITORY_TYPES.map((type) => {
          const center = CLUSTER_CENTERS[type]
          const cx = center.cx * width
          const cy = center.cy * height
          const radius = center.r * Math.min(width, height)
          const stars = starsByCluster.get(type) ?? []
          // "Lit" = unlock threshold crossed (firstUnlockedAt set). Match the live renderer.
          const litStars = stars.filter((s) => s.firstUnlockedAt !== null)
          const positions = allPositions.filter((p) => p.territory === type)

          const auraColor = TERRITORIES[type].color
          const labelText = TERRITORIES[type].name

          return (
            <g key={type} transform={`translate(${cx}, ${cy})`}>
              <circle
                r={radius}
                fill="none"
                stroke={auraColor}
                strokeWidth="1.5"
                opacity={litStars.length > 0 ? 0.4 : 0.15}
              />

              {litStars.map((s) => {
                const pos = positions.find((p) => p.tech_key === s.tech_key)
                if (!pos) return null
                const sx = (pos.x - 0.5) * 2 * radius
                const sy = (pos.y - 0.5) * 2 * radius
                const r = Math.min(10, 3 + Math.log(Math.max(1, s.weight)) * 2)
                const isHighlighted =
                  props.diffSince != null &&
                  s.firstUnlockedAt != null &&
                  s.firstUnlockedAt > props.diffSince
                const baseOpacity = isHighlighted ? 1 : 0.85
                return (
                  <g key={s.tech_key} transform={`translate(${sx}, ${sy})`}>
                    <circle r={r * 3} fill={auraColor} opacity={isHighlighted ? 0.16 : 0.06} />
                    <circle r={r * 2} fill={auraColor} opacity={isHighlighted ? 0.30 : 0.14} />
                    <circle r={r * 1.4} fill={auraColor} opacity={isHighlighted ? 0.55 : 0.35} />
                    <circle r={r} fill={auraColor} opacity={baseOpacity} />
                  </g>
                )
              })}

              {litStars.length > 0 && (
                <text
                  x={0}
                  y={radius + 22}
                  textAnchor="middle"
                  fontSize="14"
                  fill="#cbd5e1"
                  fontFamily="system-ui"
                >
                  {labelText}
                </text>
              )}

              {props.showHeroLabels !== false &&
                [...litStars]
                  .sort((a, b) => b.weight - a.weight || a.tech_key.localeCompare(b.tech_key))
                  .slice(0, 2)
                  .map((s) => {
                    const pos = positions.find((p) => p.tech_key === s.tech_key)
                    if (!pos) return null
                    const sx = (pos.x - 0.5) * 2 * radius
                    const sy = (pos.y - 0.5) * 2 * radius
                    const name = getPublicTech(s.tech_key)?.displayName ?? s.tech_key
                    return (
                      <text
                        key={`label-${s.tech_key}`}
                        x={sx + 10}
                        y={sy + 4}
                        fontSize="11"
                        fill="#e2e8f0"
                        fontFamily="system-ui"
                      >
                        {name}
                      </text>
                    )
                  })}
            </g>
          )
        })}

        <text
          x={width - 24}
          y={height - 20}
          textAnchor="end"
          fontSize="14"
          fill="#475569"
          fontFamily="system-ui"
        >
          ⭐ devastra.app
        </text>
      </svg>
    </div>
  )
}
