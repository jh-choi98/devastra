'use client'
import type { TerritoryType } from '@/features/territories/registry'
import { TERRITORIES } from '@/features/territories/registry'
import { Star } from './Star'
import { getClientStarPositions } from './star-positions'

export function Cluster(props: {
  type: TerritoryType
  radius: number
  stage: number
  growth30d: number
  stars: Array<{ tech_key: string; weight: number; firstUnlockedAt: string | null }>
  diffSince: string | null
  onClusterClick?: () => void
  onStarClick?: (tech_key: string) => void
}): JSX.Element {
  const { type, radius, stage, stars, diffSince, onClusterClick, onStarClick } = props
  const meta = TERRITORIES[type]
  const allPositions = getClientStarPositions()

  const litStars = stars.filter((s) => s.weight > 0)
  const litCount = litStars.length
  const outlineOpacity = litCount > 0 ? 0.6 : 0.25

  // Top 1-2 stars by weight get inline hero labels; tie-break by tech_key alphabetical
  const heroKeys = new Set(
    [...litStars]
      .sort((a, b) => b.weight - a.weight || a.tech_key.localeCompare(b.tech_key))
      .slice(0, 2)
      .map((s) => s.tech_key),
  )

  const labelY = radius + 18

  return (
    <g>
      {/* Cluster outline */}
      <circle
        r={radius}
        fill="none"
        stroke={meta.color}
        strokeWidth="1"
        opacity={outlineOpacity}
        aria-hidden="true"
      />

      {/* Cluster label — keyboard-focusable */}
      <g
        role="button"
        tabIndex={0}
        aria-label={`${meta.name} cluster, ${litCount} stars lit`}
        style={{ cursor: onClusterClick ? 'pointer' : 'default' }}
        onClick={onClusterClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClusterClick?.() }
        }}
      >
        <text
          y={labelY}
          textAnchor="middle"
          fontSize="13"
          fill="#94a3b8"
          fontFamily="system-ui, sans-serif"
          fontWeight="500"
        >
          {meta.name}
          {stage >= 2 && ` · Stage ${stage}`}
        </text>
      </g>

      {/* Stars — each rendered once; hero stars get inline label */}
      {litStars.map((star) => {
        const pos = allPositions.find((p) => p.tech_key === star.tech_key)
        if (!pos) return null
        const sx = (pos.x - 0.5) * radius * 2
        const sy = (pos.y - 0.5) * radius * 2
        const isNew =
          diffSince !== null &&
          star.firstUnlockedAt !== null &&
          star.firstUnlockedAt > diffSince

        return (
          <Star
            key={star.tech_key}
            tech_key={star.tech_key}
            x={sx}
            y={sy}
            weight={star.weight}
            color={meta.color}
            accentColor={meta.accentColor}
            isNew={isNew}
            heroLabel={heroKeys.has(star.tech_key) ? star.tech_key : undefined}
            onClick={onStarClick ? () => onStarClick(star.tech_key) : undefined}
          />
        )
      })}
    </g>
  )
}
