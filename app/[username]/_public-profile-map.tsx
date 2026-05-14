'use client'

import { useState, useCallback } from 'react'
import { Constellation } from '@/app/_components/Constellation/Constellation'
import { ClusterDrawer } from '@/app/_components/ClusterDrawer/ClusterDrawer'
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
    .filter((l) => l.territory === type && l.weight >= 5)
    .sort((a, b) => b.weight - a.weight || a.tech_key.localeCompare(b.tech_key))
    .map((lm) => ({
      tech_key: lm.tech_key,
      displayName: getPublicTech(lm.tech_key)?.displayName ?? lm.tech_key,
      weight: lm.weight,
      firstUnlockedAt: lm.firstUnlockedAt,
      topContributingRepo: null,
      // Visitor: no detection rule details or repo breakdown exposed
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
}: {
  mapData: ConstellationData
  ownerUsername?: string
}) {
  const [drawer, setDrawer] = useState<{
    cluster: TerritoryType
    focusedTechKey?: string
    drawerData: ClusterDrawerData | null
  } | null>(null)

  const handleClusterClick = useCallback(
    (type: TerritoryType) => {
      const drawerData = buildVisitorDrawerData(mapData, type)
      if (!drawerData) return
      setDrawer({ cluster: type, drawerData })
    },
    [mapData],
  )

  const handleStarClick = useCallback(
    (type: TerritoryType, tech_key: string) => {
      const drawerData = buildVisitorDrawerData(mapData, type)
      if (!drawerData) return
      setDrawer({ cluster: type, focusedTechKey: tech_key, drawerData })
    },
    [mapData],
  )

  const handleClose = useCallback(() => setDrawer(null), [])

  return (
    <div className="relative w-full h-full flex-1">
      <Constellation
        data={mapData}
        onClusterClick={handleClusterClick}
        onStarClick={handleStarClick}
      />
      {drawer && drawer.drawerData && (
        <ClusterDrawer
          data={drawer.drawerData}
          userId={mapData.userId}
          focusedTechKey={drawer.focusedTechKey}
          variant="visitor"
          ownerUsername={ownerUsername}
          onClose={handleClose}
        />
      )}
    </div>
  )
}
