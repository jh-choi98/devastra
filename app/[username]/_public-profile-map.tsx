'use client'

import { useState, useCallback } from 'react'
import { Constellation } from '@/app/_components/Constellation/Constellation'
import { ClusterDrawer } from '@/app/_components/ClusterDrawer/ClusterDrawer'
import { PublicStickyBar } from '@/app/_components/PublicStickyBar'
import { getPublicTech } from '@/features/territories/tech-catalog-public'
import type { ConstellationData } from '@/app/_components/Constellation/Constellation'
import type { ClusterDrawerData } from '@/app/_components/ClusterDrawer/ClusterDrawer'
import type { TerritoryType } from '@/features/territories/registry'

function buildVisitorDrawerData(
  mapData: ConstellationData,
  type: TerritoryType,
): ClusterDrawerData | null {
  const territory = mapData.territories.find((t) => t.type === type)
  if (!territory) return null

  const litStars = mapData.landmarks
    .filter((l) => l.territory === type && l.firstUnlockedAt !== null)
    .sort((a, b) => b.weight - a.weight || a.tech_key.localeCompare(b.tech_key))
    .map((lm) => ({
      tech_key: lm.tech_key,
      displayName: getPublicTech(lm.tech_key)?.displayName ?? lm.tech_key,
      weight: lm.weight,
      firstUnlockedAt: lm.firstUnlockedAt,
      topContributingRepo: null,
      matchedRuleKinds: [] as string[],
      contributingRepos: [] as Array<{ owner: string; name: string; repoId: string; matchCount: number }>,
      activity: { commits: 0, prs: 0, issues: 0 },
    }))

  return {
    type,
    stage: territory.stage,
    growth30d: territory.growth30d,
    stageChangedAt: territory.stageChangedAt,
    litStars,
  }
}

export function PublicProfileMap({
  mapData,
  ownerUsername,
  drawerVariant,
  showStickyBar,
  renderer = 'webgl',
}: {
  mapData: ConstellationData
  ownerUsername?: string
  drawerVariant: 'owner' | 'visitor'
  showStickyBar: boolean
  renderer?: 'webgl' | 'svg'
}) {
  const [drawer, setDrawer] = useState<{
    cluster: TerritoryType
    focusedTechKey?: string
    drawerData: ClusterDrawerData | null
  } | null>(null)
  const [pulse, setPulse] = useState(false)
  const [hasOpenedDrawer, setHasOpenedDrawer] = useState(false)

  const triggerPulse = useCallback(() => {
    if (!hasOpenedDrawer && showStickyBar) {
      setHasOpenedDrawer(true)
      setPulse(true)
      setTimeout(() => setPulse(false), 1000)
    }
  }, [hasOpenedDrawer, showStickyBar])

  const handleClusterClick = useCallback(
    (type: TerritoryType) => {
      const drawerData = buildVisitorDrawerData(mapData, type)
      if (!drawerData) return
      setDrawer({ cluster: type, drawerData })
      triggerPulse()
    },
    [mapData, triggerPulse],
  )

  const handleStarClick = useCallback(
    (type: TerritoryType, tech_key: string) => {
      const drawerData = buildVisitorDrawerData(mapData, type)
      if (!drawerData) return
      setDrawer({ cluster: type, focusedTechKey: tech_key, drawerData })
      triggerPulse()
    },
    [mapData, triggerPulse],
  )

  const handleClose = useCallback(() => setDrawer(null), [])

  return (
    <div className="relative w-full h-full flex-1">
      <Constellation
        data={mapData}
        renderer={renderer}
        onClusterClick={handleClusterClick}
        onStarClick={handleStarClick}
      />
      {drawer && drawer.drawerData && (
        <ClusterDrawer
          data={drawer.drawerData}
          userId={mapData.userId}
          focusedTechKey={drawer.focusedTechKey}
          variant={drawerVariant}
          ownerUsername={ownerUsername}
          onClose={handleClose}
        />
      )}
      {showStickyBar && ownerUsername && (
        <PublicStickyBar inviterUsername={ownerUsername} pulse={pulse} />
      )}
    </div>
  )
}
