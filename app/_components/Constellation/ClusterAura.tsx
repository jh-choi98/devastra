'use client'
import { motion } from 'framer-motion'
import { TERRITORIES } from '@/features/territories/registry'
import type { TerritoryType } from '@/features/territories/registry'

export function ClusterAura(props: {
  type: TerritoryType
  radius: number
  stage: number
  stageChangedAt: string | null
  diffSince: string | null
}): JSX.Element {
  const { type, radius, stage, stageChangedAt, diffSince } = props
  const meta = TERRITORIES[type]
  const color = meta.color

  // Intensity scales with stage: stage 1 → 0.05, stage 5 → 0.20
  const intensity = 0.05 + ((stage - 1) / 4) * 0.15

  const showRipple =
    stageChangedAt !== null &&
    diffSince !== null &&
    stageChangedAt > diffSince

  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
      : false

  const gradId = `aura-${type}`

  return (
    <>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity={intensity} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r={radius} fill={`url(#${gradId})`} aria-hidden="true" />
      {showRipple && !prefersReducedMotion && (
        <motion.circle
          r={radius * 0.5}
          fill="none"
          stroke={color}
          strokeWidth="2"
          opacity={0.6}
          animate={{ r: radius * 1.2, opacity: 0 }}
          initial={{ r: radius * 0.5, opacity: 0.6 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          aria-hidden="true"
        />
      )}
      {showRipple && prefersReducedMotion && (
        <circle
          r={radius * 1.2}
          fill="none"
          stroke={color}
          strokeWidth="2"
          opacity={intensity + 0.1}
          aria-hidden="true"
        />
      )}
    </>
  )
}
