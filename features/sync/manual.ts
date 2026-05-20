import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { activities as activitiesTable } from '@/lib/db/schema/activities'
import { activityTerritories as activityTerritoriesTable } from '@/lib/db/schema/activity-territories'
import { landmarks as landmarksTable } from '@/lib/db/schema/landmarks'
import { buildActivityRaw } from '@/lib/db/queries/activities'
import {
  createSyncJob,
  startSyncJob,
  completeSyncJob,
  failSyncJob,
} from '@/lib/db/queries/sync-jobs'
import { getIncludedRepositoriesForUser } from '@/lib/db/queries/repositories'
import { getUserById, updateUserSyncState } from '@/lib/db/queries/users'
import { getLatestStartedSyncJobForUser } from '@/lib/db/queries/sync-jobs'
import { getUsableAccessToken } from '@/lib/github/token'
import { GitHubClassifier } from '@/features/territories/classifier'
import { LANDMARK_UNLOCK_THRESHOLD } from '@/features/territories/rules'
import { GitHubSourceClient } from './sources/github'
import type { ClassificationContext } from '@/features/territories/classifier'
import type { DbRepository } from '@/lib/db/queries/repositories'
import type { SourceActivity } from './sources/interface'
import { recomputeUserDenorm } from './denorm'
import { getPreviousLitCount, markFirstStarCinematicIfApplicable } from './cinematic-detection'
import { toSyncDate, toSyncDateOrNull } from './dates'
import { mapWithConcurrency } from './concurrency'
import { MANUAL_REFRESH_COOLDOWN_MS } from './manual-refresh-gate'
import type { GetStepTools } from 'inngest'
import type { inngest } from '@/lib/inngest/client'

type StepTools = GetStepTools<typeof inngest>

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
const MAX_MANUAL_COMMIT_DETAILS = 50
const COMMIT_DETAIL_CONCURRENCY = 6

type StepActivity = Omit<SourceActivity, 'occurredAt'> & { occurredAt: Date | string }

async function enrichCommitActivities(
  activities: StepActivity[],
  dbRepos: DbRepository[],
  github: GitHubSourceClient,
): Promise<StepActivity[]> {
  const repoMap = new Map(dbRepos.map((repo) => [repo.externalRepoId, repo]))
  const commitsToEnrich = new Set(
    activities
      .filter((activity) => activity.type === 'commit' && activity.filePaths.length === 0)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, MAX_MANUAL_COMMIT_DETAILS)
      .map((activity) => activity.externalId),
  )

  return mapWithConcurrency(activities, COMMIT_DETAIL_CONCURRENCY, async (activity) => {
    let { filePaths, additions, deletions } = activity

    if (activity.type === 'commit' && commitsToEnrich.has(activity.externalId)) {
      const repo = repoMap.get(activity.repoExternalId)
      if (repo) {
        try {
          const fileData = await github.fetchCommitFiles(repo.owner, repo.name, activity.externalId)
          filePaths = fileData.file_paths
          additions = fileData.additions
          deletions = fileData.deletions
        } catch {
          // Keep the activity; classification can still use repo and manifest context.
        }
      }
    }

    return { ...activity, filePaths, additions, deletions }
  })
}

export async function run(
  event: { data: { userId: string; jobId?: string } },
  step: StepTools,
): Promise<{ skipped?: boolean; reason?: string }> {
  const { userId, jobId: existingJobId } = event.data

  // Cooldown check — fast DB query, done inline before any steps
  const recent = await getLatestStartedSyncJobForUser(userId)
  const recentStartedAt = toSyncDateOrNull(recent?.startedAt)
  if (
    recent?.id !== existingJobId &&
    recentStartedAt &&
    Date.now() - recentStartedAt.getTime() < MANUAL_REFRESH_COOLDOWN_MS
  ) {
    if (existingJobId) await failSyncJob(existingJobId, 'cooldown')
    return { skipped: true, reason: 'cooldown' }
  }

  const user = await getUserById(userId)
  if (!user) {
    if (existingJobId) await failSyncJob(existingJobId, 'user-not-found')
    return { skipped: true, reason: 'user-not-found' }
  }

  const jobId = await step.run(existingJobId ? 'start-job' : 'create-job', async () => {
    if (existingJobId) {
      await startSyncJob(existingJobId)
      return existingJobId
    }
    const j = await createSyncJob({ userId, kind: 'manual' })
    await startSyncJob(j.id)
    return j.id
  })

  try {
    const accessToken = await step.run('fetch-token', () => getUsableAccessToken(userId))
    const github = new GitHubSourceClient(accessToken, userId)

    const previousLitCount = await step.run('get-prev-lit-count', () => getPreviousLitCount(userId))

    const now = new Date()
    const lastIncrementalSyncAt = toSyncDateOrNull(user.lastIncrementalSyncAt)
    const sinceDate =
      lastIncrementalSyncAt != null &&
      now.getTime() - lastIncrementalSyncAt.getTime() < NINETY_DAYS_MS
        ? lastIncrementalSyncAt
        : new Date(now.getTime() - SEVEN_DAYS_MS)

    const dbRepos = await getIncludedRepositoriesForUser(userId)
    const repoExternalIds = dbRepos.map((r) => r.externalRepoId)
    const repoIdMap = new Map(dbRepos.map((r) => [r.externalRepoId, r.id]))
    const repoMap = new Map(dbRepos.map((r) => [r.externalRepoId, r]))

    const sourceActivities = await step.run('fetch-activities', () =>
      github.listAuthoredActivities({ repoExternalIds, since: sinceDate }),
    )

    const enrichedActivities: StepActivity[] = await step.run('enrich-commit-files', () =>
      enrichCommitActivities(sourceActivities as StepActivity[], dbRepos, github),
    )

    await step.run('classify-and-write', async () => {
      const classifier = new GitHubClassifier()

      await db.transaction(async (tx) => {
        const landmarkAccum = new Map<
          string,
          { weight: number; territory: string; lastDate: Date }
        >()

        for (const activity of enrichedActivities) {
          // Inngest serializes Date to ISO string — always reconstruct
          const occurredAt = toSyncDate(activity.occurredAt as Date | string)

          const repoId = repoIdMap.get(activity.repoExternalId)
          if (!repoId) continue

          const { filePaths, additions, deletions } = activity

          const raw = buildActivityRaw({
            file_paths: filePaths,
            additions,
            deletions,
            github_url: activity.githubUrl,
          })

          const [inserted] = await tx
            .insert(activitiesTable)
            .values({
              userId,
              repoId,
              source: activity.source,
              externalId: activity.externalId,
              type: activity.type,
              occurredAt,
              raw,
            })
            .onConflictDoNothing()
            .returning({ id: activitiesTable.id })

          if (!inserted) continue

          const ctx: ClassificationContext = {
            parsedPackageJsonDeps: [],
            parsedRequirementsTxtDeps: [],
            parsedPyprojectTomlDeps: [],
            parsedGoModDeps: [],
            parsedPomXmlDeps: [],
            parsedGradleDeps: [],
            parsedGemfileDeps: [],
            parsedCargoTomlDeps: [],
            primaryLanguage: repoMap.get(activity.repoExternalId)?.primaryLanguage ?? null,
          }

          const results = classifier.classify(
            { ...activity, occurredAt, filePaths, additions, deletions },
            ctx,
          )

          for (const result of results) {
            await tx
              .insert(activityTerritoriesTable)
              .values({
                activityId: inserted.id,
                territoryType: result.territory,
                weight: result.weight.toString(),
                techKeys: result.techKeys,
              })
              .onConflictDoUpdate({
                target: [
                  activityTerritoriesTable.activityId,
                  activityTerritoriesTable.territoryType,
                ],
                set: { weight: result.weight.toString(), techKeys: result.techKeys },
              })

            for (const techKey of result.techKeys) {
              const existing = landmarkAccum.get(techKey)
              landmarkAccum.set(techKey, {
                weight: (existing?.weight ?? 0) + result.weight,
                territory: result.territory,
                lastDate:
                  !existing?.lastDate || occurredAt > existing.lastDate
                    ? occurredAt
                    : existing.lastDate,
              })
            }
          }
        }

        for (const [techKey, { weight, territory, lastDate }] of Array.from(
          landmarkAccum.entries(),
        )) {
          const [existing] = await tx
            .select({
              weight: landmarksTable.weight,
              firstUnlockedAt: landmarksTable.firstUnlockedAt,
            })
            .from(landmarksTable)
            .where(and(eq(landmarksTable.userId, userId), eq(landmarksTable.techKey, techKey)))

          const existingWeight = existing ? parseFloat(existing.weight) : 0
          const newWeight = existingWeight + weight
          const firstUnlockedAt =
            toSyncDateOrNull(existing?.firstUnlockedAt) ??
            (newWeight >= LANDMARK_UNLOCK_THRESHOLD ? lastDate : null)

          await tx
            .insert(landmarksTable)
            .values({
              userId,
              techKey,
              territoryType: territory,
              weight: newWeight.toString(),
              firstUnlockedAt,
              lastGrownAt: lastDate,
            })
            .onConflictDoUpdate({
              target: [landmarksTable.userId, landmarksTable.techKey],
              set: { weight: newWeight.toString(), firstUnlockedAt, lastGrownAt: lastDate },
            })
        }
      })
    })

    await step.run('recompute-denorm', () => recomputeUserDenorm(userId))

    await step.run('mark-cinematic', () =>
      markFirstStarCinematicIfApplicable({ userId, previousLitCount }),
    )

    const latestEventId = await github.getLatestEventId(user.githubLogin)
    await updateUserSyncState(userId, {
      lastEventId: latestEventId ?? user.lastEventId,
      lastIncrementalSyncAt: now,
    })

    await step.run('complete-job', () => completeSyncJob(jobId))

    return {}
  } catch (err) {
    await failSyncJob(jobId, err instanceof Error ? err.message : String(err))
    throw err
  }
}
