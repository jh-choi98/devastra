'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Constellation } from '@/app/_components/Constellation/Constellation'
import { ClusterDrawer } from '@/app/_components/ClusterDrawer/ClusterDrawer'
import { BannerStack } from '@/app/_components/StateBanners/BannerStack'
import { FirstEverStarCinematic } from '@/app/_components/SpecialMoments/FirstEverStarCinematic'
import { useRealtimeMapData, type SyncJobUpdate } from '@/lib/realtime/use-realtime-map-data'
import { useRevealSequence } from './_use-reveal-sequence'
import { getDrawerData } from './_actions'
import { acknowledgeFirstEverCinematic } from '@/features/sync/cinematic-acknowledge'
import { RevealSequence } from '@/app/_components/Constellation/cinematics/RevealSequence'
import { posthog, initPosthog } from '@/lib/posthog'
import type { ConstellationData } from '@/app/_components/Constellation/Constellation'
import type { ClusterDrawerData } from '@/app/_components/ClusterDrawer/ClusterDrawer'
import type { TerritoryType } from '@/features/territories/registry'
import type { BannerState } from '@/app/_components/StateBanners/BannerStack'

interface Props {
  userId: string
  initial: ConstellationData
  firstReveal: boolean
  bannerState: BannerState
  renderer?: 'webgl' | 'svg'
  firstStarCinematicPending: boolean
  firstStarCinematicSeen: boolean
  hintFlags: {
    clusterClickHintSeen: boolean
    shareHintSeen: boolean
    recapDiffHintSeen: boolean
  }
}

export function LivingMapContainer({
  userId,
  initial,
  firstReveal,
  bannerState,
  renderer = 'webgl',
  firstStarCinematicPending,
  firstStarCinematicSeen,
}: Props) {
  const [syncJobUpdate, setSyncJobUpdate] = useState<SyncJobUpdate | null>(null)
  const [syncFailedDismissed, setSyncFailedDismissed] = useState(false)
  const [showCinematic, setShowCinematic] = useState(false)
  const [showReveal, setShowReveal] = useState(firstReveal)
  const revealFiredRef = useRef(false)
  const cinematicCheckedRef = useRef(false)

  const data = useRealtimeMapData(userId, initial, (update) => {
    setSyncJobUpdate(update)
  })

  const { revealComplete, syncProgressText } = useRevealSequence({ firstReveal, syncJobUpdate })

  useEffect(() => {
    if (firstReveal && revealComplete && !revealFiredRef.current) {
      revealFiredRef.current = true
      initPosthog()
      posthog.capture('first_reveal.completed')
    }
  }, [firstReveal, revealComplete])

  // First-ever star cinematic check: client-side on mount (ADR-38).
  // FirstEverStarCinematic supersedes first-time reveal (per spec Notes).
  useEffect(() => {
    if (cinematicCheckedRef.current) return
    cinematicCheckedRef.current = true
    if (firstStarCinematicPending && !firstStarCinematicSeen) {
      setShowCinematic(true)
    }
  }, [firstStarCinematicPending, firstStarCinematicSeen])

  const handleCinematicComplete = useCallback(async () => {
    setShowCinematic(false)
    try {
      await acknowledgeFirstEverCinematic()
    } catch {
      // silent — flag will retry on next visit
    }
  }, [])

  const [drawer, setDrawer] = useState<{
    cluster: TerritoryType
    focusedTechKey?: string
    drawerData: ClusterDrawerData | null
    loading: boolean
  } | null>(null)

  const openDrawer = useCallback(
    async (type: TerritoryType, focusedTechKey?: string) => {
      const territory = data.territories.find((t) => t.type === type)
      if (!territory) return

      setDrawer({ cluster: type, focusedTechKey, drawerData: null, loading: true })

      try {
        const drawerData = await getDrawerData(
          type,
          territory.stage,
          territory.growth30d,
          territory.stageChangedAt,
        )
        setDrawer({ cluster: type, focusedTechKey, drawerData, loading: false })
      } catch {
        setDrawer(null)
      }
    },
    [data.territories],
  )

  const handleClusterClick = useCallback(
    (type: TerritoryType) => openDrawer(type),
    [openDrawer],
  )

  const handleStarClick = useCallback(
    (type: TerritoryType, tech_key: string) => openDrawer(type, tech_key),
    [openDrawer],
  )

  const handleClose = useCallback(() => {
    setDrawer(null)
  }, [])

  const showProgress =
    syncProgressText !== null && syncJobUpdate?.status === 'running'

  const syncFailed =
    syncJobUpdate?.status === 'failed' && !syncFailedDismissed

  const activeBannerState: BannerState = {
    ...bannerState,
    syncFailed,
  }

  // Newly lit stars from the current data — used if cinematic fires
  const newStars = data.landmarks
    .filter((l) => l.firstUnlockedAt != null)
    .map((l) => ({
      tech_key: l.tech_key,
      displayName: l.tech_key,
      territory: l.territory,
    }))

  const litStarCount = data.landmarks.length
  const activeClusterCount = data.territories.filter((t) => t.stage > 1).length

  return (
    <div className="relative w-full h-full">
      <div className="sr-only" role="status" aria-live="polite">
        Your constellation has {litStarCount} stars lit across {activeClusterCount} clusters.
      </div>
      <Constellation
        data={data}
        renderer={renderer}
        selectedCluster={drawer?.cluster ?? null}
        onClusterClick={handleClusterClick}
        onStarClick={handleStarClick}
      />

      <BannerStack
        state={activeBannerState}
        onRetry={() => setSyncFailedDismissed(false)}
      />

      {showCinematic && (
        <FirstEverStarCinematic
          newStars={newStars}
          data={data}
          onComplete={handleCinematicComplete}
        />
      )}

      {showReveal && !showCinematic && (
        <RevealSequence
          litClusters={data.territories.filter(t => t.stage > 1).map(t => t.type)}
          onComplete={() => setShowReveal(false)}
        />
      )}

      {drawer && drawer.drawerData && !drawer.loading && (
        <ClusterDrawer
          data={drawer.drawerData}
          userId={userId}
          focusedTechKey={drawer.focusedTechKey}
          variant="owner"
          onClose={handleClose}
        />
      )}

      {showProgress && (
        <div className="fixed bottom-4 left-4 text-xs text-slate-300 opacity-70 pointer-events-none">
          {syncProgressText}
        </div>
      )}
    </div>
  )
}
