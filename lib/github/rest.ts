import 'server-only'

import { GITHUB_USER_AGENT } from './graphql'

const GITHUB_API_BASE = 'https://api.github.com'
const DEFAULT_MAX_REST_CONCURRENCY = 4

function getGitHubApiBase(): string {
  if (process.env.NODE_ENV !== 'production' && process.env.GITHUB_REST_API_BASE_URL) {
    return process.env.GITHUB_REST_API_BASE_URL
  }
  return GITHUB_API_BASE
}

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

export class GitHubNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitHubNotFoundError'
  }
}

export class GitHubRestClient {
  private activeRequests = 0
  private queue: Array<() => void> = []

  constructor(
    private token: string,
    private maxConcurrency = DEFAULT_MAX_REST_CONCURRENCY,
  ) {}

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${getGitHubApiBase()}${path}`)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v)
      }
    }
    const response = await this.fetchWithRetry(url.toString(), {
      method: 'GET',
      headers: this.buildHeaders(),
    })
    return response.json() as Promise<T>
  }

  async getAll<T>(path: string, params?: Record<string, string>): Promise<T[]> {
    const results: T[] = []
    let page = 1

    while (true) {
      const url = new URL(`${getGitHubApiBase()}${path}`)
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          url.searchParams.set(k, v)
        }
      }
      url.searchParams.set('page', String(page))
      url.searchParams.set('per_page', '100')

      const response = await this.fetchWithRetry(url.toString(), {
        method: 'GET',
        headers: this.buildHeaders(),
      })
      const data = (await response.json()) as T[]
      results.push(...data)

      if (data.length < 100) break
      page++
    }

    return results
  }

  async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    return this.withRequestSlot(async () => {
      let response = await fetch(url, init)

      if (response.status === 401) {
        throw new GitHubAuthError('Token is invalid or expired')
      }

      if (response.status === 403) {
        const retryAfter = response.headers.get('Retry-After')
        const retryHint = retryAfter ? ` retry-after=${retryAfter}s` : ''
        throw new GitHubRateLimitError(`GitHub REST rate limited: 403${retryHint}`)
      }

      if (response.status === 404) {
        throw new GitHubNotFoundError(`GitHub REST resource not found: 404 ${url}`)
      }

      if (!response.ok) {
        throw new Error(`GitHub REST request failed: ${response.status} ${url}`)
      }

      return response
    })
  }

  buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': GITHUB_USER_AGENT,
    }
  }

  private async withRequestSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeRequests >= this.maxConcurrency) {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve)
      })
    }

    this.activeRequests += 1
    try {
      return await fn()
    } finally {
      this.activeRequests -= 1
      const next = this.queue.shift()
      if (next) next()
    }
  }
}
