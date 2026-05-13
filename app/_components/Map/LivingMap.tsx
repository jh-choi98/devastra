'use client'

import { motion } from 'framer-motion'
import { Island } from './Island'
import { ALL_TERRITORY_TYPES } from '@/features/territories/registry'
import type { TerritoryType } from '@/features/territories/registry'

export type MapData = {
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
  diffSince?: Date | null
}

// 12, 2, 4, 6, 8, 10 o'clock in degrees clockwise from top
const CLOCK_ANGLES_DEG = [0, 60, 120, 180, 240, 300]
const CENTER_X = 500
const CENTER_Y = 350
const ORBIT_RADIUS = 230

function getIslandPosition(index: number): [number, number] {
  const rad = (CLOCK_ANGLES_DEG[index] * Math.PI) / 180
  return [
    CENTER_X + ORBIT_RADIUS * Math.sin(rad),
    CENTER_Y - ORBIT_RADIUS * Math.cos(rad),
  ]
}

export function LivingMap({
  data,
  onIslandClick,
}: {
  data: MapData
  onIslandClick?: (territory: TerritoryType) => void
}) {
  const diffThreshold =
    data.diffSince instanceof Date
      ? data.diffSince.toISOString()
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  return (
    <div className="relative w-full h-full min-h-[500px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
      <motion.svg
        viewBox="0 0 1000 700"
        className="w-full h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="ocean" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>
        </defs>
        <rect width="1000" height="700" fill="url(#ocean)" />
        {ALL_TERRITORY_TYPES.map((type, i) => {
          const territory = data.territories.find((t) => t.type === type)
          if (!territory) return null

          const territoryLandmarks = data.landmarks.filter((l) => l.territory === type)
          const [cx, cy] = getIslandPosition(i)
          const recentlyGrown =
            territory.stageChangedAt != null &&
            territory.stageChangedAt > diffThreshold &&
            territory.growth30d > 0

          return (
            <motion.g
              key={type}
              transform={`translate(${cx.toFixed(1)}, ${cy.toFixed(1)})`}
              layout
            >
              <Island
                type={type}
                stage={territory.stage}
                growth30d={territory.growth30d}
                totalWeight={territory.totalWeight}
                recentlyGrown={recentlyGrown}
                landmarks={territoryLandmarks.map((l) => ({
                  tech_key: l.tech_key,
                  weight: l.weight,
                  firstUnlockedAt: l.firstUnlockedAt,
                }))}
                userId={data.userId}
                onClick={onIslandClick ? () => onIslandClick(type) : undefined}
              />
            </motion.g>
          )
        })}
      </motion.svg>
    </div>
  )
}
