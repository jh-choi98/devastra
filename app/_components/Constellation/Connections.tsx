'use client'
import { useMemo } from 'react'
import { getClientStarPositions } from './star-positions'
import type { TerritoryType } from '@/features/territories/registry'

export function Connections(props: {
  type: TerritoryType
  stars: Array<{ tech_key: string; weight: number; firstUnlockedAt: string | null }>
  radius: number
}): JSX.Element | null {
  const { stars, radius } = props

  const edges = useMemo(() => {
    // Match Cluster.tsx — "lit" means crossed the unlock threshold (firstUnlockedAt set).
    const litStars = stars.filter((s) => s.firstUnlockedAt !== null)
    if (litStars.length < 2) return []

    const allPositions = getClientStarPositions()
    const positions = litStars
      .map((s) => {
        const pos = allPositions.find((p) => p.tech_key === s.tech_key)
        if (!pos) return null
        return {
          tech_key: s.tech_key,
          x: (pos.x - 0.5) * radius * 2,
          y: (pos.y - 0.5) * radius * 2,
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)

    if (positions.length < 2) return []

    // Prim's MST — O(n²), n ≤ ~30
    const inMST = new Set<number>()
    const mstEdges: Array<[number, number]> = []
    inMST.add(0)

    while (inMST.size < positions.length) {
      let minDist = Infinity
      let minI = -1
      let minJ = -1
      for (const i of Array.from(inMST)) {
        for (let j = 0; j < positions.length; j++) {
          if (inMST.has(j)) continue
          const dx = positions[i].x - positions[j].x
          const dy = positions[i].y - positions[j].y
          const d = dx * dx + dy * dy
          if (d < minDist) {
            minDist = d
            minI = i
            minJ = j
          }
        }
      }
      if (minJ === -1) break
      inMST.add(minJ)
      mstEdges.push([minI, minJ])
    }

    return mstEdges.map(([i, j]) => ({
      x1: positions[i].x,
      y1: positions[i].y,
      x2: positions[j].x,
      y2: positions[j].y,
    }))
  }, [stars, radius])

  if (edges.length === 0) return null

  return (
    <>
      {edges.map((e, i) => (
        <line
          key={i}
          x1={e.x1.toFixed(2)}
          y1={e.y1.toFixed(2)}
          x2={e.x2.toFixed(2)}
          y2={e.y2.toFixed(2)}
          stroke="#475569"
          strokeWidth="1"
          opacity="0.4"
          aria-hidden="true"
        />
      ))}
    </>
  )
}
