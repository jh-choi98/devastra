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
    headers: {
      get: (h: string) => (h === 'Retry-After' ? (retryAfter ?? null) : null),
    } as unknown as Headers,
    json: () => Promise.resolve({ message: 'error' }),
  } as unknown as Response
}

function makeCommitListItem(sha: string, date: string) {
  return {
    sha,
    html_url: `https://github.com/user/repo/commit/${sha}`,
    commit: {
      author: { name: 'User', email: 'user@example.com', date },
    },
  }
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
    vi.unstubAllEnvs()
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
      okJson([makeRepoResponse({ private: true }), makeRepoResponse({ private: true })]),
    )

    const client = new GitHubSourceClient('test-token', 'user-id')
    const repos = await client.listAuthoredRepos()
    expect(repos).toHaveLength(0)
  })

  it('uses the dev/test REST API base URL override outside production', async () => {
    vi.stubEnv('GITHUB_REST_API_BASE_URL', 'http://127.0.0.1:4010')
    mockFetch.mockResolvedValueOnce(okJson([]))

    const client = new GitHubSourceClient('test-token', 'user-id')
    await client.listAuthoredRepos()

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('http://127.0.0.1:4010/user/repos')
  })

  it('ignores the REST API base URL override in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('GITHUB_REST_API_BASE_URL', 'http://127.0.0.1:4010')
    mockFetch.mockResolvedValueOnce(okJson([]))

    const client = new GitHubSourceClient('test-token', 'user-id')
    await client.listAuthoredRepos()

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('https://api.github.com/user/repos')
  })
})

describe('GitHubSourceClient.fetchReposByExternalIds', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('fetches only requested repositories by GitHub node id', async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        data: {
          nodes: [
            {
              id: 'R_two',
              name: 'two',
              owner: { login: 'user' },
              isPrivate: false,
              primaryLanguage: { name: 'Go' },
              pushedAt: '2026-05-17T00:00:00Z',
            },
            {
              id: 'R_one',
              name: 'one',
              owner: { login: 'user' },
              isPrivate: false,
              primaryLanguage: { name: 'TypeScript' },
              pushedAt: '2026-05-16T00:00:00Z',
            },
          ],
        },
      }),
    )

    const client = new GitHubSourceClient('test-token', 'user-id')
    const repos = await client.fetchReposByExternalIds(['R_one', 'R_two'])

    expect(repos.map((repo) => repo.externalRepoId)).toEqual(['R_one', 'R_two'])
    expect(repos[0].primaryLanguage).toBe('TypeScript')
    expect(repos[0].pushedAt?.toISOString()).toBe('2026-05-16T00:00:00.000Z')

    const [url, init] = mockFetch.mock.calls[0] as [
      string,
      RequestInit & { body: string; headers: Record<string, string> },
    ]
    expect(url).toBe('https://api.github.com/graphql')
    expect(JSON.parse(init.body).variables.ids).toEqual(['R_one', 'R_two'])
  })

  it('filters private repositories from direct node lookup', async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        data: {
          nodes: [
            {
              id: 'R_private',
              name: 'secret',
              owner: { login: 'user' },
              isPrivate: true,
              primaryLanguage: null,
              pushedAt: '2026-05-17T00:00:00Z',
            },
          ],
        },
      }),
    )

    const client = new GitHubSourceClient('test-token', 'user-id')
    await expect(client.fetchReposByExternalIds(['R_private'])).resolves.toEqual([])
  })

  it('skips stale repository node ids without failing the whole lookup', async () => {
    mockFetch
      .mockResolvedValueOnce(
        okJson({
          data: { nodes: [null] },
          errors: [
            {
              message: "Could not resolve to a node with the global id of 'R_stale'",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          data: {
            nodes: [
              {
                id: 'R_one',
                name: 'one',
                owner: { login: 'user' },
                isPrivate: false,
                primaryLanguage: { name: 'TypeScript' },
                pushedAt: '2026-05-16T00:00:00Z',
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          data: { nodes: [null] },
          errors: [
            {
              message: "Could not resolve to a node with the global id of 'R_stale'",
            },
          ],
        }),
      )

    const client = new GitHubSourceClient('test-token', 'user-id')
    const repos = await client.fetchReposByExternalIds(['R_one', 'R_stale'])

    expect(repos.map((repo) => repo.externalRepoId)).toEqual(['R_one'])
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('uses the dev/test GraphQL URL override outside production', async () => {
    vi.stubEnv('GITHUB_GRAPHQL_API_URL', 'http://127.0.0.1:4010/graphql')
    mockFetch.mockResolvedValueOnce(
      okJson({
        data: {
          nodes: [],
        },
      }),
    )

    const client = new GitHubSourceClient('test-token', 'user-id')
    await client.fetchReposByExternalIds(['R_one'])

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:4010/graphql')
  })

  it('ignores the GraphQL URL override in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('GITHUB_GRAPHQL_API_URL', 'http://127.0.0.1:4010/graphql')
    mockFetch.mockResolvedValueOnce(
      okJson({
        data: {
          nodes: [],
        },
      }),
    )

    const client = new GitHubSourceClient('test-token', 'user-id')
    await client.fetchReposByExternalIds(['R_one'])

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.github.com/graphql')
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

    const [, init] = mockFetch.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ]
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(GITHUB_USER_AGENT)
  })

  it('includes Authorization header with Bearer token', async () => {
    mockFetch.mockResolvedValueOnce(okJson([]))

    const client = new GitHubSourceClient('my-secret-token', 'user-id')
    await client.listAuthoredRepos()

    const [, init] = mockFetch.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ]
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-secret-token')
  })
})

// ---------------------------------------------------------------------------
// 403 secondary rate-limit handling
// ---------------------------------------------------------------------------
describe('rate limit on 403', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('throws immediately after 403 with Retry-After header', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403, '2'))

    const client = new GitHubSourceClient('test-token', 'user-id')
    await expect(client.listAuthoredRepos()).rejects.toThrow(/rate limited/)

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('throws immediately after 403 with no Retry-After', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403))

    const client = new GitHubSourceClient('test-token', 'user-id')
    await expect(client.listAuthoredRepos()).rejects.toThrow(/rate limited/)

    expect(mockFetch).toHaveBeenCalledTimes(1)
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
      .mockResolvedValueOnce(errorResponse(401)) // first call: 401
      .mockResolvedValueOnce(okJson([])) // second call: success

    const client = new GitHubSourceClient('old-token', 'user-id')
    const repos = await client.listAuthoredRepos()

    expect(refreshAccessToken).toHaveBeenCalledWith('user-id')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(repos).toEqual([])
  })

  it('second call uses the refreshed token', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401)).mockResolvedValueOnce(okJson([]))

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
    mockFetch.mockResolvedValueOnce(errorResponse(401)).mockResolvedValueOnce(errorResponse(401))

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

// ---------------------------------------------------------------------------
// fetchFileContent — missing file vs real API failure
// ---------------------------------------------------------------------------
describe('GitHubSourceClient.fetchFileContent', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('returns null when the manifest file is not present', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404))

    const client = new GitHubSourceClient('test-token', 'user-id')
    await expect(client.fetchFileContent('owner', 'repo', 'package.json')).resolves.toBeNull()
  })

  it('throws rate-limit errors instead of treating manifests as absent', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403, '2'))

    const client = new GitHubSourceClient('test-token', 'user-id')
    await expect(client.fetchFileContent('owner', 'repo', 'package.json')).rejects.toThrow(
      /rate limited/,
    )
  })
})

// ---------------------------------------------------------------------------
// listAuthoredActivities — nullable contribution nodes
// ---------------------------------------------------------------------------
describe('GitHubSourceClient.listAuthoredActivities', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('skips null PR and issue contribution targets', async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        data: {
          viewer: {
            login: 'user',
            contributionsCollection: {
              commitContributionsByRepository: [],
              pullRequestContributions: {
                nodes: [
                  null,
                  { pullRequest: null },
                  {
                    pullRequest: {
                      id: 'PR_1',
                      number: 1,
                      url: 'https://github.com/user/repo/pull/1',
                      createdAt: '2026-01-01T00:00:00Z',
                      repository: {
                        id: 'R_public',
                        name: 'repo',
                        owner: { login: 'user' },
                        isPrivate: false,
                      },
                    },
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
                totalCount: 2,
              },
              issueContributions: {
                nodes: [
                  null,
                  { issue: null },
                  {
                    issue: {
                      id: 'I_1',
                      number: 2,
                      url: 'https://github.com/user/repo/issues/2',
                      createdAt: '2026-01-02T00:00:00Z',
                      repository: {
                        id: 'R_public',
                        name: 'repo',
                        owner: { login: 'user' },
                        isPrivate: false,
                      },
                    },
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
                totalCount: 2,
              },
            },
          },
        },
      }),
    )

    const client = new GitHubSourceClient('test-token', 'user-id')
    const activities = await client.listAuthoredActivities({
      repoExternalIds: ['R_public'],
      since: new Date('2025-01-01T00:00:00Z'),
    })

    expect(activities.map((activity) => activity.externalId)).toEqual(['PR_1', 'I_1'])
  })

  it('fetches commit lists only for repos selected by commit cache invalidation', async () => {
    mockFetch
      .mockResolvedValueOnce(
        okJson({
          data: {
            viewer: {
              login: 'user',
              contributionsCollection: {
                commitContributionsByRepository: [
                  {
                    repository: {
                      id: 'R_changed',
                      name: 'changed',
                      owner: { login: 'user' },
                      isPrivate: false,
                      primaryLanguage: { name: 'TypeScript' },
                    },
                    contributions: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
                  },
                  {
                    repository: {
                      id: 'R_cached',
                      name: 'cached',
                      owner: { login: 'user' },
                      isPrivate: false,
                      primaryLanguage: { name: 'Go' },
                    },
                    contributions: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
                  },
                ],
                pullRequestContributions: {
                  nodes: [],
                  pageInfo: { hasNextPage: false, endCursor: null },
                  totalCount: 0,
                },
                issueContributions: {
                  nodes: [],
                  pageInfo: { hasNextPage: false, endCursor: null },
                  totalCount: 0,
                },
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(okJson([makeCommitListItem('sha-changed', '2026-01-01T00:00:00Z')]))

    const client = new GitHubSourceClient('test-token', 'user-id')
    const result = await client.listAuthoredActivitiesWithFetchMetadata({
      repoExternalIds: ['R_changed', 'R_cached'],
      commitRepoExternalIds: ['R_changed'],
      since: new Date('2025-01-01T00:00:00Z'),
    })

    expect(result.activities.map((activity) => activity.externalId)).toEqual(['sha-changed'])
    expect(result.commitFetchedRepoExternalIds).toEqual(['R_changed'])
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(String(mockFetch.mock.calls[1][0])).toContain('/repos/user/changed/commits')
  })
})

// ---------------------------------------------------------------------------
// listHistoricalAuthoredActivities — bounded old-repo bootstrap
// ---------------------------------------------------------------------------
describe('GitHubSourceClient.listHistoricalAuthoredActivities', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('fetches authored commits without a since cutoff for selected repos', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson({ login: 'user' }))
      .mockResolvedValueOnce(
        okJson([
          makeCommitListItem('old-1', '2020-01-01T00:00:00Z'),
          makeCommitListItem('old-2', '2019-01-01T00:00:00Z'),
        ]),
      )

    const client = new GitHubSourceClient('test-token', 'user-id')
    const activities = await client.listHistoricalAuthoredActivities({
      repos: [{ externalRepoId: 'R_old', owner: 'user', name: 'repo' }],
      maxRepos: 1,
      maxCommitsPerRepo: 10,
      maxPagesPerRepo: 1,
    })

    expect(activities.map((activity) => activity.externalId)).toEqual(['old-1', 'old-2'])
    expect(activities.every((activity) => activity.repoExternalId === 'R_old')).toBe(true)

    const [commitUrl] = mockFetch.mock.calls[1] as [string, RequestInit]
    expect(commitUrl).toContain('/repos/user/repo/commits')
    expect(commitUrl).toContain('author=user')
    expect(commitUrl).not.toContain('since=')
  })

  it('honors repo and commit caps', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson({ login: 'user' }))
      .mockResolvedValueOnce(
        okJson([
          makeCommitListItem('old-1', '2020-01-01T00:00:00Z'),
          makeCommitListItem('old-2', '2019-01-01T00:00:00Z'),
        ]),
      )

    const client = new GitHubSourceClient('test-token', 'user-id')
    const activities = await client.listHistoricalAuthoredActivities({
      repos: [
        { externalRepoId: 'R_old_1', owner: 'user', name: 'repo-one' },
        { externalRepoId: 'R_old_2', owner: 'user', name: 'repo-two' },
      ],
      maxRepos: 1,
      maxCommitsPerRepo: 1,
      maxPagesPerRepo: 3,
    })

    expect(activities.map((activity) => activity.externalId)).toEqual(['old-1'])
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
