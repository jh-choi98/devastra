import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { activities as activitiesTable } from '@/lib/db/schema/activities'
import { activityTerritories as activityTerritoriesTable } from '@/lib/db/schema/activity-territories'
import { landmarks as landmarksTable } from '@/lib/db/schema/landmarks'
import { buildActivityRaw } from '@/lib/db/queries/activities'
import { createSyncJob, startSyncJob, completeSyncJob, failSyncJob } from '@/lib/db/queries/sync-jobs'
import { getUsersWithTokens } from '@/lib/db/queries/users'
import { GitHubClassifier } from '@/features/territories/classifier'
import { LANDMARK_UNLOCK_THRESHOLD } from '@/features/territories/rules'
import type { ClassificationContext } from '@/features/territories/classifier'
import { recomputeUserDenorm } from './denorm'
import type { GetStepTools } from 'inngest'
import type { inngest } from '@/lib/inngest/client'

type StepTools = GetStepTools<typeof inngest>

async function backfillUser(userId: string): Promise<void> {
  const job = await createSyncJob({ userId, kind: 'backfill' })
  await startSyncJob(job.id)

  try {
    const classifier = new GitHubClassifier()

    // Fetch all existing activities for this user
    const userActivities = await db
      .select()
      .from(activitiesTable)
      .where(eq(activitiesTable.userId, userId))

    const activityIds = userActivities.map((a) => a.id)

    await db.transaction(async (tx) => {
      // Delete existing classifications
      if (activityIds.length > 0) {
        await tx
          .delete(activityTerritoriesTable)
          .where(inArray(activityTerritoriesTable.activityId, activityIds))
      }
      await tx.delete(landmarksTable).where(eq(landmarksTable.userId, userId))

      const landmarkAccum = new Map<string, { weight: number; territory: string; lastDate: Date }>()

      for (const activity of userActivities) {
        const raw = activity.raw as {
          file_paths?: string[]
          additions?: number
          deletions?: number
          github_url?: string
        }

        const ctx: ClassificationContext = {
          parsedPackageJsonDeps: [],
          parsedRequirementsTxtDeps: [],
          parsedGoModDeps: [],
          parsedGemfileDeps: [],
          parsedCargoTomlDeps: [],
          primaryLanguage: null,
        }

        const results = classifier.classify(
          {
            source: 'github',
            externalId: activity.externalId,
            type: activity.type as 'commit' | 'pr' | 'issue',
            repoExternalId: '',
            occurredAt: activity.occurredAt,
            filePaths: raw.file_paths ?? [],
            additions: raw.additions ?? 0,
            deletions: raw.deletions ?? 0,
            githubUrl: raw.github_url ?? '',
          },
          ctx,
        )

        for (const result of results) {
          await tx
            .insert(activityTerritoriesTable)
            .values({
              activityId: activity.id,
              territoryType: result.territory,
              weight: result.weight.toString(),
            })
            .onConflictDoUpdate({
              target: [activityTerritoriesTable.activityId, activityTerritoriesTable.territoryType],
              set: { weight: result.weight.toString() },
            })

          for (const techKey of result.techKeys) {
            const existing = landmarkAccum.get(techKey)
            landmarkAccum.set(techKey, {
              weight: (existing?.weight ?? 0) + result.weight,
              territory: result.territory,
              lastDate:
                !existing?.lastDate || activity.occurredAt > existing.lastDate
                  ? activity.occurredAt
                  : existing.lastDate,
            })
          }
        }
      }

      // Insert landmarks fresh
      for (const [techKey, { weight, territory, lastDate }] of Array.from(landmarkAccum.entries())) {
        const firstUnlockedAt = weight >= LANDMARK_UNLOCK_THRESHOLD ? lastDate : null
        await tx.insert(landmarksTable).values({
          userId,
          techKey,
          territoryType: territory,
          weight: weight.toString(),
          firstUnlockedAt,
          lastGrownAt: lastDate,
        })
      }
    })

    await recomputeUserDenorm(userId)
    await completeSyncJob(job.id)
  } catch (err) {
    await failSyncJob(job.id, err instanceof Error ? err.message : String(err))
    throw err
  }
}

export async function run(
  event: { data: { userId?: string } },
  step: StepTools,
): Promise<void> {
  const { userId } = event.data

  if (userId) {
    await step.run('backfill-user', () => backfillUser(userId))
  } else {
    // Global backfill: all users with tokens
    const users = await step.run('list-users', () => getUsersWithTokens())
    for (const user of users) {
      await step.run(`backfill-user-${user.id}`, () => backfillUser(user.id))
    }
  }
}
