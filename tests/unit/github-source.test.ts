import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock modules that touch DB or server-only infrastructure
vi.mock('@/lib/db/client', () => ({ db: {} }))
vi.mock('@/lib/db/encryption', () => ({
  encryptToken: vi.fn(),
  decryptToken: vi.fn(),
}))
vi.mock('@/lib/github/token', () => ({
  refreshAccessToken: vi.fn().mockResolvedValue('refreshed-token'),
  getUsableAccessToken: vi.fn().mockResolvedValue('test-token'),
}))

import { GitHubSourceClient, MVP_INCLUDE_PRIVATE } from '@/features/sync/sources/github'
import { refreshAccessToken } from '@/lib/github/token'
import { GITHUB_USER_AGENT } from '@/lib/github/graphql'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function makeRepoResponse(overrides: { private?: boolean; node_id?: string; name?: string } = {}) {
  return {
    id: 1,
    node_id: overrides.node_id ?? 'R_public',
    name: overrides.name ?? 'my-repo',
    full_name: 'user/my-repo',
    private: overrides.private ?? false,
    owner: { login: 'user', id: 100 },
    language: 'TypeScript',
  }
}

function okJson(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null } as unknown as Headers,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

function errorResponse(status: number, retryAfter?: string): Response {
  return {
    ok: false,
    status,
    headers: { get: (h: string) => (h === 'Retry-After' ? (retryAfter ?? null) : null) } as unknown as Headers,
    json: () => Promise.resolve({ message: 'error' }),
  } as unknown as Response
}

// ---------------------------------------------------------------------------
// MVP_INCLUDE_PRIVATE constant
// ---------------------------------------------------------------------------
describe('MVP_INCLUDE_PRIVATE', () => {
  it('is false', () => {
    expect(MVP_INCLUDE_PRIVATE).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// listAuthoredRepos — private repo filtering
// ---------------------------------------------------------------------------
describe('GitHubSourceClient.listAuthoredRepos', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('filters out private repos when MVP_INCLUDE_PRIVATE is false', async () => {
    mockFetch.mockResolvedValueOnce(
      okJson([
        makeRepoResponse({ private: false, node_id: 'R_pub', name: 'public-repo' }),
        makeRepoResponse({ private: true, node_id: 'R_priv', name: 'private-repo' }),
      ]),
    )

    const client = new GitHubSourceClient('test-token', 'user-id')
    const repos = await client.listAuthoredRepos()

    expect(repos).toHaveLength(1)
    expect(repos[0].name).toBe('public-repo')
    expect(repos[0].isPrivate).toBe(false)
  })

  it('maps REST response to SourceRepo shape', async () => {
    mockFetch.mockResolvedValueOnce(
      okJson([makeRepoResponse({ node_id: 'R_abc', name: 'cool-project' })]),
    )

    const client = new GitHubSourceClient('test-token', 'user-id')
    const repos = await client.listAuthoredRepos()

    expect(repos[0]).toMatchObject({
      source: 'github',
      externalRepoId: 'R_abc',
      owner: 'user',
      name: 'cool-project',
      primaryLanguage: 'TypeScript',
      isPrivate: false,
    })
  })

  it('returns empty array when all repos are private', async () => {
    mockFetch.mockResolvedValueOnce(
      okJson([
        makeRepoResponse({ private: true }),
        makeRepoResponse({ private: true }),
      ]),
    )

    const client = new GitHubSourceClient('test-token', 'user-id')
    const repos = await client.listAuthoredRepos()
    expect(repos).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// User-Agent header
// ---------------------------------------------------------------------------
describe('User-Agent header', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('sends the correct User-Agent on REST requests', async () => {
    mockFetch.mockResolvedValueOnce(okJson([]))

    const client = new GitHubSourceClient('my-token', 'user-id')
    await client.listAuthoredRepos()

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }]
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(GITHUB_USER_AGENT)
  })

  it('includes Authorization header with Bearer token', async () => {
    mockFetch.mockResolvedValueOnce(okJson([]))

    const client = new GitHubSourceClient('my-secret-token', 'user-id')
    await client.listAuthoredRepos()

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }]
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-secret-token')
  })
})

// ---------------------------------------------------------------------------
// 403 secondary rate-limit retry
// ---------------------------------------------------------------------------
describe('retry on 403', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('retries once after 403 with Retry-After header', async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(403, '2')) // 2-second retry-after
      .mockResolvedValueOnce(okJson([]))

    const client = new GitHubSourceClient('test-token', 'user-id')
    const promise = client.listAuthoredRepos()
    await vi.runAllTimersAsync()
    const result = await promise

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result).toEqual([])
  })

  it('retries once after 403 with no Retry-After (defaults to 60s)', async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(403)) // no Retry-After
      .mockResolvedValueOnce(okJson([]))

    const client = new GitHubSourceClient('test-token', 'user-id')
    const promise = client.listAuthoredRepos()
    await vi.runAllTimersAsync()
    const result = await promise

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result).toEqual([])
  })

  it('throws if still failing after retry', async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(403))
      .mockResolvedValueOnce(errorResponse(403))

    const client = new GitHubSourceClient('test-token', 'user-id')
    // Attach catch immediately to avoid unhandled rejection warning
    const catchPromise = client.listAuthoredRepos().catch((e: unknown) => e)
    await vi.runAllTimersAsync()
    const err = await catchPromise
    expect(err).toBeInstanceOf(Error)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// 401 token refresh path
// ---------------------------------------------------------------------------
describe('401 refresh path', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    vi.mocked(refreshAccessToken).mockResolvedValue('refreshed-token')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('calls refreshTokenIfNeeded on 401 and retries', async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(401))  // first call: 401
      .mockResolvedValueOnce(okJson([]))           // second call: success

    const client = new GitHubSourceClient('old-token', 'user-id')
    const repos = await client.listAuthoredRepos()

    expect(refreshAccessToken).toHaveBeenCalledWith('user-id')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(repos).toEqual([])
  })

  it('second call uses the refreshed token', async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(401))
      .mockResolvedValueOnce(okJson([]))

    const client = new GitHubSourceClient('old-token', 'user-id')
    await client.listAuthoredRepos()

    const [, secondInit] = mockFetch.mock.calls[1] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ]
    expect((secondInit.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer refreshed-token',
    )
  })

  it('throws if still failing after token refresh', async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(401))
      .mockResolvedValueOnce(errorResponse(401))

    const client = new GitHubSourceClient('old-token', 'user-id')
    await expect(client.listAuthoredRepos()).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// fetchCommitFiles
// ---------------------------------------------------------------------------
describe('GitHubSourceClient.fetchCommitFiles', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('returns file_paths, additions, deletions, github_url', async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        sha: 'deadbeef',
        html_url: 'https://github.com/owner/repo/commit/deadbeef',
        stats: { additions: 10, deletions: 3, total: 13 },
        files: [
          { filename: 'src/a.ts', additions: 5, deletions: 1, status: 'modified', sha: 'f1' },
          { filename: 'src/b.ts', additions: 5, deletions: 2, status: 'modified', sha: 'f2' },
        ],
      }),
    )

    const client = new GitHubSourceClient('test-token', 'user-id')
    const result = await client.fetchCommitFiles('owner', 'repo', 'deadbeef')

    expect(result.file_paths).toEqual(['src/a.ts', 'src/b.ts'])
    expect(result.additions).toBe(10)
    expect(result.deletions).toBe(3)
    expect(result.github_url).toBe('https://github.com/owner/repo/commit/deadbeef')
  })

  it('returns empty file_paths and 0 stats when no files/stats in response', async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({ sha: 'abc', html_url: 'https://github.com/o/r/commit/abc' }),
    )

    const client = new GitHubSourceClient('test-token', 'user-id')
    const result = await client.fetchCommitFiles('o', 'r', 'abc')

    expect(result.file_paths).toEqual([])
    expect(result.additions).toBe(0)
    expect(result.deletions).toBe(0)
  })
})
