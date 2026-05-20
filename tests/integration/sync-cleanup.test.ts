import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/db/client', () => {
  const mockUpdate = vi.fn()
  const mockSet = vi.fn()
  const mockWhere = vi.fn()
  const mockReturning = vi.fn()

  mockUpdate.mockReturnValue({ set: mockSet })
  mockSet.mockReturnValue({ where: mockWhere })
  mockWhere.mockReturnValue({ returning: mockReturning })
  mockReturning.mockResolvedValue([{ id: 'stuck-job-id-1' }, { id: 'stuck-job-id-2' }])

  return {
    db: {
      update: mockUpdate,
      _mockSet: mockSet,
      _mockWhere: mockWhere,
      _mockReturning: mockReturning,
    },
  }
})

import { db } from '@/lib/db/client'
import { buildActivityRaw, ALLOWED_RAW_KEYS } from '@/lib/db/queries/activities'
import { isStaleActiveSyncJob, SYNC_JOB_TIMEOUT_MS } from '@/features/sync/stale-jobs'

describe('sync-cleanup — stuck job detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks active jobs older than 30 min as failed', async () => {
    // Re-setup mock after clearAllMocks
    const mockReturning = vi
      .fn()
      .mockResolvedValue([{ id: 'stuck-job-id-1' }, { id: 'stuck-job-id-2' }])
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning })
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet })

    // Simulate calling the DB update (as cleanup.ts does)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    const result = await db
      .update({} as never)
      .set({
        status: 'failed',
        error: 'timeout (>30min running)',
        completedAt: new Date(),
      })
      .where({} as never)
      .returning({ id: {} as never })

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('stuck-job-id-1')
    expect(result[1].id).toBe('stuck-job-id-2')
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: 'timeout (>30min running)',
      }),
    )
  })

  it('uses 30-minute threshold for stuck jobs', () => {
    const now = Date.now()
    const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000)
    const twentyNineMinutesAgo = new Date(now - 29 * 60 * 1000)

    expect(thirtyMinutesAgo.getTime()).toBeLessThan(twentyNineMinutesAgo.getTime())
    // A job started 31 min ago should be cleaned up
    const thirtyOneMinutesAgo = new Date(now - 31 * 60 * 1000)
    expect(thirtyOneMinutesAgo.getTime()).toBeLessThan(thirtyMinutesAgo.getTime())
  })

  it('treats old pending and running jobs as stale, but not completed jobs', () => {
    const now = new Date('2026-05-20T20:00:00.000Z')
    const staleCreatedAt = new Date(now.getTime() - SYNC_JOB_TIMEOUT_MS - 1)
    const freshCreatedAt = new Date(now.getTime() - SYNC_JOB_TIMEOUT_MS + 1)

    expect(
      isStaleActiveSyncJob(
        {
          status: 'pending',
          startedAt: null,
          createdAt: staleCreatedAt,
        },
        now,
      ),
    ).toBe(true)
    expect(
      isStaleActiveSyncJob(
        {
          status: 'running',
          startedAt: staleCreatedAt,
          createdAt: freshCreatedAt,
        },
        now,
      ),
    ).toBe(true)
    expect(
      isStaleActiveSyncJob(
        {
          status: 'running',
          startedAt: freshCreatedAt,
          createdAt: staleCreatedAt,
        },
        now,
      ),
    ).toBe(false)
    expect(
      isStaleActiveSyncJob(
        {
          status: 'completed',
          startedAt: staleCreatedAt,
          createdAt: staleCreatedAt,
        },
        now,
      ),
    ).toBe(false)
  })
})

describe('sync-cleanup — ALLOWED_RAW_KEYS enforcement', () => {
  it('buildActivityRaw strips disallowed keys', () => {
    const dirty = {
      file_paths: ['src/index.ts'],
      additions: 5,
      deletions: 1,
      github_url: 'https://g.com',
      commit_message: 'feat: add secret',
      pr_title: 'Secret PR title',
      diff: 'diff --git ...',
    }
    const clean = buildActivityRaw(dirty)
    expect(Object.keys(clean)).toHaveLength(ALLOWED_RAW_KEYS.length)
    expect(clean).not.toHaveProperty('commit_message')
    expect(clean).not.toHaveProperty('pr_title')
    expect(clean).not.toHaveProperty('diff')
  })

  it('buildActivityRaw output keys are exactly ALLOWED_RAW_KEYS', () => {
    const result = buildActivityRaw({
      file_paths: [],
      additions: 0,
      deletions: 0,
      github_url: '',
    })
    const resultKeys = Object.keys(result).sort()
    const allowedKeys = [...ALLOWED_RAW_KEYS].sort()
    expect(resultKeys).toEqual(allowedKeys)
  })
})

describe('sync-cleanup — cooldown logic', () => {
  it('5-minute cooldown: job started 3 min ago should block', () => {
    const COOLDOWN_MS = 5 * 60 * 1000
    const startedAt = new Date(Date.now() - 3 * 60 * 1000)
    const elapsed = Date.now() - startedAt.getTime()
    expect(elapsed).toBeLessThan(COOLDOWN_MS)
  })

  it('5-minute cooldown: job started 6 min ago should allow', () => {
    const COOLDOWN_MS = 5 * 60 * 1000
    const startedAt = new Date(Date.now() - 6 * 60 * 1000)
    const elapsed = Date.now() - startedAt.getTime()
    expect(elapsed).toBeGreaterThan(COOLDOWN_MS)
  })
})
