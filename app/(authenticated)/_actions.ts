'use server'

import { requireUser } from '@/lib/auth/session'
import { getClusterDrawerData } from '@/lib/db/queries/drawer'
import type { ClusterDrawerData } from '@/app/_components/ClusterDrawer/ClusterDrawer'
import type { TerritoryType } from '@/features/territories/registry'

export async function getDrawerData(
  territoryType: TerritoryType,
  stage: number,
  growth30d: number,
  stageChangedAt: string | null,
): Promise<ClusterDrawerData> {
  const user = await requireUser()
  return getClusterDrawerData(user.id, territoryType, stage, growth30d, stageChangedAt)
}
