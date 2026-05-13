import 'server-only'

import { and, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { activities } from '@/lib/db/schema/activities'
import { activityTerritories } from '@/lib/db/schema/activity-territories'
import { repositories } from '@/lib/db/schema/repositories'

export type DrawerRepo = { owner: string; name: string; githubUrl: string }
export type DrawerPR = { githubUrl: string; owner: string; repo: string; number: number }

export async function getTopReposForTerritory(
  userId: string,
  territoryType: string,
): Promise<DrawerRepo[]> {
  const rows = await db
    .select({
      owner: repositories.owner,
      name: repositories.name,
      activityCount: count(),
    })
    .from(activities)
    .innerJoin(repositories, eq(repositories.id, activities.repoId))
    .innerJoin(activityTerritories, eq(activityTerritories.activityId, activities.id))
    .where(
      and(
        eq(activities.userId, userId),
        eq(activityTerritories.territoryType, territoryType),
      ),
    )
    .groupBy(repositories.owner, repositories.name)
    .orderBy(desc(count()))
    .limit(2)

  return rows.map((r) => ({
    owner: r.owner,
    name: r.name,
    githubUrl: `https://github.com/${r.owner}/${r.name}`,
  }))
}

export async function getRecentPRsForTerritory(
  userId: string,
  territoryType: string,
): Promise<DrawerPR[]> {
  const rows = await db
    .select({
      githubUrl: sql<string>`${activities.raw}->>'github_url'`,
    })
    .from(activities)
    .innerJoin(activityTerritories, eq(activityTerritories.activityId, activities.id))
    .where(
      and(
        eq(activities.userId, userId),
        eq(activityTerritories.territoryType, territoryType),
        eq(activities.type, 'pr'),
      ),
    )
    .orderBy(desc(activities.occurredAt))
    .limit(3)

  const result: DrawerPR[] = []
  for (const row of rows) {
    if (!row.githubUrl) continue
    const parsed = parsePrUrl(row.githubUrl)
    if (parsed) result.push({ githubUrl: row.githubUrl, ...parsed })
  }
  return result
}

function parsePrUrl(url: string): { owner: string; repo: string; number: number } | null {
  const match = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(url)
  if (!match) return null
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) }
}
