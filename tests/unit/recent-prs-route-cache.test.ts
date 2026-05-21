import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/session', () => ({
  requireUser: vi.fn(),
}))

vi.mock('@/lib/db/queries/drawer', () => ({
  getRepoHandlesForTerritory: vi.fn(),
}))

vi.mock('@/lib/github/token', () => ({
  getUsableAccessToken: vi.fn(),
}))

vi.mock('@/lib/github/graphql', () => ({
  fetchRecentPRsForUserInCluster: vi.fn(),
}))

import { GET } from '@/app/api/drawer/recent-prs/route'
import {
  clearRecentPRsRouteCacheForTest,
  RECENT_PRS_ROUTE_CACHE_TTL_MS,
} from '@/app/api/drawer/recent-prs/cache'
import { requireUser } from '@/lib/auth/session'
import { getRepoHandlesForTerritory } from '@/lib/db/queries/drawer'
import { fetchRecentPRsForUserInCluster } from '@/lib/github/graphql'
import { getUsableAccessToken } from '@/lib/github/token'

const userOne = {
  id: 'user-1',
  githubLogin: 'alice',
} as Awaited<ReturnType<typeof requireUser>>

const userTwo = {
  id: 'user-2',
  githubLogin: 'bob',
} as Awaited<ReturnType<typeof requireUser>>

const mockRepos = [{ owner: 'alice', name: 'devastra' }]

const mockPr = {
  number: 12,
  title: 'Tighten drawer request handling',
  repo: 'alice/devastra',
  url: 'https://github.com/alice/devastra/pull/12',
  updated_at: '2026-05-20T12:00:00.000Z',
}

function requestForCluster(cluster: string): Request {
  return new Request(`https://devastra.test/api/drawer/recent-prs?cluster=${cluster}`)
}

async function responseJson(response: Response): Promise<unknown> {
  return response.json()
}

describe('GET /api/drawer/recent-prs cache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21T00:00:00.000Z'))
    vi.clearAllMocks()
    clearRecentPRsRouteCacheForTest()

    vi.mocked(requireUser).mockResolvedValue(userOne)
    vi.mocked(getRepoHandlesForTerritory).mockResolvedValue(mockRepos)
    vi.mocked(getUsableAccessToken).mockResolvedValue('github-token')
    vi.mocked(fetchRecentPRsForUserInCluster).mockResolvedValue([mockPr])
  })

  afterEach(() => {
    clearRecentPRsRouteCacheForTest()
    vi.useRealTimers()
  })

  it('reuses a successful same-user same-cluster response within the TTL', async () => {
    const first = await GET(requestForCluster('frontend_land'))
    const second = await GET(requestForCluster('frontend_land'))

    await expect(responseJson(first)).resolves.toEqual({ prs: [mockPr] })
    await expect(responseJson(second)).resolves.toEqual({ prs: [mockPr] })
    expect(getRepoHandlesForTerritory).toHaveBeenCalledTimes(1)
    expect(getUsableAccessToken).toHaveBeenCalledTimes(1)
    expect(fetchRecentPRsForUserInCluster).toHaveBeenCalledTimes(1)
  })

  it('keeps cached responses isolated by user and cluster', async () => {
    vi.mocked(requireUser)
      .mockResolvedValueOnce(userOne)
      .mockResolvedValueOnce(userOne)
      .mockResolvedValueOnce(userTwo)

    await GET(requestForCluster('frontend_land'))
    await GET(requestForCluster('backend_fortress'))
    await GET(requestForCluster('frontend_land'))

    expect(getRepoHandlesForTerritory).toHaveBeenCalledTimes(3)
    expect(getRepoHandlesForTerritory).toHaveBeenNthCalledWith(1, 'user-1', 'frontend_land')
    expect(getRepoHandlesForTerritory).toHaveBeenNthCalledWith(2, 'user-1', 'backend_fortress')
    expect(getRepoHandlesForTerritory).toHaveBeenNthCalledWith(3, 'user-2', 'frontend_land')
    expect(getUsableAccessToken).toHaveBeenCalledTimes(3)
    expect(fetchRecentPRsForUserInCluster).toHaveBeenCalledTimes(3)
  })

  it('does not cache fallback responses from errors', async () => {
    vi.mocked(fetchRecentPRsForUserInCluster)
      .mockRejectedValueOnce(new Error('GitHub unavailable'))
      .mockResolvedValueOnce([mockPr])

    const first = await GET(requestForCluster('frontend_land'))
    const second = await GET(requestForCluster('frontend_land'))

    expect(first.status).toBe(200)
    await expect(responseJson(first)).resolves.toEqual({ prs: [] })
    await expect(responseJson(second)).resolves.toEqual({ prs: [mockPr] })
    expect(getRepoHandlesForTerritory).toHaveBeenCalledTimes(2)
    expect(getUsableAccessToken).toHaveBeenCalledTimes(2)
    expect(fetchRecentPRsForUserInCluster).toHaveBeenCalledTimes(2)
  })

  it('refreshes the cached response after the TTL expires', async () => {
    await GET(requestForCluster('frontend_land'))
    await GET(requestForCluster('frontend_land'))

    expect(getRepoHandlesForTerritory).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date(Date.now() + RECENT_PRS_ROUTE_CACHE_TTL_MS + 1))
    await GET(requestForCluster('frontend_land'))

    expect(getRepoHandlesForTerritory).toHaveBeenCalledTimes(2)
    expect(getUsableAccessToken).toHaveBeenCalledTimes(2)
    expect(fetchRecentPRsForUserInCluster).toHaveBeenCalledTimes(2)
  })

  it('caches empty successful responses without token or GitHub work', async () => {
    vi.mocked(getRepoHandlesForTerritory).mockResolvedValue([])

    const first = await GET(requestForCluster('docs_library'))
    const second = await GET(requestForCluster('docs_library'))

    await expect(responseJson(first)).resolves.toEqual({ prs: [] })
    await expect(responseJson(second)).resolves.toEqual({ prs: [] })
    expect(getRepoHandlesForTerritory).toHaveBeenCalledTimes(1)
    expect(getUsableAccessToken).not.toHaveBeenCalled()
    expect(fetchRecentPRsForUserInCluster).not.toHaveBeenCalled()
  })

  it('uses a five-minute server route cache TTL', () => {
    expect(RECENT_PRS_ROUTE_CACHE_TTL_MS).toBe(5 * 60_000)
  })
})
