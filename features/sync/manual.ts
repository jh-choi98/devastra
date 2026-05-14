import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { activities as activitiesTable } from '@/lib/db/schema/activities'
import { activityTerritories as activityTerritoriesTable } from '@/lib/db/schema/activity-territories'
import { landmarks as landmarksTable } from '@/lib/db/schema/landmarks'
import { buildActivityRaw } from '@/lib/db/queries/activities'
import { createSyncJob, startSyncJob, completeSyncJob, failSyncJob } from '@/lib/db/queries/sync-jobs'
import { getIncludedRepositoriesForUser } from '@/lib/db/queries/repositories'
import { getUserById, updateUserSyncState } from '@/lib/db/queries/users'
import { getLatestSyncJobForUser } from '@/lib/db/queries/sync-jobs'
import { getUsableAccessToken } from '@/lib/github/token'
import { GitHubClassifier } from '@/features/territories/classifier'
import { LANDMARK_UNLOCK_THRESHOLD } from '@/features/territories/rules'
import { GitHubSourceClient } from './sources/github'
import type { ClassificationContext } from '@/features/territories/classifier'
import { recomputeUserDenorm } from './denorm'
import { getPreviousLitCount, markFirstStarCinematicIfApplicable } from './cinematic-detection'
import type { GetStepTools } from 'inngest'
import type { inngest } from '@/lib/inngest/client'

type StepTools = GetStepTools<typeof inngest>

const COOLDOWN_MS = 5 * 60 * 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

export async function run(
  event: { data: { userId: string } },
  step: StepTools,
): Promise<{ skipped?: boolean; reason?: string }> {
  const { userId } = event.data

  // Cooldown check — fast DB query, done inline before any steps
  const recent = await getLatestSyncJobForUser(userId)
  if (recent?.startedAt && Date.now() - recent.startedAt.getTime() < COOLDOWN_MS) {
    return { skipped: true, reason: 'cooldown' }
  }

  const user = await getUserById(userId)
  if (!user) return { skipped: true, reason: 'user-not-found' }

  const jobId = await step.run('create-job', async () => {
    const j = await createSyncJob({ userId, kind: 'manual' })
    await startSyncJob(j.id)
    return j.id
  })

  try {
    const accessToken = await step.run('fetch-token', () => getUsableAccessToken(userId))
    const github = new GitHubSourceClient(accessToken, userId)

    const previousLitCount = await step.run('get-prev-lit-count', () =>
      getPreviousLitCount(userId),
    )

    const now = new Date()
    const sinceDate =
      user.lastIncrementalSyncAt != null &&
      now.getTime() - user.lastIncrementalSyncAt.getTime() < NINETY_DAYS_MS
        ? user.lastIncrementalSyncAt
        : new Date(now.getTime() - SEVEN_DAYS_MS)

    const dbRepos = await getIncludedRepositoriesForUser(userId)
    const repoExternalIds = dbRepos.map((r) => r.externalRepoId)
    const repoIdMap = new Map(dbRepos.map((r) => [r.externalRepoId, r.id]))

    const sourceActivities = await step.run('fetch-activities', () =>
      github.listAuthoredActivities({ repoExternalIds, since: sinceDate }),
    )

    await step.run('classify-and-write', async () => {
      const classifier = new GitHubClassifier()

      await db.transaction(async (tx) => {
        const landmarkAccum = new Map<string, { weight: number; territory: string; lastDate: Date }>()

        for (const activity of sourceActivities) {
          // Inngest serializes Date to ISO string — always reconstruct
          const occurredAt = new Date(activity.occurredAt as unknown as string)

          const repoId = repoIdMap.get(activity.repoExternalId)
          if (!repoId) continue

          let { filePaths, additions, deletions } = activity

          if (activity.type === 'commit' && filePaths.length === 0) {
            const repo = dbRepos.find((r) => r.externalRepoId === activity.repoExternalId)
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
              } catch {
                // skip
              }
            }
          }

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
            parsedGoModDeps: [],
            parsedGemfileDeps: [],
            parsedCargoTomlDeps: [],
            primaryLanguage: null,
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
              })
              .onConflictDoUpdate({
                target: [
                  activityTerritoriesTable.activityId,
                  activityTerritoriesTable.territoryType,
                ],
                set: { weight: result.weight.toString() },
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

        for (const [techKey, { weight, territory, lastDate }] of Array.from(landmarkAccum.entries())) {
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
            existing?.firstUnlockedAt ?? (newWeight >= LANDMARK_UNLOCK_THRESHOLD ? lastDate : null)

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
