import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const githubClient = vi.hoisted(() => ({
  listAuthoredActivities: vi.fn(),
  fetchCommitFiles: vi.fn(),
  getLatestEventId: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  db: {
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => fn({})),
  },
}))

vi.mock('@/lib/db/queries/sync-jobs', () => ({
  createSyncJob: vi.fn(),
  startSyncJob: vi.fn(),
  completeSyncJob: vi.fn(),
  failSyncJob: vi.fn(),
  getLatestStartedSyncJobForUser: vi.fn(),
}))

vi.mock('@/lib/db/queries/repositories', () => ({
  getIncludedRepositoriesForUser: vi.fn(),
}))

vi.mock('@/lib/db/queries/users', () => ({
  getUserById: vi.fn(),
  getUsersWithTokens: vi.fn(),
  updateUserSyncState: vi.fn(),
}))

vi.mock('@/lib/github/token', () => ({
  getUsableAccessToken: vi.fn(),
}))

vi.mock('@/features/sync/sources/github', () => ({
  GitHubSourceClient: vi.fn(() => githubClient),
}))

vi.mock('@/features/sync/repository-discovery', () => ({
  discoverUserRepositories: vi.fn(),
}))

vi.mock('@/features/sync/denorm', () => ({
  recomputeUserDenorm: vi.fn(),
}))

vi.mock('@/features/sync/cinematic-detection', () => ({
  getPreviousLitCount: vi.fn(),
  markFirstStarCinematicIfApplicable: vi.fn(),
}))

import { run } from '@/features/sync/manual'
import { discoverUserRepositories } from '@/features/sync/repository-discovery'
import { getUsableAccessToken } from '@/lib/github/token'
import { getIncludedRepositoriesForUser } from '@/lib/db/queries/repositories'
import { getUserById, updateUserSyncState } from '@/lib/db/queries/users'
import {
  completeSyncJob,
  createSyncJob,
  failSyncJob,
  getLatestStartedSyncJobForUser,
  startSyncJob,
} from '@/lib/db/queries/sync-jobs'
import {
  getPreviousLitCount,
  markFirstStarCinematicIfApplicable,
} from '@/features/sync/cinematic-detection'
import { recomputeUserDenorm } from '@/features/sync/denorm'
import type { DbRepository } from '@/lib/db/queries/repositories'

const includedRepo: DbRepository = {
  id: 'repo-new',
  userId: 'user-1',
  source: 'github',
  externalRepoId: 'R_new',
  owner: 'jh-choi',
  name: 'new-repo',
  primaryLanguage: 'TypeScript',
  isIncluded: true,
  isAvailable: true,
  sourcePushedAt: new Date('2026-05-21T12:00:00.000Z'),
  manifestContext: null,
  manifestSourcePushedAt: null,
  manifestCachedAt: null,
  historicalBootstrapSourcePushedAt: null,
  historicalBootstrapCheckedAt: null,
  commitsFetchedSourcePushedAt: null,
  lastSyncedAt: null,
  createdAt: new Date('2026-05-21T12:00:00.000Z'),
}

function createStep() {
  return {
    run: vi.fn(async (_name: string, fn: () => Promise<unknown> | unknown) => fn()),
  }
}

describe('manual sync repository discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21T12:30:00.000Z'))

    vi.mocked(getLatestStartedSyncJobForUser).mockResolvedValue(null)
    vi.mocked(getUserById).mockResolvedValue({
      id: 'user-1',
      githubLogin: 'jh-choi',
      lastEventId: 'event-old',
      lastIncrementalSyncAt: null,
    } as Awaited<ReturnType<typeof getUserById>>)
    vi.mocked(createSyncJob).mockResolvedValue({
      id: 'job-created',
    } as Awaited<ReturnType<typeof createSyncJob>>)
    vi.mocked(startSyncJob).mockResolvedValue(undefined)
    vi.mocked(completeSyncJob).mockResolvedValue(undefined)
    vi.mocked(failSyncJob).mockResolvedValue(undefined)
    vi.mocked(getUsableAccessToken).mockResolvedValue('token')
    vi.mocked(discoverUserRepositories).mockResolvedValue([includedRepo])
    vi.mocked(getIncludedRepositoriesForUser).mockResolvedValue([includedRepo])
    vi.mocked(getPreviousLitCount).mockResolvedValue(0)
    vi.mocked(markFirstStarCinematicIfApplicable).mockResolvedValue(undefined)
    vi.mocked(recomputeUserDenorm).mockResolvedValue(undefined)
    vi.mocked(updateUserSyncState).mockResolvedValue(undefined)
    githubClient.listAuthoredActivities.mockResolvedValue([])
    githubClient.getLatestEventId.mockResolvedValue('event-new')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('discovers GitHub repos before reading included repo activity', async () => {
    const step = createStep()

    await run({ data: { userId: 'user-1', jobId: 'job-existing' } }, step as never)

    expect(discoverUserRepositories).toHaveBeenCalledWith('user-1', githubClient)
    expect(githubClient.listAuthoredActivities).toHaveBeenCalledWith({
      repoExternalIds: ['R_new'],
      since: new Date('2026-05-14T12:30:00.000Z'),
    })
    expect(updateUserSyncState).toHaveBeenCalledWith('user-1', {
      lastEventId: 'event-new',
      lastIncrementalSyncAt: new Date('2026-05-21T12:30:00.000Z'),
    })
    expect(completeSyncJob).toHaveBeenCalledWith('job-existing')

    expect(vi.mocked(discoverUserRepositories).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(getIncludedRepositoriesForUser).mock.invocationCallOrder[0] ?? 0,
    )
    expect(vi.mocked(getIncludedRepositoriesForUser).mock.invocationCallOrder[0]).toBeLessThan(
      githubClient.listAuthoredActivities.mock.invocationCallOrder[0] ?? 0,
    )
  })
})
