'use client'
import { motion } from 'framer-motion'
import { getPublicTech } from '@/features/territories/tech-catalog-public'
import { SPARK_VARIANTS, useReducedMotion } from './SparkAnimation'

export function Star(props: {
  tech_key: string
  x: number
  y: number
  weight: number
  color: string
  accentColor: string
  /** True if first_unlocked_at is more recent than the diff threshold. Triggers spark. */
  isNew: boolean
  /** Whether the simplified SVG fallback should show the star label. */
  showLabel?: boolean
  onClick?: () => void
}): JSX.Element {
  const { tech_key, x, y, weight, color, accentColor, isNew, showLabel, onClick } = props
  const entry = getPublicTech(tech_key)
  const label = entry?.displayName ?? tech_key

  // Size scales with weight: r = min(12, 4 + log(max(1, weight)) * 2.5)
  const r = Math.min(12, 4 + Math.log(Math.max(1, weight)) * 2.5)
  const hitR = Math.max(r, 12)
  const reducedMotion = useReducedMotion()

  return (
    <g data-testid={`star-${tech_key}`} transform={`translate(${x.toFixed(2)}, ${y.toFixed(2)})`} aria-hidden="true" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {/* Decorative glow layers — aria-hidden, semantics live at cluster <g> */}
      <circle r={r * 3} fill={color} opacity="0.08" aria-hidden="true" />
      <circle r={r * 2} fill={color} opacity="0.18" aria-hidden="true" />
      <circle r={r * 1.4} fill={color} opacity="0.4" aria-hidden="true" />
      {isNew ? (
        <motion.circle
          r={r}
          fill={accentColor}
          variants={SPARK_VARIANTS}
          initial="initial"
          animate={reducedMotion ? 'settle' : ['flash', 'settle']}
          aria-hidden="true"
        />
      ) : (
        <circle r={r} fill={accentColor} aria-hidden="true" />
      )}
      {/* Touch-friendly hit area */}
      <circle r={hitR} fill="transparent" />
      {showLabel && (
        <text
          x={r + 8}
          y="0.35em"
          fontSize="11"
          fill="#e2e8f0"
          fontFamily="system-ui, sans-serif"
          fontWeight="500"
          pointerEvents="none"
          aria-hidden="true"
        >
          {label}
        </text>
      )}
    </g>
  )
}
