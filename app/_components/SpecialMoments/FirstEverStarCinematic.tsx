'use client'

import { useEffect } from 'react'
import { useReducedMotion } from '@/app/_components/Constellation/SparkAnimation'
import type { ConstellationData } from '@/app/_components/Constellation/Constellation'

export function FirstEverStarCinematic(props: {
  /** The newly-lit stars (from this sync run). */
  newStars: Array<{ tech_key: string; displayName: string; territory: string }>
  data: ConstellationData
  onComplete: () => void
}): JSX.Element {
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const duration = prefersReducedMotion ? 2_000 : 8_000

    // 8s sequence (reduced-motion: 2s):
    //   1. All 6 cluster outlines slightly brighten (0 → 0.5 opacity in 0.5s).
    //   2. Newly lit star(s) spark in with 0.3s stagger between stars.
    //   3. Strip copy fades in: "Your first star lit: {displayName}" (single)
    //      or "Your first stars: {names}" (multi), then "Your constellation has begun".
    //   4. Long glow on each new star persists.
    //   5. Only clusters containing new stars retain activation; others revert to dim.
    // Not dismissible. ESC does nothing.
    const timer = setTimeout(() => {
      props.onComplete()
    }, duration)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion])

  return null as unknown as JSX.Element
}
