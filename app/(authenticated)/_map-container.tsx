'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Constellation } from '@/app/_components/Constellation/Constellation'
import { ClusterDrawer } from '@/app/_components/ClusterDrawer/ClusterDrawer'
import { useRealtimeMapData, type SyncJobUpdate } from '@/lib/realtime/use-realtime-map-data'
import { useRevealSequence } from './_use-reveal-sequence'
import { getDrawerData } from './_actions'
import { posthog, initPosthog } from '@/lib/posthog'
import type { ConstellationData } from '@/app/_components/Constellation/Constellation'
import type { ClusterDrawerData } from '@/app/_components/ClusterDrawer/ClusterDrawer'
import type { TerritoryType } from '@/features/territories/registry'

interface Props {
  userId: string
  initial: ConstellationData
  firstReveal: boolean
}

export function LivingMapContainer({ userId, initial, firstReveal }: Props) {
  const [syncJobUpdate, setSyncJobUpdate] = useState<SyncJobUpdate | null>(null)
  const revealFiredRef = useRef(false)

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

  return (
    <div className="relative w-full h-full">
      <Constellation
        data={data}
        onClusterClick={handleClusterClick}
        onStarClick={handleStarClick}
      />
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
