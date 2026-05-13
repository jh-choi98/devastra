import 'server-only'

import { GITHUB_USER_AGENT } from './graphql'

const GITHUB_API_BASE = 'https://api.github.com'

export class GitHubAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitHubAuthError'
  }
}

export class GitHubRestClient {
  constructor(private token: string) {}

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${GITHUB_API_BASE}${path}`)
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
      const url = new URL(`${GITHUB_API_BASE}${path}`)
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
    let response = await fetch(url, init)

    if (response.status === 403) {
      const retryAfter = response.headers.get('Retry-After')
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000
      await sleep(waitMs)
      response = await fetch(url, init)
    }

    if (response.status === 401) {
      throw new GitHubAuthError('Token is invalid or expired')
    }

    if (!response.ok) {
      throw new Error(`GitHub REST request failed: ${response.status} ${url}`)
    }

    return response
  }

  buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': GITHUB_USER_AGENT,
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
