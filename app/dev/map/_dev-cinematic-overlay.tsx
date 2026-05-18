'use client'

import { useState, useEffect } from 'react'
import { FirstEverCinematic } from '@/app/_components/Constellation/cinematics/FirstEverCinematic'
import { RevealSequence } from '@/app/_components/Constellation/cinematics/RevealSequence'
import type { TerritoryType } from '@/features/territories/registry'

interface Props {
  cinematic: string
  techKeys?: string[]
  litClusters?: TerritoryType[]
}

export function DevCinematicOverlay({ cinematic, techKeys = [], litClusters = [] }: Props) {
  const [visible, setVisible] = useState(true)

  // For the spark visual test: show FirstEverCinematic with the specified tech keys.
  // The spark rings in the canvas fire via SparkSequence (initiated by useDataDiff),
  // while the DOM strip copy is shown here.
  if (!visible) return null

  if (cinematic === 'spark' && techKeys.length > 0) {
    const landmarks = techKeys.map(k => ({ tech_key: k, displayName: k }))
    return (
      <FirstEverCinematic
        firstStarLandmarks={landmarks}
        onComplete={() => setVisible(false)}
      />
    )
  }

  if (cinematic === 'stage-up') {
    return (
      <RevealSequence
        litClusters={litClusters}
        onComplete={() => setVisible(false)}
      />
    )
  }

  return null
}

/** Client shim: show a badge noting the cinematic param is active. */
export function DevCinematicBadge({ cinematic }: { cinematic: string }) {
  useEffect(() => {
    // No-op — just confirms the component mounts without error
  }, [cinematic])

  return (
    <div className="fixed top-4 left-4 z-50 rounded bg-slate-800/80 px-3 py-1 text-xs text-slate-300 pointer-events-none">
      dev: cinematic={cinematic}
    </div>
  )
}
