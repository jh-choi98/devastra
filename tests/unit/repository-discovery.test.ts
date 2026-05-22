import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  values: vi.fn(),
  onConflictDoUpdate: vi.fn(),
  returning: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  db: {
    insert: dbMock.insert,
    update: dbMock.update,
  },
}))

import { discoverUserRepositories } from '@/features/sync/repository-discovery'
import type { GitHubSourceClient } from '@/features/sync/sources/github'

describe('discoverUserRepositories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.insert.mockReturnValue({ values: dbMock.values })
    dbMock.values.mockReturnValue({ onConflictDoUpdate: dbMock.onConflictDoUpdate })
    dbMock.onConflictDoUpdate.mockReturnValue({ returning: dbMock.returning })
    dbMock.update.mockReturnValue({ set: dbMock.set })
    dbMock.set.mockReturnValue({ where: dbMock.where })
    dbMock.where.mockResolvedValue(undefined)
  })

  it('inserts newly discovered repos and marks missing included repos as excluded', async () => {
    const pushedAt = new Date('2026-05-21T12:00:00.000Z')
    const github = {
      listAuthoredRepos: vi.fn().mockResolvedValue([
        {
          source: 'github',
          externalRepoId: 'R_existing',
          owner: 'jh-choi',
          name: 'existing-repo',
          primaryLanguage: 'TypeScript',
          isPrivate: false,
          pushedAt,
        },
        {
          source: 'github',
          externalRepoId: 'R_new',
          owner: 'jh-choi',
          name: 'new-repo',
          primaryLanguage: 'Go',
          isPrivate: false,
          pushedAt: null,
        },
      ]),
    } as unknown as GitHubSourceClient

    dbMock.returning.mockResolvedValueOnce([
      {
        id: 'repo-existing',
        externalRepoId: 'R_existing',
        isIncluded: false,
        isAvailable: true,
      },
      { id: 'repo-new', externalRepoId: 'R_new', isIncluded: true, isAvailable: true },
    ])

    const repos = await discoverUserRepositories('user-1', github)

    expect(repos.map((repo) => repo.externalRepoId)).toEqual(['R_existing', 'R_new'])
    expect(repos.map((repo) => repo.isIncluded)).toEqual([false, true])

    expect(dbMock.values).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: 'user-1',
        externalRepoId: 'R_existing',
        isIncluded: true,
        isAvailable: true,
        sourcePushedAt: pushedAt,
      }),
      expect.objectContaining({
        userId: 'user-1',
        externalRepoId: 'R_new',
        isIncluded: true,
        isAvailable: true,
        sourcePushedAt: null,
      }),
    ])
    expect(dbMock.insert).toHaveBeenCalledTimes(1)

    const conflict = dbMock.onConflictDoUpdate.mock.calls[0]?.[0] as {
      set: Record<string, unknown>
    }
    expect(conflict.set).not.toHaveProperty('isIncluded')
    expect(dbMock.update).toHaveBeenCalledTimes(1)
    expect(dbMock.set).toHaveBeenCalledWith({ isIncluded: false, isAvailable: false })
  })

  it('marks previously included GitHub repos as excluded when GitHub returns no public repos', async () => {
    const github = {
      listAuthoredRepos: vi.fn().mockResolvedValue([]),
    } as unknown as GitHubSourceClient

    await expect(discoverUserRepositories('user-1', github)).resolves.toEqual([])
    expect(dbMock.insert).not.toHaveBeenCalled()
    expect(dbMock.update).toHaveBeenCalledTimes(1)
    expect(dbMock.set).toHaveBeenCalledWith({ isIncluded: false, isAvailable: false })
  })
})
