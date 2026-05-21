import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearRecentPRsCacheForTest,
  fetchRecentPRs,
  RECENT_PRS_CACHE_TTL_MS,
} from '@/app/_components/ClusterDrawer/RecentPRs'

const mockPr = {
  number: 12,
  title: 'Tighten drawer request handling',
  repo: 'devastra',
  url: 'https://github.com/jh-choi98/devastra/pull/12',
  updated_at: '2026-05-20T12:00:00.000Z',
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

describe('RecentPRs request cache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21T00:00:00.000Z'))
    clearRecentPRsCacheForTest()
  })

  afterEach(() => {
    clearRecentPRsCacheForTest()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('reuses one in-flight request for the same user and cluster', async () => {
    let resolveFetch!: (response: Response) => void
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )

    const first = fetchRecentPRs('user-1', 'frontend_land')
    const second = fetchRecentPRs('user-1', 'frontend_land')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/drawer/recent-prs?cluster=frontend_land', {
      cache: 'no-store',
    })

    resolveFetch(jsonResponse({ prs: [mockPr] }))

    await expect(first).resolves.toEqual({ prs: [mockPr] })
    await expect(second).resolves.toEqual({ prs: [mockPr] })
  })

  it('keeps requests isolated by user and cluster', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(jsonResponse({ prs: [mockPr] })))

    await Promise.all([
      fetchRecentPRs('user-1', 'frontend_land'),
      fetchRecentPRs('user-2', 'frontend_land'),
      fetchRecentPRs('user-1', 'backend_fortress'),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('uses a few-minute success cache and refreshes after expiry', async () => {
    const baseTime = new Date('2026-05-21T00:00:00.000Z')
    vi.setSystemTime(baseTime)
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(jsonResponse({ prs: [mockPr] })))

    await fetchRecentPRs('user-1', 'frontend_land')
    await fetchRecentPRs('user-1', 'frontend_land')

    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date(baseTime.getTime() + RECENT_PRS_CACHE_TTL_MS + 1))
    await fetchRecentPRs('user-1', 'frontend_land')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps successful drawer reopens cached for five minutes', () => {
    expect(RECENT_PRS_CACHE_TTL_MS).toBe(5 * 60_000)
  })

  it('treats empty PR responses as successful data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ prs: [] }))

    await expect(fetchRecentPRs('user-1', 'docs_library')).resolves.toEqual({ prs: [] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not cache failed requests', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ prs: [] }, { status: 500 }))
      .mockResolvedValueOnce(jsonResponse({ prs: [mockPr] }))

    await expect(fetchRecentPRs('user-1', 'frontend_land')).rejects.toThrow('Failed')
    await expect(fetchRecentPRs('user-1', 'frontend_land')).resolves.toEqual({ prs: [mockPr] })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
