'use server'

import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { getUsableAccessToken } from '@/lib/github/token'
import { GitHubSourceClient } from '@/features/sync/sources/github'
import {
  getTopReposForTerritory,
  getRecentPRsForTerritory,
  type DrawerPR,
} from '@/lib/db/queries/drawer'
import { deriveInterpretation } from '@/app/_components/TerritoryDrawer/interpretation'
import type { TerritoryDrawerData } from '@/app/_components/TerritoryDrawer'
import type { TerritoryType } from '@/features/territories/registry'

const FetchPrTitlesSchema = z.object({
  prs: z
    .array(
      z.object({ owner: z.string(), repo: z.string(), number: z.number().int() }),
    )
    .max(10),
})

export async function fetchPrTitles(input: unknown): Promise<Record<string, string>> {
  const { prs } = FetchPrTitlesSchema.parse(input)
  const user = await requireUser()
  const token = await getUsableAccessToken(user.id)
  const client = new GitHubSourceClient(token, user.id)
  return client.fetchPullRequestTitles(prs)
}

export async function getDrawerData(
  territoryType: TerritoryType,
  stage: number,
  growth30d: number,
  totalWeight: number,
): Promise<{ drawerData: TerritoryDrawerData; prHandles: DrawerPR[] }> {
  const user = await requireUser()

  const [topRepos, recentPRs] = await Promise.all([
    getTopReposForTerritory(user.id, territoryType),
    getRecentPRsForTerritory(user.id, territoryType),
  ])

  const drawerData: TerritoryDrawerData = {
    type: territoryType,
    stage,
    growth30d,
    totalWeight,
    topRepos,
    recentPRs: recentPRs.map((pr) => ({ title: null, githubUrl: pr.githubUrl })),
    interpretation: '',
  }
  drawerData.interpretation = deriveInterpretation(drawerData)

  return { drawerData, prHandles: recentPRs }
}
