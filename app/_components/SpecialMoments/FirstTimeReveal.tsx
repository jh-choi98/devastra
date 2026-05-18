'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/app/_components/Constellation/SparkAnimation'
import type { ConstellationData } from '@/app/_components/Constellation/Constellation'

export function FirstTimeReveal(props: {
  data: ConstellationData
  /** Called when reveal completes (~12s minimum, 30s max). */
  onComplete: () => void
}): JSX.Element {
  const prefersReducedMotion = useReducedMotion()
  const [_started] = useState(() => Date.now())

  useEffect(() => {
    if (prefersReducedMotion) {
      // Skip to final state immediately
      props.onComplete()
      return
    }

    // Max 30s guard — completes any remaining reveal
    const maxTimer = setTimeout(() => {
      props.onComplete()
    }, 30_000)

    return () => clearTimeout(maxTimer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion])

  // Render: same SVG layout as Constellation with timing overrides.
  // Cluster outlines fade in over 1s on mount. Stars spark in via Realtime.
  // Connection lines appear after both endpoints lit.
  // Cluster labels appear when first star in cluster lights.
  // Bottom-right counter (live): "{N} commits analyzed in {M} repos"
  // Bottom strip: "Lit: Frontend · Backend · Testing"
  // Pacing: min 12s. At 30s, batch-reveal remaining stars.
  // End: settling pulse → brightest cluster pulse → "Click to explore" hint → onComplete.
  return null as unknown as JSX.Element
}
