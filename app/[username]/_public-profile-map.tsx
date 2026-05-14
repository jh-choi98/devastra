'use client'

import { useState, useCallback } from 'react'
import { Constellation } from '@/app/_components/Constellation/Constellation'
import { TerritoryDrawer } from '@/app/_components/TerritoryDrawer'
import { TERRITORIES } from '@/features/territories/registry'
import type { ConstellationData } from '@/app/_components/Constellation/Constellation'
import type { TerritoryDrawerData } from '@/app/_components/TerritoryDrawer'
import type { TerritoryType } from '@/features/territories/registry'

export function PublicProfileMap({ mapData }: { mapData: ConstellationData }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTerritory, setDrawerTerritory] = useState<TerritoryType | null>(null)
  const [drawerData, setDrawerData] = useState<TerritoryDrawerData | null>(null)

  const handleClusterClick = useCallback(
    (type: TerritoryType) => {
      const territory = mapData.territories.find((t) => t.type === type)
      if (!territory) return

      const info = TERRITORIES[type]
      const stagesLabel =
        territory.stage >= 2
          ? `Stage ${territory.stage} — growing territory`
          : `Stage ${territory.stage} — early territory`

      setDrawerTerritory(type)
      setDrawerData({
        type,
        stage: territory.stage,
        growth30d: territory.growth30d,
        totalWeight: territory.totalWeight,
        topRepos: [],
        recentPRs: [],
        interpretation: `${info.name} is at ${stagesLabel} with ${Math.round(territory.totalWeight)} contribution points.`,
      })
      setDrawerOpen(true)
    },
    [mapData.territories],
  )

  const handleClose = useCallback(() => {
    setDrawerOpen(false)
  }, [])

  return (
    <div className="relative w-full h-full flex-1">
      <Constellation data={mapData} onClusterClick={handleClusterClick} />
      <TerritoryDrawer
        open={drawerOpen}
        territory={drawerTerritory}
        data={drawerData}
        onClose={handleClose}
      />
    </div>
  )
}
