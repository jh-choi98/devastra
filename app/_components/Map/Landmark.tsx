'use client'

import { getPublicTech } from '@/features/territories/tech-catalog-public'

export function Landmark(props: {
  tech_key: string
  x: number
  y: number
  size: number
  color: string
  recentlyUnlocked: boolean
}): JSX.Element {
  const { tech_key, x, y, size, color, recentlyUnlocked } = props
  const entry = getPublicTech(tech_key)
  const label = entry?.landmarkName ?? tech_key
  const r = size / 2

  return (
    <g transform={`translate(${x.toFixed(2)}, ${y.toFixed(2)})`}>
      <title>{label}</title>
      {recentlyUnlocked && (
        <circle r={r + 4} fill="none" stroke="#FCD34D" strokeWidth="2" opacity="0.8" />
      )}
      <circle r={r} fill={color} opacity="0.85" />
    </g>
  )
}
