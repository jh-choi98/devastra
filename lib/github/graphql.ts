import 'server-only'

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql'
export const GITHUB_USER_AGENT = 'DevAstra/0.1 (+https://devastra.app)'

export class GitHubAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitHubAuthError'
  }
}

export class GitHubRateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitHubRateLimitError'
  }
}

export class GitHubGraphQLClient {
  constructor(private token: string) {}

  async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(GITHUB_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'User-Agent': GITHUB_USER_AGENT,
      },
      body: JSON.stringify({ query, variables }),
    })

    if (response.status === 401) {
      throw new GitHubAuthError('Token is invalid or expired')
    }

    if (!response.ok) {
      if (response.status === 403) {
        const retryAfter = response.headers.get('Retry-After')
        const retryHint = retryAfter ? ` retry-after=${retryAfter}s` : ''
        throw new GitHubRateLimitError(`GitHub GraphQL rate limited: 403${retryHint}`)
      }
      throw new Error(`GitHub GraphQL request failed: ${response.status}`)
    }

    const json = (await response.json()) as { data?: T; errors?: Array<{ message: string }> }
    if (json.errors?.length) {
      throw new Error(`GitHub GraphQL errors: ${json.errors.map((e) => e.message).join(', ')}`)
    }
    if (!json.data) throw new Error('GitHub GraphQL returned no data')
    return json.data
  }
}

export type RecentPR = {
  number: number
  title: string
  repo: string
  url: string
  updated_at: string
}

/**
 * Fetches the most recent PRs authored by githubLogin in the given repos.
 * Repos are pre-filtered by the caller (active repos for the cluster).
 * PR titles are NOT stored per ADR-9; fetched on demand here.
 */
export async function fetchRecentPRsForUserInCluster(params: {
  token: string
  githubLogin: string
  repos: Array<{ owner: string; name: string }>
  limit: number
}): Promise<RecentPR[]> {
  const { token, githubLogin, repos, limit } = params
  if (repos.length === 0) return []

  // Build "repo:owner/name" clauses (cap at 15 to stay well under query length limits)
  const repoClauses = repos
    .slice(0, 15)
    .map((r) => `repo:${r.owner}/${r.name}`)
    .join(' ')

  const searchQuery = `is:pr author:${githubLogin} ${repoClauses} sort:updated-desc`

  const gql = `
    query($q: String!, $limit: Int!) {
      search(query: $q, type: ISSUE, first: $limit) {
        nodes {
          ... on PullRequest {
            number
            title
            url
            updatedAt
            repository {
              name
              owner { login }
            }
          }
        }
      }
    }
  `

  type SearchResult = {
    search: {
      nodes: Array<{
        number?: number
        title?: string
        url?: string
        updatedAt?: string
        repository?: { name: string; owner: { login: string } }
      }>
    }
  }

  const client = new GitHubGraphQLClient(token)
  const data = await client.query<SearchResult>(gql, { q: searchQuery, limit })

  return data.search.nodes
    .filter((n) => n.number !== undefined && n.title !== undefined)
    .map((n) => ({
      number: n.number!,
      title: n.title!,
      repo: `${n.repository?.owner.login}/${n.repository?.name}`,
      url: n.url!,
      updated_at: n.updatedAt!,
    }))
}
