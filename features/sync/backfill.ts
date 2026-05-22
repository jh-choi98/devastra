import 'server-only'

import { and, eq, inArray, notInArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { activities as activitiesTable } from '@/lib/db/schema/activities'
import { activityTerritories as activityTerritoriesTable } from '@/lib/db/schema/activity-territories'
import { landmarks as landmarksTable } from '@/lib/db/schema/landmarks'
import { repositories } from '@/lib/db/schema/repositories'
import { buildActivityRaw } from '@/lib/db/queries/activities'
import { withUserScopeAnd } from '@/lib/db/queries/_helpers'
import {
  createSyncJob,
  startSyncJob,
  completeSyncJob,
  failSyncJob,
  updateSyncJobProgress,
} from '@/lib/db/queries/sync-jobs'
import { getUsersWithTokens } from '@/lib/db/queries/users'
import { getIncludedRepositoriesForUser } from '@/lib/db/queries/repositories'
import { getUsableAccessToken } from '@/lib/github/token'
import { GitHubClassifier } from '@/features/territories/classifier'
import { LANDMARK_UNLOCK_THRESHOLD } from '@/features/territories/rules'
import type { ClassificationContext } from '@/features/territories/classifier'
import type { DbRepository } from '@/lib/db/queries/repositories'
import type { SourceActivity } from './sources/interface'
import { GitHubSourceClient } from './sources/github'
import { buildDefaultManifestContexts, buildManifestContext } from './initial'
import { recomputeUserDenorm } from './denorm'
import { toSyncDate } from './dates'
import {
  HISTORICAL_BOOTSTRAP_MAX_COMMITS_PER_REPO,
  HISTORICAL_BOOTSTRAP_MAX_PAGES_PER_REPO,
  HISTORICAL_BOOTSTRAP_MAX_REPOS,
  dedupeActivities,
  selectHistoricalBootstrapRepos,
} from './historical'
import { mapWithConcurrency } from './concurrency'
import {
  mergeCachedActivityAttribution,
  type CachedActivityAttribution,
} from './cached-attribution'
import { cacheManifestContextForRepo } from './manifest-cache'
import { planManifestContextRefresh } from './manifest-context-planning'
import { markHistoricalBootstrapChecked } from './historical-cache'
import type { GetStepTools } from 'inngest'
import type { inngest } from '@/lib/inngest/client'
import type { TerritoryType } from '@/features/territories/registry'

type StepTools = GetStepTools<typeof inngest>
const MAX_BACKFILL_MANIFEST_REPO_PROBES = 50
const MAX_BACKFILL_COMMIT_DETAILS = 50
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000
const COMMIT_DETAIL_CONCURRENCY = 6
const MANIFEST_FETCH_CONCURRENCY = 5
const ACTIVITY_TERRITORY_UPSERT_BATCH_SIZE = 500
const LANDMARK_UPSERT_BATCH_SIZE = 200

type BackfillStats = {
  includedActivityCount: number
  matchedTechKeyCount: number
}

type BackfillRepo = {
  id: string
  userId: string
  source: string
  externalRepoId: string
  owner: string
  name: string
  primaryLanguage: string | null
  isIncluded: boolean
  sourcePushedAt: string | null
  manifestContext: unknown
  manifestSourcePushedAt: string | null
  historicalBootstrapSourcePushedAt: string | null
  commitsFetchedSourcePushedAt: string | null
}

type SerializedSourceActivity = Omit<SourceActivity, 'occurredAt'> & {
  occurredAt: string
}

type HistoricalBackfillResult = {
  activities: SerializedSourceActivity[]
  checkedRepos: Array<{ id: string; sourcePushedAt: string | null }>
}

type RecentBackfillActivityResult = {
  activities: SerializedSourceActivity[]
  commitFetchedRepoExternalIds: string[]
}

type EnrichedBackfillActivityResult = {
  activities: SerializedSourceActivity[]
  detailFailedRepoExternalIds: string[]
}

function serializeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return toSyncDate(value).toISOString()
}

function serializeRepo(repo: DbRepository): BackfillRepo {
  return {
    id: repo.id,
    userId: repo.userId,
    source: repo.source,
    externalRepoId: repo.externalRepoId,
    owner: repo.owner,
    name: repo.name,
    primaryLanguage: repo.primaryLanguage,
    isIncluded: repo.isIncluded,
    sourcePushedAt: serializeDate(repo.sourcePushedAt),
    manifestContext: repo.manifestContext,
    manifestSourcePushedAt: serializeDate(repo.manifestSourcePushedAt),
    historicalBootstrapSourcePushedAt: serializeDate(repo.historicalBootstrapSourcePushedAt),
    commitsFetchedSourcePushedAt: serializeDate(repo.commitsFetchedSourcePushedAt),
  }
}

function sameInstant(a: Date | string | null | undefined, b: Date | string | null | undefined) {
  const left = toDateOrNull(a)
  const right = toDateOrNull(b)
  if (!left || !right) return false
  return left.getTime() === right.getTime()
}

function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function hasValidCommitFetchCache(
  repo: Pick<BackfillRepo, 'sourcePushedAt' | 'commitsFetchedSourcePushedAt'>,
): boolean {
  return sameInstant(repo.sourcePushedAt, repo.commitsFetchedSourcePushedAt)
}

export function selectReposForRecentCommitFetch<T extends BackfillRepo>(repos: T[]): T[] {
  return repos.filter((repo) => !hasValidCommitFetchCache(repo))
}

function toSerializedActivity(activity: SourceActivity): SerializedSourceActivity {
  return {
    ...activity,
    occurredAt: toSyncDate(activity.occurredAt).toISOString(),
  }
}

function fromSerializedActivity(activity: SerializedSourceActivity): SourceActivity {
  return {
    ...activity,
    occurredAt: toSyncDate(activity.occurredAt),
  }
}

async function enrichCommitActivities(
  activities: SourceActivity[],
  dbRepos: BackfillRepo[],
  github: GitHubSourceClient,
): Promise<{ activities: SourceActivity[]; detailFailedRepoExternalIds: string[] }> {
  const repoMap = new Map(dbRepos.map((repo) => [repo.externalRepoId, repo]))
  const detailFailedRepoExternalIds = new Set<string>()
  const commitsToEnrich = new Set(
    activities
      .filter((activity) => activity.type === 'commit' && activity.filePaths.length === 0)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, MAX_BACKFILL_COMMIT_DETAILS)
      .map((activity) => activity.externalId),
  )

  const enrichedActivities = await mapWithConcurrency(
    activities,
    COMMIT_DETAIL_CONCURRENCY,
    async (activity) => {
      let { filePaths, additions, deletions, githubUrl } = activity

      if (activity.type === 'commit' && commitsToEnrich.has(activity.externalId)) {
        const repo = repoMap.get(activity.repoExternalId)
        if (repo) {
          try {
            const fileData = await github.fetchCommitFiles(
              repo.owner,
              repo.name,
              activity.externalId,
            )
            filePaths = fileData.file_paths
            additions = fileData.additions
            deletions = fileData.deletions
            githubUrl = fileData.github_url
          } catch {
            detailFailedRepoExternalIds.add(activity.repoExternalId)
            // Keep the activity; classification can still use repo and manifest context.
          }
        }
      }

      return { ...activity, filePaths, additions, deletions, githubUrl }
    },
  )

  return {
    activities: enrichedActivities,
    detailFailedRepoExternalIds: Array.from(detailFailedRepoExternalIds),
  }
}

async function fetchRecentIncludedRepoActivities(
  dbRepos: BackfillRepo[],
  github: GitHubSourceClient,
): Promise<RecentBackfillActivityResult> {
  if (dbRepos.length === 0) return { activities: [], commitFetchedRepoExternalIds: [] }

  const repoExternalIds = dbRepos.map((repo) => repo.externalRepoId)
  const commitRepoExternalIds = selectReposForRecentCommitFetch(dbRepos).map(
    (repo) => repo.externalRepoId,
  )
  const since = new Date(Date.now() - TWELVE_MONTHS_MS)
  const result = await github.listAuthoredActivitiesWithFetchMetadata({
    repoExternalIds,
    commitRepoExternalIds,
    since,
  })
  return {
    activities: result.activities.map(toSerializedActivity),
    commitFetchedRepoExternalIds: result.commitFetchedRepoExternalIds,
  }
}

async function fetchHistoricalIncludedRepoActivities(
  dbRepos: BackfillRepo[],
  recentActivities: SerializedSourceActivity[],
  github: GitHubSourceClient,
): Promise<HistoricalBackfillResult> {
  if (dbRepos.length === 0) return { activities: [], checkedRepos: [] }

  const recent = recentActivities.map(fromSerializedActivity)
  const historicalRepos = selectHistoricalBootstrapRepos(dbRepos, recent)
  if (historicalRepos.length === 0) return { activities: [], checkedRepos: [] }

  const historicalActivities = await github.listHistoricalAuthoredActivities({
    repos: historicalRepos,
    maxRepos: HISTORICAL_BOOTSTRAP_MAX_REPOS,
    maxCommitsPerRepo: HISTORICAL_BOOTSTRAP_MAX_COMMITS_PER_REPO,
    maxPagesPerRepo: HISTORICAL_BOOTSTRAP_MAX_PAGES_PER_REPO,
  })

  return {
    activities: historicalActivities.map(toSerializedActivity),
    checkedRepos: historicalRepos.map((repo) => ({
      id: repo.id,
      sourcePushedAt: repo.sourcePushedAt ? toSyncDate(repo.sourcePushedAt).toISOString() : null,
    })),
  }
}

async function applyCachedCommitDetails(
  userId: string,
  activities: SourceActivity[],
): Promise<SourceActivity[]> {
  const commitIds = Array.from(
    new Set(
      activities
        .filter((activity) => activity.type === 'commit' && activity.filePaths.length === 0)
        .map((activity) => activity.externalId),
    ),
  )
  if (commitIds.length === 0) return activities

  const cachedDetails = new Map<
    string,
    { filePaths: string[]; additions: number; deletions: number; githubUrl: string }
  >()

  for (const ids of chunkArray(commitIds, 100)) {
    const rows = await db
      .select({
        externalId: activitiesTable.externalId,
        raw: activitiesTable.raw,
      })
      .from(activitiesTable)
      .where(
        withUserScopeAnd(
          userId,
          activitiesTable.userId,
          eq(activitiesTable.source, 'github'),
          inArray(activitiesTable.externalId, ids),
        ),
      )

    for (const row of rows) {
      const raw = row.raw as {
        file_paths?: unknown
        additions?: unknown
        deletions?: unknown
        github_url?: unknown
      }
      const filePaths = Array.isArray(raw.file_paths)
        ? raw.file_paths.filter((path): path is string => typeof path === 'string')
        : []
      if (filePaths.length === 0) continue

      cachedDetails.set(row.externalId, {
        filePaths,
        additions: typeof raw.additions === 'number' ? raw.additions : Number(raw.additions ?? 0),
        deletions: typeof raw.deletions === 'number' ? raw.deletions : Number(raw.deletions ?? 0),
        githubUrl: typeof raw.github_url === 'string' ? raw.github_url : '',
      })
    }
  }

  if (cachedDetails.size === 0) return activities

  return activities.map((activity) => {
    if (activity.type !== 'commit' || activity.filePaths.length > 0) return activity
    const cached = cachedDetails.get(activity.externalId)
    if (!cached) return activity
    return {
      ...activity,
      filePaths: cached.filePaths,
      additions: cached.additions,
      deletions: cached.deletions,
      githubUrl: cached.githubUrl || activity.githubUrl,
    }
  })
}

async function enrichSerializedCommitActivities(
  userId: string,
  activities: SerializedSourceActivity[],
  dbRepos: BackfillRepo[],
  github: GitHubSourceClient,
): Promise<EnrichedBackfillActivityResult> {
  const sourceActivities = dedupeActivities(activities).map(fromSerializedActivity)
  const activitiesWithCachedDetails = await applyCachedCommitDetails(userId, sourceActivities)
  const enriched = await enrichCommitActivities(activitiesWithCachedDetails, dbRepos, github)
  return {
    activities: enriched.activities.map(toSerializedActivity),
    detailFailedRepoExternalIds: enriched.detailFailedRepoExternalIds,
  }
}

async function cacheIncludedRepoActivities(
  userId: string,
  dbRepos: BackfillRepo[],
  activities: SerializedSourceActivity[],
  opts: { commitFetchedRepoExternalIds?: string[] } = {},
): Promise<void> {
  const sourceActivities = activities.map(fromSerializedActivity)
  const repoIdMap = new Map(dbRepos.map((repo) => [repo.externalRepoId, repo.id]))
  const repoMap = new Map(dbRepos.map((repo) => [repo.externalRepoId, repo]))
  const commitFetchedRepoIds = new Set(opts.commitFetchedRepoExternalIds ?? [])

  await db.transaction(async (tx) => {
    for (const activity of sourceActivities) {
      const repoId = repoIdMap.get(activity.repoExternalId)
      if (!repoId) continue

      await tx
        .insert(activitiesTable)
        .values({
          userId,
          repoId,
          source: activity.source,
          externalId: activity.externalId,
          type: activity.type,
          occurredAt: toSyncDate(activity.occurredAt),
          raw: buildActivityRaw({
            file_paths: activity.filePaths,
            additions: activity.additions,
            deletions: activity.deletions,
            github_url: activity.githubUrl,
          }),
        })
        .onConflictDoNothing()
    }

    for (const externalRepoId of Array.from(commitFetchedRepoIds)) {
      const repo = repoMap.get(externalRepoId)
      if (!repo?.sourcePushedAt) continue

      await tx
        .update(repositories)
        .set({ commitsFetchedSourcePushedAt: toSyncDate(repo.sourcePushedAt) })
        .where(and(eq(repositories.id, repo.id), eq(repositories.userId, userId)))
    }
  })
}

async function buildManifestContextsForRepos(
  userId: string,
  dbRepos: BackfillRepo[],
  github: GitHubSourceClient,
): Promise<Record<string, ClassificationContext>> {
  const { manifestContexts, reposToFetch } = planManifestContextRefresh(
    dbRepos,
    MAX_BACKFILL_MANIFEST_REPO_PROBES,
  )

  const entries = await mapWithConcurrency(
    reposToFetch,
    MANIFEST_FETCH_CONCURRENCY,
    async (repo) => {
      const context = await buildManifestContext(
        github,
        repo.owner,
        repo.name,
        repo.primaryLanguage,
      )
      await cacheManifestContextForRepo({ userId, repo, context })
      return [repo.externalRepoId, context] as const
    },
  )

  for (const [externalRepoId, ctx] of entries) {
    manifestContexts[externalRepoId] = ctx
  }

  return manifestContexts
}

async function refreshIncludedRepositoryMetadata(
  userId: string,
  dbRepos: BackfillRepo[],
  github: GitHubSourceClient,
): Promise<BackfillRepo[]> {
  if (dbRepos.length === 0) return dbRepos

  const sourceRepos = await github.fetchReposByExternalIds(
    dbRepos.map((repo) => repo.externalRepoId),
  )
  const sourceById = new Map(sourceRepos.map((repo) => [repo.externalRepoId, repo]))

  return mapWithConcurrency(dbRepos, MANIFEST_FETCH_CONCURRENCY, async (repo) => {
    const source = sourceById.get(repo.externalRepoId)
    if (!source) return repo

    const [updated] = await db
      .update(repositories)
      .set({
        owner: source.owner,
        name: source.name,
        primaryLanguage: source.primaryLanguage,
        sourcePushedAt: source.pushedAt ?? null,
      })
      .where(and(eq(repositories.id, repo.id), eq(repositories.userId, userId)))
      .returning()

    return updated ? serializeRepo(updated) : repo
  })
}

async function reclassifyIncludedActivities(
  userId: string,
  manifestContexts: Record<string, ClassificationContext>,
  opts: { preserveCachedAttribution?: boolean } = {},
): Promise<BackfillStats> {
  const classifier = new GitHubClassifier()
  // Fetch only included-repo activities for this user with repo context for fallback classification.
  const includedActivities = await db
    .select({
      id: activitiesTable.id,
      externalId: activitiesTable.externalId,
      type: activitiesTable.type,
      occurredAt: activitiesTable.occurredAt,
      raw: activitiesTable.raw,
      externalRepoId: repositories.externalRepoId,
      primaryLanguage: repositories.primaryLanguage,
    })
    .from(activitiesTable)
    .innerJoin(repositories, eq(repositories.id, activitiesTable.repoId))
    .where(withUserScopeAnd(userId, activitiesTable.userId, eq(repositories.isIncluded, true)))

  const cachedAttributionByActivityId = new Map<string, CachedActivityAttribution[]>()
  if (opts.preserveCachedAttribution) {
    const cachedRows = await db
      .select({
        activityId: activityTerritoriesTable.activityId,
        territoryType: activityTerritoriesTable.territoryType,
        weight: activityTerritoriesTable.weight,
        techKeys: activityTerritoriesTable.techKeys,
      })
      .from(activityTerritoriesTable)
      .innerJoin(activitiesTable, eq(activitiesTable.id, activityTerritoriesTable.activityId))
      .innerJoin(repositories, eq(repositories.id, activitiesTable.repoId))
      .where(withUserScopeAnd(userId, activitiesTable.userId, eq(repositories.isIncluded, true)))

    for (const row of cachedRows) {
      const techKeys = row.techKeys ?? []
      if (techKeys.length === 0) continue
      const rows = cachedAttributionByActivityId.get(row.activityId) ?? []
      rows.push({
        territory: row.territoryType as TerritoryType,
        weight: Number(row.weight),
        techKeys,
      })
      cachedAttributionByActivityId.set(row.activityId, rows)
    }
  }

  let matchedTechKeyCount = 0
  const activityTerritoryRows: Array<{
    activityId: string
    territoryType: string
    weight: string
    techKeys: string[]
  }> = []
  const landmarkAccum = new Map<string, { weight: number; territory: string; lastDate: Date }>()

  for (const activity of includedActivities) {
    const occurredAt = toSyncDate(activity.occurredAt)
    const raw = activity.raw as {
      file_paths?: string[]
      additions?: number
      deletions?: number
      github_url?: string
    }

    const ctx: ClassificationContext = manifestContexts[activity.externalRepoId] ?? {
      parsedPackageJsonDeps: [],
      parsedRequirementsTxtDeps: [],
      parsedPyprojectTomlDeps: [],
      parsedGoModDeps: [],
      parsedPomXmlDeps: [],
      parsedGradleDeps: [],
      parsedGemfileDeps: [],
      parsedCargoTomlDeps: [],
      primaryLanguage: activity.primaryLanguage,
    }

    const classifiedResults = classifier.classify(
      {
        source: 'github',
        externalId: activity.externalId,
        type: activity.type as 'commit' | 'pr' | 'issue',
        repoExternalId: '',
        occurredAt,
        filePaths: raw.file_paths ?? [],
        additions: raw.additions ?? 0,
        deletions: raw.deletions ?? 0,
        githubUrl: raw.github_url ?? '',
      },
      ctx,
    )
    const results = opts.preserveCachedAttribution
      ? mergeCachedActivityAttribution(
          classifiedResults,
          cachedAttributionByActivityId.get(activity.id) ?? [],
        )
      : classifiedResults

    for (const result of results) {
      activityTerritoryRows.push({
        activityId: activity.id,
        territoryType: result.territory,
        weight: result.weight.toString(),
        techKeys: result.techKeys,
      })

      for (const techKey of result.techKeys) {
        const existing = landmarkAccum.get(techKey)
        landmarkAccum.set(techKey, {
          weight: (existing?.weight ?? 0) + result.weight,
          territory: result.territory,
          lastDate:
            !existing?.lastDate || occurredAt > existing.lastDate ? occurredAt : existing.lastDate,
        })
      }
    }
  }

  const activeTechKeys = Array.from(landmarkAccum.keys())
  matchedTechKeyCount = activeTechKeys.length

  await db.transaction(async (tx) => {
    // Clear every previous classification for this user. Excluded repos are intentionally
    // left as raw activities, but they no longer contribute to the constellation.
    await tx.execute(sql`
      DELETE FROM ${activityTerritoriesTable}
      USING ${activitiesTable}
      WHERE ${activityTerritoriesTable.activityId} = ${activitiesTable.id}
        AND ${activitiesTable.userId} = ${userId}
    `)

    for (const rows of chunkArray(activityTerritoryRows, ACTIVITY_TERRITORY_UPSERT_BATCH_SIZE)) {
      await tx
        .insert(activityTerritoriesTable)
        .values(rows)
        .onConflictDoUpdate({
          target: [activityTerritoriesTable.activityId, activityTerritoriesTable.territoryType],
          set: {
            weight: sql`excluded.weight`,
            techKeys: sql`excluded.tech_keys`,
          },
        })
    }

    const existingLandmarkRows =
      activeTechKeys.length === 0
        ? []
        : await tx
            .select({
              techKey: landmarksTable.techKey,
              firstUnlockedAt: landmarksTable.firstUnlockedAt,
            })
            .from(landmarksTable)
            .where(
              withUserScopeAnd(
                userId,
                landmarksTable.userId,
                inArray(landmarksTable.techKey, activeTechKeys),
              ),
            )
    const firstUnlockedByTechKey = new Map(
      existingLandmarkRows.map((row) => [row.techKey, row.firstUnlockedAt]),
    )

    if (activeTechKeys.length === 0) {
      await tx.delete(landmarksTable).where(eq(landmarksTable.userId, userId))
    } else {
      await tx
        .delete(landmarksTable)
        .where(
          and(
            eq(landmarksTable.userId, userId),
            notInArray(landmarksTable.techKey, activeTechKeys),
          ),
        )
    }

    const landmarkRows = Array.from(landmarkAccum.entries()).map(
      ([techKey, { weight, territory, lastDate }]) => {
        const existingFirstUnlockedAt = firstUnlockedByTechKey.get(techKey) ?? null
        const firstUnlockedAt =
          weight >= LANDMARK_UNLOCK_THRESHOLD ? (existingFirstUnlockedAt ?? lastDate) : null

        return {
          userId,
          techKey,
          territoryType: territory,
          weight: weight.toString(),
          firstUnlockedAt,
          lastGrownAt: lastDate,
        }
      },
    )

    for (const rows of chunkArray(landmarkRows, LANDMARK_UPSERT_BATCH_SIZE)) {
      await tx
        .insert(landmarksTable)
        .values(rows)
        .onConflictDoUpdate({
          target: [landmarksTable.userId, landmarksTable.techKey],
          set: {
            territoryType: sql`excluded.territory_type`,
            weight: sql`excluded.weight`,
            firstUnlockedAt: sql`excluded.first_unlocked_at`,
            lastGrownAt: sql`excluded.last_grown_at`,
          },
        })
    }
  })

  return {
    includedActivityCount: includedActivities.length,
    matchedTechKeyCount,
  }
}

async function withGitHubClient<T>(
  userId: string,
  fn: (github: GitHubSourceClient) => Promise<T>,
): Promise<T> {
  const accessToken = await getUsableAccessToken(userId)
  const github = new GitHubSourceClient(accessToken, userId)
  return fn(github)
}

function stepName(prefix: string, name: string): string {
  return prefix ? `${prefix}-${name}` : name
}

async function backfillUser(
  step: StepTools,
  userId: string,
  existingJobId?: string,
  opts: { fast?: boolean } = {},
  stepPrefix = '',
): Promise<void> {
  let jobId: string | null = null
  const name = (value: string) => stepName(stepPrefix, value)

  try {
    jobId = await step.run(name('start-job'), async () => {
      if (existingJobId) {
        await startSyncJob(existingJobId)
        return existingJobId
      }

      const job = await createSyncJob({ userId, kind: 'backfill' })
      await startSyncJob(job.id)
      return job.id
    })

    const dbRepos = await step.run(name('list-included-repos'), async () =>
      (await getIncludedRepositoriesForUser(userId)).map(serializeRepo),
    )

    await step.run(name('progress-start'), () =>
      updateSyncJobProgress(jobId!, {
        repos_analyzed: 0,
        total: dbRepos.length,
        current_step: opts.fast
          ? 'Applying your repo choices from saved activity...'
          : 'Reading activity from selected repos...',
      }),
    )

    if (opts.fast) {
      if (dbRepos.length === 0) {
        await step.run(name('reclassify-empty-selection'), () =>
          reclassifyIncludedActivities(userId, buildDefaultManifestContexts(dbRepos), {
            preserveCachedAttribution: true,
          }),
        )
        await step.run(name('recompute-empty-selection'), () => recomputeUserDenorm(userId))
        await step.run(name('complete-job'), () => completeSyncJob(jobId!))
        return
      }

      await step.run(name('progress-check-cache'), () =>
        updateSyncJobProgress(jobId!, {
          repos_analyzed: 0,
          total: dbRepos.length,
          current_step: 'Checking saved activity and project manifests...',
        }),
      )
    }

    if (!opts.fast) {
      await step.run(name('progress-read-activity'), () =>
        updateSyncJobProgress(jobId!, {
          repos_analyzed: 0,
          total: dbRepos.length,
          current_step: 'Reading older activity from selected repos...',
        }),
      )
    }

    try {
      const freshRepos = await step.run(name('refresh-repo-metadata'), () =>
        withGitHubClient(userId, (github) =>
          refreshIncludedRepositoryMetadata(userId, dbRepos, github),
        ),
      )

      const manifestContexts = await step.run(name('build-manifest-contexts'), () =>
        withGitHubClient(userId, (github) =>
          buildManifestContextsForRepos(userId, freshRepos, github),
        ),
      )

      const recentActivities = await step.run(name('fetch-recent-activities'), () =>
        withGitHubClient(userId, (github) => fetchRecentIncludedRepoActivities(freshRepos, github)),
      )

      const historical = await step.run(name('fetch-historical-activities'), () =>
        withGitHubClient(userId, (github) =>
          fetchHistoricalIncludedRepoActivities(freshRepos, recentActivities.activities, github),
        ),
      )

      const allActivities = dedupeActivities([
        ...recentActivities.activities,
        ...historical.activities,
      ])

      const enrichedActivities = await step.run(name('enrich-commit-activity-details'), () =>
        withGitHubClient(userId, (github) =>
          enrichSerializedCommitActivities(userId, allActivities, freshRepos, github),
        ),
      )

      const detailFailedRepoExternalIds = new Set(enrichedActivities.detailFailedRepoExternalIds)
      const commitFetchedRepoExternalIds = recentActivities.commitFetchedRepoExternalIds.filter(
        (externalRepoId) => !detailFailedRepoExternalIds.has(externalRepoId),
      )

      await step.run(name('cache-activity-rows'), () =>
        cacheIncludedRepoActivities(userId, freshRepos, enrichedActivities.activities, {
          commitFetchedRepoExternalIds,
        }),
      )

      if (historical.checkedRepos.length > 0) {
        await step.run(name('mark-historical-bootstrap-checked'), () =>
          markHistoricalBootstrapChecked({ userId, repos: historical.checkedRepos }),
        )
      }

      await step.run(name('progress-classify'), () =>
        updateSyncJobProgress(jobId!, {
          repos_analyzed: freshRepos.length,
          total: freshRepos.length,
          current_step: 'Lighting your constellation...',
        }),
      )

      await step.run(name('reclassify-included-activities'), () =>
        reclassifyIncludedActivities(userId, manifestContexts),
      )

      await step.run(name('recompute-denorm'), () => recomputeUserDenorm(userId))
    } catch (err) {
      if (opts.fast) throw err

      const stats = await step.run(name('reclassify-from-saved-activity'), () =>
        reclassifyIncludedActivities(userId, buildDefaultManifestContexts(dbRepos)),
      )
      await step.run(name('recompute-saved-activity'), () => recomputeUserDenorm(userId))
      if (stats.includedActivityCount === 0 && dbRepos.length > 0)
        throw new Error('Backfill failed')
    }

    await step.run(name('complete-job'), () => completeSyncJob(jobId!))
  } catch (err) {
    if (jobId) {
      await step.run(name('fail-job'), () =>
        failSyncJob(jobId!, err instanceof Error ? err.message : String(err)),
      )
    }
    throw err
  }
}

export async function run(
  event: { data: { userId?: string; jobId?: string; fast?: boolean } },
  step: StepTools,
): Promise<void> {
  const { userId, jobId, fast } = event.data

  if (userId) {
    await backfillUser(step, userId, jobId, { fast })
  } else {
    // Global backfill: all users with tokens
    const users = await step.run('list-users', () => getUsersWithTokens())
    for (const user of users) {
      await backfillUser(step, user.id, undefined, undefined, `backfill-user-${user.id}`)
    }
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}
