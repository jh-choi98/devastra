import 'server-only'

import { count, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { activities } from '@/lib/db/schema/activities'
import { activityTerritories } from '@/lib/db/schema/activity-territories'
import { landmarks } from '@/lib/db/schema/landmarks'
import { repositories } from '@/lib/db/schema/repositories'
import { withUserScopeAnd } from './_helpers'
import type { TechCatalogEntry } from '@/features/territories/tech-catalog'
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

export type ActivityAttributionRow = {
  techKey: string
  repoId: string
  type: string
  repoOwner: string
  repoName: string
  cnt: number
}

type ActivityRaw = {
  file_paths?: unknown
}

const PRIMARY_LANGUAGE_TECH_FALLBACK: Record<string, string> = {
  go: 'go',
  python: 'python',
  rust: 'rust',
  java: 'java',
  javascript: 'javascript',
  typescript: 'typescript',
  css: 'css',
  vue: 'vue',
  svelte: 'svelte',
  sql: 'sql',
  dockerfile: 'docker',
  hcl: 'terraform',
  'c++': 'cpp',
  c: 'c',
}

function basename(filePath: string): string {
  return filePath.split('/').pop() ?? filePath
}

function filePathsFromRaw(raw: unknown): string[] {
  const maybeRaw = raw as ActivityRaw
  return Array.isArray(maybeRaw.file_paths)
    ? maybeRaw.file_paths.filter((path): path is string => typeof path === 'string')
    : []
}

function inferStoredActivityTechKeys(
  raw: unknown,
  primaryLanguage: string | null,
  catalog: readonly TechCatalogEntry[],
): Set<string> {
  const keys = new Set<string>()
  const filePaths = filePathsFromRaw(raw).map((path) => path.replace(/\\/g, '/').toLowerCase())

  for (const entry of catalog) {
    for (const rule of entry.rules) {
      if (
        rule.kind === 'ext' &&
        filePaths.some((path) => rule.extensions.some((ext) => path.endsWith(ext.toLowerCase())))
      ) {
        keys.add(entry.tech_key)
      }
      if (
        rule.kind === 'path' &&
        filePaths.some((path) =>
          rule.prefixes.some((prefix) => path.startsWith(prefix.toLowerCase())),
        )
      ) {
        keys.add(entry.tech_key)
      }
      if (
        rule.kind === 'filename' &&
        filePaths.some((path) => rule.names.includes(basename(path)))
      ) {
        keys.add(entry.tech_key)
      }
    }
  }

  const primaryFallback = primaryLanguage
    ? PRIMARY_LANGUAGE_TECH_FALLBACK[primaryLanguage.toLowerCase()]
    : undefined
  if (primaryFallback) keys.add(primaryFallback)

  return keys
}

export function buildClusterDrawerLitStars(
  litLandmarks: Array<{
    techKey: string
    weight: string | number
    firstUnlockedAt: Date | null
  }>,
  catalogMap: Map<string, Pick<TechCatalogEntry, 'displayName' | 'rules'>>,
  rowsByTechKey: Map<string, ActivityAttributionRow[]>,
): ClusterDrawerLitStar[] {
  return litLandmarks.map((lm) => {
    const entry = catalogMap.get(lm.techKey)
    const matchedRuleKinds = entry ? Array.from(new Set(entry.rules.map((r) => r.kind))) : []
    const rows = rowsByTechKey.get(lm.techKey) ?? []
    const repoTotals: Map<string, { owner: string; name: string; repoId: string; total: number }> =
      new Map()
    let commits = 0
    let prs = 0
    let issues = 0

    for (const row of rows) {
      const existing = repoTotals.get(row.repoId)
      if (existing) {
        existing.total += row.cnt
      } else {
        repoTotals.set(row.repoId, {
          owner: row.repoOwner,
          name: row.repoName,
          repoId: row.repoId,
          total: row.cnt,
        })
      }

      if (row.type === 'commit' || row.type === 'push') commits += row.cnt
      else if (row.type === 'pr') prs += row.cnt
      else if (row.type === 'issue') issues += row.cnt
    }

    const sortedRepos = Array.from(repoTotals.values()).sort((a, b) => b.total - a.total)
    const topRepo = sortedRepos[0] ?? null
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
      activity: { commits, prs, issues },
    }
  })
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

  // 2. Fetch per-repo activity counts for all lit tech keys in one query.
  const techKeys = litLandmarks.map((l) => l.techKey)
  const techKeySet = new Set(techKeys)
  const techKeyArray = sql`ARRAY[${sql.join(
    techKeys.map((techKey) => sql`${techKey}`),
    sql`, `,
  )}]::text[]`

  const activityRows: ActivityAttributionRow[] = []

  const rows = await db
    .select({
      storedTechKeys: activityTerritories.techKeys,
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
        sql`${activityTerritories.techKeys} && ${techKeyArray}`,
      ),
    )
    .groupBy(
      activityTerritories.techKeys,
      activities.repoId,
      activities.type,
      repositories.owner,
      repositories.name,
    )

  for (const row of rows) {
    for (const techKey of row.storedTechKeys) {
      if (!techKeySet.has(techKey)) continue
      activityRows.push({
        techKey,
        repoId: row.repoId,
        type: row.type,
        repoOwner: row.repoOwner,
        repoName: row.repoName,
        cnt: Number(row.cnt),
      })
    }
  }

  // 3. Derive matched rule kinds from the tech catalog (server-side)
  //    Import lazily to keep the query file focused.
  const { TECH_CATALOG } = await import('@/features/territories/tech-catalog')
  const catalogMap = new Map(TECH_CATALOG.map((e) => [e.tech_key, e]))

  const attributedTechKeys = new Set(activityRows.map((row) => row.techKey))
  const missingTechKeys = techKeys.filter((techKey) => !attributedTechKeys.has(techKey))

  if (missingTechKeys.length > 0) {
    const legacyRows = await db
      .select({
        repoId: activities.repoId,
        type: activities.type,
        raw: activities.raw,
        repoOwner: repositories.owner,
        repoName: repositories.name,
        primaryLanguage: repositories.primaryLanguage,
        storedTechKeys: activityTerritories.techKeys,
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

    const fallbackCounts = new Map<string, ActivityAttributionRow>()

    for (const row of legacyRows) {
      if (row.storedTechKeys.length > 0) continue
      const inferredTechKeys = inferStoredActivityTechKeys(
        row.raw,
        row.primaryLanguage,
        TECH_CATALOG,
      )
      for (const techKey of missingTechKeys) {
        if (!inferredTechKeys.has(techKey)) continue
        const key = `${techKey}:${row.repoId}:${row.type}`
        const existing = fallbackCounts.get(key)
        if (existing) {
          existing.cnt += 1
        } else {
          fallbackCounts.set(key, {
            techKey,
            repoId: row.repoId,
            type: row.type,
            repoOwner: row.repoOwner,
            repoName: row.repoName,
            cnt: 1,
          })
        }
      }
    }

    activityRows.push(...Array.from(fallbackCounts.values()))
  }

  const rowsByTechKey = new Map<string, ActivityAttributionRow[]>()
  for (const row of activityRows) {
    const rows = rowsByTechKey.get(row.techKey) ?? []
    rows.push(row)
    rowsByTechKey.set(row.techKey, rows)
  }

  const litStars = buildClusterDrawerLitStars(litLandmarks, catalogMap, rowsByTechKey)

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
      withUserScopeAnd(userId, activities.userId, eq(activityTerritories.territoryType, territoryType)),
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
      withUserScopeAnd(
        userId,
        activities.userId,
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
