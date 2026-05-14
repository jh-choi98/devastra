import 'server-only'

import { and, count, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { activities } from '@/lib/db/schema/activities'
import { activityTerritories } from '@/lib/db/schema/activity-territories'
import { landmarks } from '@/lib/db/schema/landmarks'
import { repositories } from '@/lib/db/schema/repositories'
import { withUserScope, withUserScopeAnd } from './_helpers'
import type { TerritoryType } from '@/features/territories/registry'

// ── Landmark unlock threshold (mirrors rules.ts) ────────────────────────────
const UNLOCK_WEIGHT = 5

export type ClusterDrawerLitStar = {
  tech_key: string
  displayName: string
  weight: number
  firstUnlockedAt: string | null
  topContributingRepo: { owner: string; name: string; repoId: string } | null
  matchedRuleKinds: string[]
  contributingRepos: Array<{ owner: string; name: string; repoId: string; matchCount: number }>
  activity: { commits: number; prs: number; issues: number }
}

export type ClusterDrawerData = {
  type: TerritoryType
  stage: number
  growth30d: number
  stageChangedAt: string | null
  litStars: ClusterDrawerLitStar[]
}

export async function getClusterDrawerData(
  userId: string,
  territoryType: TerritoryType,
  stage: number,
  growth30d: number,
  stageChangedAt: string | null,
): Promise<ClusterDrawerData> {
  // 1. Fetch lit landmarks (weight >= unlock threshold), sorted by weight DESC then techKey ASC
  const litLandmarks = await db
    .select({
      techKey: landmarks.techKey,
      weight: landmarks.weight,
      firstUnlockedAt: landmarks.firstUnlockedAt,
    })
    .from(landmarks)
    .where(
      withUserScopeAnd(
        userId,
        landmarks.userId,
        eq(landmarks.territoryType, territoryType),
        gte(landmarks.weight, String(UNLOCK_WEIGHT)),
      ),
    )
    .orderBy(desc(landmarks.weight), landmarks.techKey)

  if (litLandmarks.length === 0) {
    return { type: territoryType, stage, growth30d, stageChangedAt, litStars: [] }
  }

  // 2. For each landmark, fetch per-repo activity counts
  const techKeys = litLandmarks.map((l) => l.techKey)

  // Query activity counts grouped by (techKey, repoId, type)
  const activityRows = await db
    .select({
      techKey: activityTerritories.territoryType, // we use territory, not techKey directly
      repoId: activities.repoId,
      type: activities.type,
      repoOwner: repositories.owner,
      repoName: repositories.name,
      cnt: count(),
    })
    .from(activities)
    .innerJoin(repositories, eq(repositories.id, activities.repoId))
    .innerJoin(activityTerritories, eq(activityTerritories.activityId, activities.id))
    .where(
      withUserScopeAnd(
        userId,
        activities.userId,
        eq(activityTerritories.territoryType, territoryType),
      ),
    )
    .groupBy(
      activityTerritories.territoryType,
      activities.repoId,
      activities.type,
      repositories.owner,
      repositories.name,
    )

  // 3. Per-repo totals for the cluster (to resolve topContributingRepo per star)
  //    Since file-level tech_key mapping isn't stored, we approximate:
  //    top repo per star = the repo with most total activities in this cluster.
  const repoTotals: Map<string, { owner: string; name: string; repoId: string; total: number }> =
    new Map()
  const activityTypeCountByRepo: Map<string, { commits: number; prs: number; issues: number }> =
    new Map()

  for (const row of activityRows) {
    const key = row.repoId
    const existing = repoTotals.get(key)
    const n = Number(row.cnt)
    if (existing) {
      existing.total += n
    } else {
      repoTotals.set(key, {
        owner: row.repoOwner,
        name: row.repoName,
        repoId: row.repoId,
        total: n,
      })
    }

    const typeMap = activityTypeCountByRepo.get(key) ?? { commits: 0, prs: 0, issues: 0 }
    if (row.type === 'commit' || row.type === 'push') typeMap.commits += n
    else if (row.type === 'pr') typeMap.prs += n
    else if (row.type === 'issue') typeMap.issues += n
    activityTypeCountByRepo.set(key, typeMap)
  }

  const sortedRepos = Array.from(repoTotals.values()).sort((a, b) => b.total - a.total)
  const topRepo = sortedRepos[0] ?? null

  // 4. Cluster-wide activity breakdown
  let clusterCommits = 0
  let clusterPRs = 0
  let clusterIssues = 0
  for (const row of activityRows) {
    const n = Number(row.cnt)
    if (row.type === 'commit' || row.type === 'push') clusterCommits += n
    else if (row.type === 'pr') clusterPRs += n
    else if (row.type === 'issue') clusterIssues += n
  }

  // 5. Derive matched rule kinds from the tech catalog (server-side)
  //    Import lazily to keep the query file focused.
  const { TECH_CATALOG } = await import('@/features/territories/tech-catalog')
  const catalogMap = new Map(TECH_CATALOG.map((e) => [e.tech_key, e]))

  // 6. Build litStars
  const litStars: ClusterDrawerLitStar[] = litLandmarks.map((lm) => {
    const entry = catalogMap.get(lm.techKey)
    const matchedRuleKinds = entry ? Array.from(new Set(entry.rules.map((r) => r.kind))) : []

    const contributingRepos = sortedRepos.slice(0, 3).map((r) => ({
      owner: r.owner,
      name: r.name,
      repoId: r.repoId,
      matchCount: r.total,
    }))

    return {
      tech_key: lm.techKey,
      displayName: entry?.displayName ?? lm.techKey,
      weight: Number(lm.weight),
      firstUnlockedAt: lm.firstUnlockedAt?.toISOString() ?? null,
      topContributingRepo: topRepo
        ? { owner: topRepo.owner, name: topRepo.name, repoId: topRepo.repoId }
        : null,
      matchedRuleKinds,
      contributingRepos,
      activity: { commits: clusterCommits, prs: clusterPRs, issues: clusterIssues },
    }
  })

  return { type: territoryType, stage, growth30d, stageChangedAt, litStars }
}

// ── Legacy helpers (used by existing code, kept for backwards compat) ────────

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

/** Returns repo owner/name pairs contributing to a cluster, for use by the recent-prs API route. */
export async function getRepoHandlesForTerritory(
  userId: string,
  territoryType: string,
): Promise<Array<{ owner: string; name: string }>> {
  const rows = await db
    .select({
      owner: repositories.owner,
      name: repositories.name,
    })
    .from(activities)
    .innerJoin(repositories, eq(repositories.id, activities.repoId))
    .innerJoin(activityTerritories, eq(activityTerritories.activityId, activities.id))
    .where(
      withUserScopeAnd(
        userId,
        activities.userId,
        eq(activityTerritories.territoryType, territoryType),
        eq(repositories.isIncluded, true),
      ),
    )
    .groupBy(repositories.owner, repositories.name)
    .orderBy(desc(count()))
    .limit(20)

  return rows
}

function parsePrUrl(url: string): { owner: string; repo: string; number: number } | null {
  const match = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(url)
  if (!match) return null
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) }
}
