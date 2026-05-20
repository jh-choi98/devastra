import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/auth/session', () => ({
  requireUser: vi.fn(),
}))

vi.mock('@/lib/db/queries/sync-jobs', () => ({
  createSyncJob: vi.fn(),
  failSyncJob: vi.fn(),
  getLatestStartedSyncJobForUser: vi.fn(),
  getLatestSyncJobForUser: vi.fn(),
}))

vi.mock('@/features/sync/stale-jobs', async () => {
  const actual = await vi.importActual<typeof import('@/features/sync/stale-jobs')>(
    '@/features/sync/stale-jobs',
  )
  return {
    ...actual,
    failStaleActiveSyncJobsForUser: vi.fn(),
  }
})

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn(),
  },
}))

import { POST } from '@/app/api/refresh/route'
import { requireUser } from '@/lib/auth/session'
import { failStaleActiveSyncJobsForUser } from '@/features/sync/stale-jobs'
import {
  createSyncJob,
  failSyncJob,
  getLatestStartedSyncJobForUser,
  getLatestSyncJobForUser,
} from '@/lib/db/queries/sync-jobs'
import { inngest } from '@/lib/inngest/client'

const NOW = new Date('2026-05-20T20:00:00.000Z')

function makeSyncJob(overrides: Record<string, unknown>) {
  return {
    id: 'job-1',
    userId: 'user-1',
    kind: 'manual',
    status: 'completed',
    progress: null,
    startedAt: null,
    completedAt: null,
    error: null,
    createdAt: new Date('2026-05-20T19:55:00.000Z'),
    ...overrides,
  }
}

describe('POST /api/refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.clearAllMocks()
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      githubAccessTokenEnc: Buffer.from('token'),
    } as Awaited<ReturnType<typeof requireUser>>)
    vi.mocked(getLatestSyncJobForUser).mockResolvedValue(null)
    vi.mocked(getLatestStartedSyncJobForUser).mockResolvedValue(null)
    vi.mocked(createSyncJob).mockResolvedValue(
      makeSyncJob({ id: 'queued-job', status: 'pending' }) as Awaited<
        ReturnType<typeof createSyncJob>
      >,
    )
    vi.mocked(failSyncJob).mockResolvedValue(undefined)
    vi.mocked(failStaleActiveSyncJobsForUser).mockResolvedValue(0)
    vi.mocked(inngest.send).mockResolvedValue({
      ids: ['event-1'],
    } as Awaited<ReturnType<typeof inngest.send>>)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('queues a manual sync when the user is not syncing or cooling down', async () => {
    const response = await POST()

    await expect(response.json()).resolves.toEqual({ status: 'queued', jobId: 'queued-job' })
    expect(response.status).toBe(200)
    expect(createSyncJob).toHaveBeenCalledWith({ userId: 'user-1', kind: 'manual' })
    expect(inngest.send).toHaveBeenCalledWith({
      name: 'sync/manual.requested',
      data: { userId: 'user-1', jobId: 'queued-job' },
    })
  })

  it('returns disconnected without dispatching when the GitHub token is missing', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      githubAccessTokenEnc: null,
    } as Awaited<ReturnType<typeof requireUser>>)

    const response = await POST()

    await expect(response.json()).resolves.toEqual({ status: 'github_disconnected' })
    expect(response.status).toBe(409)
    expect(getLatestSyncJobForUser).not.toHaveBeenCalled()
    expect(createSyncJob).not.toHaveBeenCalled()
    expect(inngest.send).not.toHaveBeenCalled()
  })

  it('returns cooldown without dispatching when a recent sync started', async () => {
    vi.mocked(getLatestStartedSyncJobForUser).mockResolvedValue(
      makeSyncJob({
        startedAt: new Date('2026-05-20T19:57:00.000Z'),
      }) as Awaited<ReturnType<typeof getLatestStartedSyncJobForUser>>,
    )

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('120')
    expect(body).toEqual({
      status: 'cooldown',
      retryAfterSeconds: 120,
      cooldownUntil: '2026-05-20T20:02:00.000Z',
    })
    expect(createSyncJob).not.toHaveBeenCalled()
    expect(inngest.send).not.toHaveBeenCalled()
  })

  it('returns already_syncing without dispatching when a sync job is active', async () => {
    vi.mocked(getLatestSyncJobForUser).mockResolvedValue(
      makeSyncJob({
        status: 'running',
        startedAt: new Date('2026-05-20T19:59:00.000Z'),
      }) as Awaited<ReturnType<typeof getLatestSyncJobForUser>>,
    )

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toEqual({
      status: 'already_syncing',
      jobId: 'job-1',
      kind: 'manual',
      jobStatus: 'running',
      startedAt: '2026-05-20T19:59:00.000Z',
    })
    expect(createSyncJob).not.toHaveBeenCalled()
    expect(inngest.send).not.toHaveBeenCalled()
  })

  it('fails a stale active sync job before queueing the next refresh', async () => {
    vi.mocked(getLatestSyncJobForUser)
      .mockResolvedValueOnce(
        makeSyncJob({
          status: 'running',
          startedAt: new Date('2026-05-20T19:20:00.000Z'),
          createdAt: new Date('2026-05-20T19:20:00.000Z'),
        }) as Awaited<ReturnType<typeof getLatestSyncJobForUser>>,
      )
      .mockResolvedValueOnce(null)

    const response = await POST()

    await expect(response.json()).resolves.toEqual({ status: 'queued', jobId: 'queued-job' })
    expect(response.status).toBe(200)
    expect(failStaleActiveSyncJobsForUser).toHaveBeenCalledWith('user-1')
    expect(inngest.send).toHaveBeenCalledWith({
      name: 'sync/manual.requested',
      data: { userId: 'user-1', jobId: 'queued-job' },
    })
  })

  it('marks the queued job failed if dispatch fails', async () => {
    vi.mocked(inngest.send).mockRejectedValue(new Error('Inngest unavailable'))

    const response = await POST()

    await expect(response.json()).resolves.toEqual({ status: 'dispatch_failed' })
    expect(response.status).toBe(502)
    expect(failSyncJob).toHaveBeenCalledWith('queued-job', 'Inngest unavailable')
  })
})
