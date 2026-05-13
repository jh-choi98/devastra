'use client'

import { motion } from 'framer-motion'
import { TERRITORIES } from '@/features/territories/registry'
import type { TerritoryType } from '@/features/territories/registry'
import { generateIslandShape } from './island-shape'
import { placeLandmarks } from './landmark-placement'
import { Landmark } from './Landmark'

export function Island(props: {
  type: TerritoryType
  stage: number
  growth30d: number
  totalWeight: number
  recentlyGrown: boolean
  landmarks: Array<{ tech_key: string; weight: number; firstUnlockedAt: string | null }>
  userId: string
  onClick?: () => void
}): JSX.Element {
  const { type, stage, growth30d, totalWeight, recentlyGrown, landmarks, userId, onClick } = props
  const territory = TERRITORIES[type]
  const islandSeed = `${userId}:${type}`

  const shape = generateIslandShape({ seed: islandSeed, stage })
  const placed = placeLandmarks({
    islandSeed,
    islandRadius: shape.radius,
    landmarks: landmarks.map(({ tech_key, weight }) => ({ tech_key, weight })),
  })

  const growthPct = totalWeight > 0 ? Math.round((growth30d / totalWeight) * 100) : 0
  const labelY = shape.radius + 22
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  return (
    <motion.g
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {recentlyGrown && (
        <circle
          r={shape.radius + 10}
          fill="none"
          stroke={territory.color}
          strokeWidth="4"
          opacity="0.4"
          filter="url(#glow)"
        />
      )}
      <path d={shape.pathD} fill={territory.color} stroke={territory.color} strokeWidth="1" />
      {placed.map((lm) => {
        const lmData = landmarks.find((l) => l.tech_key === lm.tech_key)
        const recentlyUnlocked = Boolean(
          lmData?.firstUnlockedAt && lmData.firstUnlockedAt > sevenDaysAgo,
        )
        return (
          <Landmark
            key={lm.tech_key}
            tech_key={lm.tech_key}
            x={lm.x}
            y={lm.y}
            size={lm.size}
            color={territory.landmarkColor}
            recentlyUnlocked={recentlyUnlocked}
          />
        )
      })}
      <text
        y={labelY}
        textAnchor="middle"
        fontSize="13"
        fill="#e2e8f0"
        fontFamily="system-ui, sans-serif"
        fontWeight="500"
      >
        {territory.name}{'  '}Stage {stage}
      </text>
      {recentlyGrown && growthPct > 0 && (
        <foreignObject x={-44} y={labelY + 8} width={88} height={24}>
          <div
            // @ts-expect-error xmlns needed for SVG foreignObject in some renderers
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              backgroundColor: territory.color,
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '4px',
              padding: '2px 6px',
              textAlign: 'center' as const,
              whiteSpace: 'nowrap' as const,
            }}
          >
            +{growthPct}% this week
          </div>
        </foreignObject>
      )}
    </motion.g>
  )
}
