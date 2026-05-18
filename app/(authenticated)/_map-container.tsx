'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Constellation } from '@/app/_components/Constellation/Constellation'
import { ClusterDrawer } from '@/app/_components/ClusterDrawer/ClusterDrawer'
import { BannerStack } from '@/app/_components/StateBanners/BannerStack'
import { FirstEverStarCinematic } from '@/app/_components/SpecialMoments/FirstEverStarCinematic'
import { captureClientEvent } from '@/app/_components/posthog-lite'
import {
  isLatestSyncJobUpdate,
  useRealtimeMapData,
  type SyncJobUpdate,
} from '@/lib/realtime/use-realtime-map-data'
import { useRevealSequence } from './_use-reveal-sequence'
import { getDrawerData } from './_actions'
import { acknowledgeFirstEverCinematic } from '@/features/sync/cinematic-acknowledge'
import { RevealSequence } from '@/app/_components/Constellation/cinematics/RevealSequence'
import { isBlockingBuildJob, getBuildStatusCopy } from './_use-reveal-sequence'
import type { ConstellationData } from '@/app/_components/Constellation/Constellation'
import type { ClusterDrawerData } from '@/app/_components/ClusterDrawer/ClusterDrawer'
import type { TerritoryType } from '@/features/territories/registry'
import type { BannerState } from '@/app/_components/StateBanners/BannerStack'

export interface LivingMapContainerProps {
  userId: string
  initial: ConstellationData
  firstReveal: boolean
  bannerState: BannerState
  renderer?: 'webgl' | 'svg'
  initialSyncJob: SyncJobUpdate | null
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
  initialSyncJob,
  firstStarCinematicPending,
  firstStarCinematicSeen,
}: LivingMapContainerProps) {
  const router = useRouter()
  const [syncJobUpdate, setSyncJobUpdate] = useState<SyncJobUpdate | null>(initialSyncJob)
  const [syncFailedDismissed, setSyncFailedDismissed] = useState(false)
  const [showCinematic, setShowCinematic] = useState(false)
  const [showReveal, setShowReveal] = useState(firstReveal)
  const revealFiredRef = useRef(false)
  const cinematicCheckedRef = useRef(false)
  const wasBuildBlockingRef = useRef(false)

  const data = useRealtimeMapData(userId, initial, (update) => {
    setSyncJobUpdate((current) => (isLatestSyncJobUpdate(current, update) ? update : current))
  })

  const isBuildBlocking = isBlockingBuildJob(syncJobUpdate)
  const buildStatusCopy = getBuildStatusCopy(syncJobUpdate)

  useEffect(() => {
    if (!isBuildBlocking) return

    let cancelled = false
    const poll = async () => {
      try {
        const response = await fetch('/api/sync/latest-job', { cache: 'no-store' })
        if (!response.ok) return
        const latest = (await response.json()) as SyncJobUpdate | null
        if (!cancelled && latest) {
          setSyncJobUpdate((current) => (isLatestSyncJobUpdate(current, latest) ? latest : current))
        }
      } catch {
        // Realtime remains the primary path; polling is only a missed-event fallback.
      }
    }

    const pollTimer = setInterval(poll, 10_000)
    const firstPollTimer = setTimeout(poll, 5_000)
    return () => {
      cancelled = true
      clearInterval(pollTimer)
      clearTimeout(firstPollTimer)
    }
  }, [isBuildBlocking])

  useEffect(() => {
    const wasBuildBlocking = wasBuildBlockingRef.current
    if (
      wasBuildBlocking &&
      syncJobUpdate &&
      (syncJobUpdate.status === 'completed' || syncJobUpdate.status === 'failed')
    ) {
      router.refresh()
    }
    wasBuildBlockingRef.current = isBuildBlocking
  }, [isBuildBlocking, router, syncJobUpdate])

  const { revealComplete, syncProgressText } = useRevealSequence({
    firstReveal,
    syncJobUpdate,
    paused: isBuildBlocking,
  })

  useEffect(() => {
    if (firstReveal && revealComplete && !revealFiredRef.current) {
      revealFiredRef.current = true
      captureClientEvent('first_reveal.completed', { distinctId: userId })
    }
  }, [firstReveal, revealComplete, userId])

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

  const handleClusterClick = useCallback((type: TerritoryType) => openDrawer(type), [openDrawer])

  const handleStarClick = useCallback(
    (type: TerritoryType, tech_key: string) => openDrawer(type, tech_key),
    [openDrawer],
  )

  const handleClose = useCallback(() => {
    setDrawer(null)
  }, [])

  const showProgress =
    syncProgressText !== null && syncJobUpdate?.status === 'running' && !isBuildBlocking

  const syncFailed = syncJobUpdate?.status === 'failed' && !syncFailedDismissed

  const activeBannerState: BannerState = {
    ...bannerState,
    syncFailed,
  }

  const drawerDataForRender =
    drawer?.drawerData ??
    (drawer
      ? (() => {
          const territory = data.territories.find((t) => t.type === drawer.cluster)
          return {
            type: drawer.cluster,
            stage: territory?.stage ?? 1,
            growth30d: territory?.growth30d ?? 0,
            stageChangedAt: territory?.stageChangedAt ?? null,
            litStars: [],
          } satisfies ClusterDrawerData
        })()
      : null)

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
    <div className="relative h-full w-full">
      <div className="sr-only" role="status" aria-live="polite">
        Your constellation has {litStarCount} stars lit across {activeClusterCount} clusters.
      </div>
      <Constellation
        data={data}
        renderer={renderer}
        selectedCluster={drawer?.cluster ?? null}
        onClusterClick={handleClusterClick}
        onStarClick={handleStarClick}
        showBrightnessScale={!showReveal && !showCinematic && !isBuildBlocking}
      />

      <BannerStack state={activeBannerState} onRetry={() => setSyncFailedDismissed(false)} />

      {isBuildBlocking && buildStatusCopy && (
        <ConstellationBuildOverlay
          title={buildStatusCopy.title}
          body={buildStatusCopy.body}
          detail={buildStatusCopy.detail}
        />
      )}

      {showCinematic && (
        <FirstEverStarCinematic
          newStars={newStars}
          data={data}
          onComplete={handleCinematicComplete}
        />
      )}

      {showReveal && !showCinematic && !isBuildBlocking && (
        <RevealSequence
          litClusters={data.territories.filter((t) => t.stage > 1).map((t) => t.type)}
          onComplete={() => setShowReveal(false)}
        />
      )}

      {drawer && drawerDataForRender && (
        <ClusterDrawer
          data={drawerDataForRender}
          userId={userId}
          focusedTechKey={drawer.focusedTechKey}
          variant="owner"
          loading={drawer.loading}
          onClose={handleClose}
        />
      )}

      {showProgress && (
        <div className="pointer-events-none fixed bottom-4 left-4 text-xs text-slate-300 opacity-70">
          {syncProgressText}
        </div>
      )}
    </div>
  )
}

function ConstellationBuildOverlay({
  title,
  body,
  detail,
}: {
  title: string
  body: string
  detail: string
}) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-20 bg-slate-950/20 backdrop-blur-[1px]"
        aria-hidden="true"
      />
      <div
        role="status"
        aria-live="polite"
        className="bg-slate-950/72 pointer-events-none absolute bottom-4 right-4 z-30 w-[min(360px,calc(100%-2rem))] rounded-md border border-slate-500/25 px-4 py-3 text-slate-100 shadow-2xl shadow-black/30 backdrop-blur-md"
      >
        <div className="mb-3 flex items-center gap-3">
          <span className="relative flex h-3 w-3" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-200" />
          </span>
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <p className="text-sm leading-6 text-slate-300">{body}</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-px flex-1 overflow-hidden rounded bg-slate-700/80">
            <div className="h-full w-1/2 animate-[build-scan_1.8s_ease-in-out_infinite] bg-sky-200/80" />
          </div>
          <p className="shrink-0 text-xs text-slate-400">{detail}</p>
        </div>
      </div>
    </>
  )
}
