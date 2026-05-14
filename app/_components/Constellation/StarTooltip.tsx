'use client'
import { useState } from 'react'

export function StarTooltip(props: {
  tech_key: string
  displayName: string
  weight: number
  firstUnlockedAt: string | null
  anchorRef: React.RefObject<SVGGElement>
}): JSX.Element {
  const { displayName, weight, firstUnlockedAt } = props
  const [visible, setVisible] = useState(false)

  // Brightness descriptor by weight quintile (rough heuristic)
  const brightness = weight >= 80 ? 'brightest' : weight >= 30 ? 'bright' : 'dim'

  const sinceLabel = firstUnlockedAt
    ? new Date(firstUnlockedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  return (
    <div
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      style={{ display: 'contents' }}
    >
      {visible && (
        <div
          style={{
            position: 'absolute',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '12px',
            color: '#e2e8f0',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 50,
          }}
        >
          {displayName} · {brightness}
          {sinceLabel && ` · since ${sinceLabel}`}
        </div>
      )}
    </div>
  )
}
