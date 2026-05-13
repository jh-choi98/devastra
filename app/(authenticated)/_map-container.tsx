'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { LivingMap } from '@/app/_components/Map/LivingMap'
import { TerritoryDrawer } from '@/app/_components/TerritoryDrawer'
import { useRealtimeMapData, type SyncJobUpdate } from '@/lib/realtime/use-realtime-map-data'
import { useRevealSequence } from './_use-reveal-sequence'
import { getDrawerData, fetchPrTitles } from './_actions'
import { posthog, initPosthog } from '@/lib/posthog'
import type { MapData } from '@/app/_components/Map/LivingMap'
import type { TerritoryDrawerData } from '@/app/_components/TerritoryDrawer'
import type { TerritoryType } from '@/features/territories/registry'

interface Props {
  userId: string
  initial: MapData
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

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTerritory, setDrawerTerritory] = useState<TerritoryType | null>(null)
  const [drawerData, setDrawerData] = useState<TerritoryDrawerData | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)

  const handleIslandClick = useCallback(
    async (type: TerritoryType) => {
      const territory = data.territories.find((t) => t.type === type)
      if (!territory) return

      setDrawerTerritory(type)
      setDrawerOpen(true)
      setDrawerLoading(true)
      setDrawerData(null)

      try {
        const { drawerData: base, prHandles } = await getDrawerData(
          type,
          territory.stage,
          territory.growth30d,
          territory.totalWeight,
        )
        setDrawerData(base)
        setDrawerLoading(false)

        if (prHandles.length > 0) {
          const titles = await fetchPrTitles({ prs: prHandles })
          setDrawerData((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              recentPRs: prev.recentPRs.map((pr, i) => {
                const handle = prHandles[i]
                if (!handle) return pr
                const key = `${handle.owner}/${handle.repo}#${handle.number}`
                return { ...pr, title: titles[key] ?? pr.title }
              }),
            }
          })
        }
      } catch {
        setDrawerLoading(false)
      }
    },
    [data.territories],
  )

  const handleClose = useCallback(() => {
    setDrawerOpen(false)
  }, [])

  const showProgress =
    syncProgressText !== null && syncJobUpdate?.status === 'running'

  return (
    <div className="relative w-full h-full">
      <LivingMap data={data} onIslandClick={handleIslandClick} />
      <TerritoryDrawer
        open={drawerOpen && !drawerLoading}
        territory={drawerTerritory}
        data={drawerData}
        onClose={handleClose}
      />
      {showProgress && (
        <div className="fixed bottom-4 left-4 text-xs text-slate-300 opacity-70 pointer-events-none">
          {syncProgressText}
        </div>
      )}
    </div>
  )
}
