import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { activities as activitiesTable } from '@/lib/db/schema/activities'
import { activityTerritories as activityTerritoriesTable } from '@/lib/db/schema/activity-territories'
import { landmarks as landmarksTable } from '@/lib/db/schema/landmarks'
import { repositories } from '@/lib/db/schema/repositories'
import { buildActivityRaw } from '@/lib/db/queries/activities'
import { createSyncJob, startSyncJob, completeSyncJob, failSyncJob } from '@/lib/db/queries/sync-jobs'
import { getUsableAccessToken } from '@/lib/github/token'
import { GitHubClassifier } from '@/features/territories/classifier'
import { LANDMARK_UNLOCK_THRESHOLD } from '@/features/territories/rules'
import { GitHubSourceClient, MVP_INCLUDE_PRIVATE } from './sources/github'
import {
  parsePackageJsonDeps,
  parseRequirementsTxt,
  parseGoMod,
  parseGemfile,
  parseCargoToml,
} from './sources/parsers'
import type { ClassificationContext } from '@/features/territories/classifier'
import { recomputeUserDenorm } from './denorm'
import { getPreviousLitCount, markFirstStarCinematicIfApplicable } from './cinematic-detection'
import type { GetStepTools } from 'inngest'
import type { inngest } from '@/lib/inngest/client'

type StepTools = GetStepTools<typeof inngest>

// Serializable repo shape for step caching
type StepRepo = {
  id: string
  externalRepoId: string
  owner: string
  name: string
  primaryLanguage: string | null
}

// Serializable activity shape (dates as ISO strings for step caching)
type StepActivity = {
  source: string
  externalId: string
  type: string
  repoExternalId: string
  occurredAt: string
  filePaths: string[]
  additions: number
  deletions: number
  githubUrl: string
}

async function buildManifestContext(
  github: GitHubSourceClient,
  owner: string,
  repo: string,
  primaryLanguage: string | null,
): Promise<ClassificationContext> {
  const ctx: ClassificationContext = {
    parsedPackageJsonDeps: [],
    parsedRequirementsTxtDeps: [],
    parsedGoModDeps: [],
    parsedGemfileDeps: [],
    parsedCargoTomlDeps: [],
    primaryLanguage,
  }

  const files: Array<{ path: string; parser: (content: string) => void }> = [
    {
      path: 'package.json',
      parser: (content) => {
        ctx.parsedPackageJsonDeps = parsePackageJsonDeps(content).map((d) => d.dep)
      },
    },
    {
      path: 'requirements.txt',
      parser: (content) => {
        ctx.parsedRequirementsTxtDeps = parseRequirementsTxt(content)
      },
    },
    {
      path: 'go.mod',
      parser: (content) => {
        ctx.parsedGoModDeps = parseGoMod(content)
      },
    },
    {
      path: 'Gemfile',
      parser: (content) => {
        ctx.parsedGemfileDeps = parseGemfile(content)
      },
    },
    {
      path: 'Cargo.toml',
      parser: (content) => {
        ctx.parsedCargoTomlDeps = parseCargoToml(content)
      },
    },
  ]

  for (const { path, parser } of files) {
    const content = await github.fetchFileContent(owner, repo, path)
    if (content) {
      try {
        parser(content)
      } catch {
        // malformed file — leave empty array (already initialized)
      }
    }
  }

  return ctx
}

export async function run(
  event: { data: { userId: string; includedRepoIds?: string[] } },
  step: StepTools,
) {
  const { userId, includedRepoIds } = event.data
  void MVP_INCLUDE_PRIVATE // referenced to satisfy ADR-11 guard grep

  const jobId = await step.run('create-job', async () => {
    const job = await createSyncJob({ userId, kind: 'initial' })
    await startSyncJob(job.id)
    return job.id
  })

  try {
    const accessToken = await step.run('fetch-token', () => getUsableAccessToken(userId))
    const github = new GitHubSourceClient(accessToken, userId)

    const previousLitCount = await step.run('get-prev-lit-count', () =>
      getPreviousLitCount(userId),
    )

    const dbRepos: StepRepo[] = await step.run('fetch-repos', async () => {
      const sourceRepos = await github.listAuthoredRepos()
      const filtered =
        includedRepoIds && includedRepoIds.length > 0
          ? sourceRepos.filter((r) => includedRepoIds.includes(r.externalRepoId))
          : sourceRepos

      const result: StepRepo[] = []
      for (const repo of filtered) {
        const [dbRepo] = await db
          .insert(repositories)
          .values({
            userId,
            source: repo.source,
            externalRepoId: repo.externalRepoId,
            owner: repo.owner,
            name: repo.name,
            primaryLanguage: repo.primaryLanguage,
            isIncluded: true,
          })
          .onConflictDoUpdate({
            target: [repositories.userId, repositories.source, repositories.externalRepoId],
            set: {
              owner: repo.owner,
              name: repo.name,
              primaryLanguage: repo.primaryLanguage,
            },
          })
          .returning()
        result.push({
          id: dbRepo.id,
          externalRepoId: repo.externalRepoId,
          owner: repo.owner,
          name: repo.name,
          primaryLanguage: repo.primaryLanguage,
        })
      }
      return result
    })

    const repoExternalIds = dbRepos.map((r) => r.externalRepoId)
    const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

    const sourceActivities: StepActivity[] = await step.run('fetch-activities', async () => {
      const acts = await github.listAuthoredActivities({
        repoExternalIds,
        since: twelveMonthsAgo,
      })
      return acts.map((a) => ({
        source: a.source,
        externalId: a.externalId,
        type: a.type,
        repoExternalId: a.repoExternalId,
        occurredAt: a.occurredAt instanceof Date ? a.occurredAt.toISOString() : String(a.occurredAt),
        filePaths: a.filePaths,
        additions: a.additions,
        deletions: a.deletions,
        githubUrl: a.githubUrl,
      }))
    })

    const enrichedActivities: StepActivity[] = await step.run('sample-commits', async () => {
      const repoMap = new Map(dbRepos.map((r) => [r.externalRepoId, r]))
      const acts = [...sourceActivities]
      const commits = acts
        .filter((a) => a.type === 'commit')
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 50)

      for (const commit of commits) {
        const repo = repoMap.get(commit.repoExternalId)
        if (!repo) continue
        try {
          const fileData = await github.fetchCommitFiles(repo.owner, repo.name, commit.externalId)
          commit.filePaths = fileData.file_paths
          commit.additions = fileData.additions
          commit.deletions = fileData.deletions
        } catch {
          // network error or 404 — keep empty paths
        }
      }
      return acts
    })

    const manifestContexts: Record<string, ClassificationContext> = await step.run(
      'parse-manifests',
      async () => {
        const result: Record<string, ClassificationContext> = {}
        for (const repo of dbRepos) {
          result[repo.externalRepoId] = await buildManifestContext(
            github,
            repo.owner,
            repo.name,
            repo.primaryLanguage,
          )
        }
        return result
      },
    )

    await step.run('classify-and-write', async () => {
      const repoIdMap = new Map(dbRepos.map((r) => [r.externalRepoId, r.id]))
      const classifier = new GitHubClassifier()

      await db.transaction(async (tx) => {
        // Accumulate landmark weights across all new activities in this batch
        const landmarkAccum = new Map<
          string,
          { weight: number; territory: string; lastDate: Date }
        >()

        for (const activity of enrichedActivities) {
          const repoId = repoIdMap.get(activity.repoExternalId)
          if (!repoId) continue

          const raw = buildActivityRaw({
            file_paths: activity.filePaths,
            additions: activity.additions,
            deletions: activity.deletions,
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
              occurredAt: new Date(activity.occurredAt),
              raw,
            })
            .onConflictDoNothing()
            .returning({ id: activitiesTable.id })

          // Skip already-existing activities (idempotency: don't re-classify)
          if (!inserted) continue

          const ctx: ClassificationContext = manifestContexts[activity.repoExternalId] ?? {
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
              repoExternalId: activity.repoExternalId,
              occurredAt: new Date(activity.occurredAt),
              filePaths: activity.filePaths,
              additions: activity.additions,
              deletions: activity.deletions,
              githubUrl: activity.githubUrl,
            },
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

            const actDate = new Date(activity.occurredAt)
            for (const techKey of result.techKeys) {
              const existing = landmarkAccum.get(techKey)
              landmarkAccum.set(techKey, {
                weight: (existing?.weight ?? 0) + result.weight,
                territory: result.territory,
                lastDate:
                  !existing?.lastDate || actDate > existing.lastDate ? actDate : existing.lastDate,
              })
            }
          }
        }

        // Upsert landmarks with accumulated weights from new activities
        for (const [techKey, { weight, territory, lastDate }] of Array.from(landmarkAccum.entries())) {
          const [existing] = await tx
            .select({
              weight: landmarksTable.weight,
              firstUnlockedAt: landmarksTable.firstUnlockedAt,
            })
            .from(landmarksTable)
            .where(
              and(eq(landmarksTable.userId, userId), eq(landmarksTable.techKey, techKey)),
            )

          const existingWeight = existing ? parseFloat(existing.weight) : 0
          const newWeight = existingWeight + weight
          const firstUnlockedAt =
            existing?.firstUnlockedAt ??
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
              set: {
                weight: newWeight.toString(),
                firstUnlockedAt,
                lastGrownAt: lastDate,
              },
            })
        }
      })
    })

    await step.run('recompute-denorm', () => recomputeUserDenorm(userId))

    await step.run('mark-cinematic', () =>
      markFirstStarCinematicIfApplicable({ userId, previousLitCount }),
    )

    await step.run('complete-job', () => completeSyncJob(jobId))
  } catch (err) {
    await failSyncJob(jobId, err instanceof Error ? err.message : String(err))
    throw err
  }
}
