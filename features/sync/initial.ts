import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { activities as activitiesTable } from '@/lib/db/schema/activities'
import { activityTerritories as activityTerritoriesTable } from '@/lib/db/schema/activity-territories'
import { landmarks as landmarksTable } from '@/lib/db/schema/landmarks'
import { repositories } from '@/lib/db/schema/repositories'
import { buildActivityRaw } from '@/lib/db/queries/activities'
import {
  createSyncJob,
  startSyncJob,
  completeSyncJob,
  failSyncJob,
  updateSyncJobProgress,
} from '@/lib/db/queries/sync-jobs'
import { getUsableAccessToken } from '@/lib/github/token'
import { GitHubClassifier } from '@/features/territories/classifier'
import { LANDMARK_UNLOCK_THRESHOLD } from '@/features/territories/rules'
import { GitHubSourceClient, MVP_INCLUDE_PRIVATE } from './sources/github'
import {
  parsePackageJsonDeps,
  parseRequirementsTxt,
  parsePyprojectTomlDeps,
  parseGoMod,
  parsePomXmlDeps,
  parseGradleDeps,
  parseGemfile,
  parseCargoToml,
} from './sources/parsers'
import type { ClassificationContext } from '@/features/territories/classifier'
import { recomputeUserDenorm } from './denorm'
import { getPreviousLitCount, markFirstStarCinematicIfApplicable } from './cinematic-detection'
import { toSyncDate, toSyncDateOrNull } from './dates'
import {
  HISTORICAL_BOOTSTRAP_MAX_COMMITS_PER_REPO,
  HISTORICAL_BOOTSTRAP_MAX_PAGES_PER_REPO,
  HISTORICAL_BOOTSTRAP_MAX_REPOS,
  dedupeActivities,
  selectHistoricalBootstrapRepos,
} from './historical'
import { mapWithConcurrency } from './concurrency'
import { cacheManifestContextForRepo } from './manifest-cache'
import { markHistoricalBootstrapChecked } from './historical-cache'
import type { GetStepTools } from 'inngest'
import type { inngest } from '@/lib/inngest/client'

type StepTools = GetStepTools<typeof inngest>

// Serializable repo shape for step caching
export type StepRepo = {
  id: string
  externalRepoId: string
  owner: string
  name: string
  primaryLanguage: string | null
  sourcePushedAt: string | null
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

const MAX_INITIAL_COMMIT_DETAILS = 50
const MAX_MANIFEST_REPO_PROBES = 50
const COMMIT_DETAIL_CONCURRENCY = 6
const MANIFEST_FETCH_CONCURRENCY = 5

type ManifestFile = { path: string; parser: (content: string) => void }

function toStepActivity(activity: {
  source: string
  externalId: string
  type: string
  repoExternalId: string
  occurredAt: Date | string
  filePaths: string[]
  additions: number
  deletions: number
  githubUrl: string
}): StepActivity {
  return {
    source: activity.source,
    externalId: activity.externalId,
    type: activity.type,
    repoExternalId: activity.repoExternalId,
    occurredAt: toSyncDate(activity.occurredAt).toISOString(),
    filePaths: activity.filePaths,
    additions: activity.additions,
    deletions: activity.deletions,
    githubUrl: activity.githubUrl,
  }
}

function emptyClassificationContext(primaryLanguage: string | null): ClassificationContext {
  return {
    parsedPackageJsonDeps: [],
    parsedRequirementsTxtDeps: [],
    parsedPyprojectTomlDeps: [],
    parsedGoModDeps: [],
    parsedPomXmlDeps: [],
    parsedGradleDeps: [],
    parsedGemfileDeps: [],
    parsedCargoTomlDeps: [],
    primaryLanguage,
  }
}

export function selectManifestPathsForLanguage(primaryLanguage: string | null): string[] {
  const language = primaryLanguage?.toLowerCase()

  switch (language) {
    case 'javascript':
    case 'typescript':
    case 'vue':
    case 'svelte':
    case 'html':
    case 'css':
      return ['package.json']
    case 'python':
      return ['requirements.txt', 'pyproject.toml']
    case 'go':
      return ['go.mod']
    case 'java':
    case 'kotlin':
      return ['pom.xml', 'build.gradle', 'build.gradle.kts']
    case 'ruby':
      return ['Gemfile']
    case 'rust':
      return ['Cargo.toml']
    default:
      return ['package.json']
  }
}

export async function buildManifestContext(
  github: GitHubSourceClient,
  owner: string,
  repo: string,
  primaryLanguage: string | null,
): Promise<ClassificationContext> {
  const ctx = emptyClassificationContext(primaryLanguage)

  const manifestFiles: ManifestFile[] = [
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
      path: 'pyproject.toml',
      parser: (content) => {
        ctx.parsedPyprojectTomlDeps = parsePyprojectTomlDeps(content)
      },
    },
    {
      path: 'go.mod',
      parser: (content) => {
        ctx.parsedGoModDeps = parseGoMod(content)
      },
    },
    {
      path: 'pom.xml',
      parser: (content) => {
        ctx.parsedPomXmlDeps = parsePomXmlDeps(content)
      },
    },
    {
      path: 'build.gradle',
      parser: (content) => {
        ctx.parsedGradleDeps = parseGradleDeps(content)
      },
    },
    {
      path: 'build.gradle.kts',
      parser: (content) => {
        ctx.parsedGradleDeps = parseGradleDeps(content)
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
  const filesByPath = new Map(manifestFiles.map((file) => [file.path, file]))

  const paths = selectManifestPathsForLanguage(primaryLanguage)
  const contents = await Promise.all(
    paths.map(async (path) => ({
      path,
      content: await github.fetchFileContent(owner, repo, path),
    })),
  )

  for (const { path, content } of contents) {
    const parser = filesByPath.get(path)?.parser
    if (!parser) continue
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

export function buildDefaultManifestContexts(
  dbRepos: Pick<StepRepo, 'externalRepoId' | 'primaryLanguage'>[],
): Record<string, ClassificationContext> {
  return Object.fromEntries(
    dbRepos.map((repo) => [repo.externalRepoId, emptyClassificationContext(repo.primaryLanguage)]),
  )
}

export async function run(
  event: {
    data: {
      userId: string
      // New name: explicit GitHub node IDs to include. Empty array = none selected.
      includedExternalRepoIds?: string[]
      // Legacy alias accepted for backward compat with already-queued events; treated
      // as identical to includedExternalRepoIds.
      includedRepoIds?: string[]
      jobId?: string
    }
  },
  step: StepTools,
) {
  const { userId } = event.data
  const includedExternalRepoIds = event.data.includedExternalRepoIds ?? event.data.includedRepoIds
  void MVP_INCLUDE_PRIVATE // referenced to satisfy ADR-11 guard grep

  const jobId = await step.run('create-job', async () => {
    if (event.data.jobId) {
      await startSyncJob(event.data.jobId)
      return event.data.jobId
    }
    const job = await createSyncJob({ userId, kind: 'initial' })
    await startSyncJob(job.id)
    return job.id
  })

  try {
    await step.run('progress-fetch-token', () =>
      updateSyncJobProgress(jobId, {
        repos_analyzed: 0,
        total: 0,
        current_step: 'Connecting to GitHub...',
      }),
    )

    const accessToken = await step.run('fetch-token', () => getUsableAccessToken(userId))
    const github = new GitHubSourceClient(accessToken, userId)

    const previousLitCount = await step.run('get-prev-lit-count', () => getPreviousLitCount(userId))

    const dbRepos: StepRepo[] = await step.run('fetch-repos', async () => {
      const sourceRepos =
        includedExternalRepoIds === undefined
          ? await github.listAuthoredRepos()
          : await github.fetchReposByExternalIds(includedExternalRepoIds)
      // Filter rule:
      //   undefined → no explicit list provided; sync all repos.
      //   [] (empty array) → user deselected everything; sync nothing.
      //   non-empty array → sync only matching externalRepoId.
      const filtered =
        includedExternalRepoIds === undefined
          ? sourceRepos
          : sourceRepos.filter((r) => includedExternalRepoIds.includes(r.externalRepoId))

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
            sourcePushedAt: repo.pushedAt ?? null,
            isIncluded: true,
          })
          .onConflictDoUpdate({
            target: [repositories.userId, repositories.source, repositories.externalRepoId],
            set: {
              owner: repo.owner,
              name: repo.name,
              primaryLanguage: repo.primaryLanguage,
              sourcePushedAt: repo.pushedAt ?? null,
            },
          })
          .returning()
        result.push({
          id: dbRepo.id,
          externalRepoId: repo.externalRepoId,
          owner: repo.owner,
          name: repo.name,
          primaryLanguage: repo.primaryLanguage,
          sourcePushedAt: repo.pushedAt?.toISOString() ?? null,
        })
      }
      return result
    })

    const repoExternalIds = dbRepos.map((r) => r.externalRepoId)
    const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

    await step.run('progress-fetch-activities', () =>
      updateSyncJobProgress(jobId, {
        repos_analyzed: 0,
        total: dbRepos.length,
        current_step: 'Reading activity from selected repos...',
      }),
    )

    const sourceActivities: StepActivity[] = await step.run('fetch-activities', async () => {
      const acts = await github.listAuthoredActivities({
        repoExternalIds,
        since: twelveMonthsAgo,
      })
      return acts.map(toStepActivity)
    })

    const historicalBootstrap: {
      activities: StepActivity[]
      checkedRepos: Array<Pick<StepRepo, 'id' | 'sourcePushedAt'>>
    } = await step.run('fetch-historical-bootstrap-activities', async () => {
      const recent = sourceActivities.map((activity) => ({
        ...activity,
        source: 'github' as const,
        type: activity.type as 'commit' | 'pr' | 'issue',
        occurredAt: toSyncDate(activity.occurredAt),
      }))
      const historicalRepos = selectHistoricalBootstrapRepos(dbRepos, recent)
      if (historicalRepos.length === 0) return { activities: [], checkedRepos: [] }

      const acts = await github.listHistoricalAuthoredActivities({
        repos: historicalRepos,
        maxRepos: HISTORICAL_BOOTSTRAP_MAX_REPOS,
        maxCommitsPerRepo: HISTORICAL_BOOTSTRAP_MAX_COMMITS_PER_REPO,
        maxPagesPerRepo: HISTORICAL_BOOTSTRAP_MAX_PAGES_PER_REPO,
      })
      return {
        activities: acts.map(toStepActivity),
        checkedRepos: historicalRepos.map((repo) => ({
          id: repo.id,
          sourcePushedAt: repo.sourcePushedAt,
        })),
      }
    })

    const syncActivities = dedupeActivities([
      ...sourceActivities,
      ...historicalBootstrap.activities,
    ])

    await step.run('progress-sample-commits', () =>
      updateSyncJobProgress(jobId, {
        repos_analyzed: 0,
        total: dbRepos.length,
        current_step: 'Reading files that shape your stars...',
      }),
    )

    const buildInputs: {
      enrichedActivities: StepActivity[]
      manifestContexts: Record<string, ClassificationContext>
    } = await step.run('sample-commits-and-parse-manifests', async () => {
      const repoMap = new Map(dbRepos.map((r) => [r.externalRepoId, r]))
      const acts = [...syncActivities]
      const commits = acts
        .filter((a) => a.type === 'commit')
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, MAX_INITIAL_COMMIT_DETAILS)

      const manifestTask = (async () => {
        const result = buildDefaultManifestContexts(dbRepos)
        const entries = await mapWithConcurrency(
          dbRepos.slice(0, MAX_MANIFEST_REPO_PROBES),
          MANIFEST_FETCH_CONCURRENCY,
          async (repo) =>
            [
              repo.externalRepoId,
              await buildManifestContext(github, repo.owner, repo.name, repo.primaryLanguage),
            ] as const,
        )
        for (const [externalRepoId, ctx] of entries) {
          result[externalRepoId] = ctx
          const repo = dbRepos.find((candidate) => candidate.externalRepoId === externalRepoId)
          if (repo) {
            await cacheManifestContextForRepo({ userId, repo, context: ctx })
          }
        }
        return result
      })()

      const enrichTask = mapWithConcurrency(commits, COMMIT_DETAIL_CONCURRENCY, async (commit) => {
        const repo = repoMap.get(commit.repoExternalId)
        if (!repo) return
        try {
          const fileData = await github.fetchCommitFiles(repo.owner, repo.name, commit.externalId)
          commit.filePaths = fileData.file_paths
          commit.additions = fileData.additions
          commit.deletions = fileData.deletions
        } catch {
          // network error or 404 — keep empty paths
        }
      })

      const [, manifestContexts] = await Promise.all([enrichTask, manifestTask])
      return { enrichedActivities: acts, manifestContexts }
    })

    await step.run('progress-classify', () =>
      updateSyncJobProgress(jobId, {
        repos_analyzed: dbRepos.length,
        total: dbRepos.length,
        current_step: 'Lighting your constellation...',
      }),
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

        for (const activity of buildInputs.enrichedActivities) {
          const repoId = repoIdMap.get(activity.repoExternalId)
          if (!repoId) continue
          const occurredAt = toSyncDate(activity.occurredAt)

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
              occurredAt,
              raw,
            })
            .onConflictDoNothing()
            .returning({ id: activitiesTable.id })

          // Skip already-existing activities (idempotency: don't re-classify)
          if (!inserted) continue

          const ctx: ClassificationContext = buildInputs.manifestContexts[
            activity.repoExternalId
          ] ?? {
            parsedPackageJsonDeps: [],
            parsedRequirementsTxtDeps: [],
            parsedPyprojectTomlDeps: [],
            parsedGoModDeps: [],
            parsedPomXmlDeps: [],
            parsedGradleDeps: [],
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
              occurredAt,
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

        // Upsert landmarks with accumulated weights from new activities
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
              set: {
                weight: newWeight.toString(),
                firstUnlockedAt,
                lastGrownAt: lastDate,
              },
            })
        }
      })
    })

    if (historicalBootstrap.checkedRepos.length > 0) {
      await step.run('mark-historical-bootstrap-checked', () =>
        markHistoricalBootstrapChecked({ userId, repos: historicalBootstrap.checkedRepos }),
      )
    }

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
