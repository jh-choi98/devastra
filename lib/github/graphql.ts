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

    if (response.status === 403) {
      const retryAfter = response.headers.get('Retry-After')
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000
      await sleep(waitMs)
      const retried = await fetch(GITHUB_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'User-Agent': GITHUB_USER_AGENT,
        },
        body: JSON.stringify({ query, variables }),
      })
      if (retried.status === 401) throw new GitHubAuthError('Token is invalid or expired')
      if (!retried.ok) throw new GitHubRateLimitError(`GraphQL rate limit: ${retried.status}`)
      const retryJson = (await retried.json()) as {
        data?: T
        errors?: Array<{ message: string }>
      }
      if (retryJson.errors?.length) {
        throw new Error(`GitHub GraphQL errors: ${retryJson.errors.map((e) => e.message).join(', ')}`)
      }
      if (!retryJson.data) throw new Error('GitHub GraphQL returned no data')
      return retryJson.data
    }

    if (!response.ok) {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
