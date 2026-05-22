import 'server-only'

import { GitHubGraphQLClient, GitHubAuthError as GraphQLAuthError } from '@/lib/github/graphql'
import {
  GitHubRestClient,
  GitHubAuthError as RestAuthError,
  GitHubNotFoundError as RestNotFoundError,
  GitHubRateLimitError as RestRateLimitError,
} from '@/lib/github/rest'
import { refreshAccessToken } from '@/lib/github/token'
import type {
  ContributionsCollectionData,
  GitHubRepoRest,
  GitHubUserRest,
  GitHubCommitListItemRest,
  GitHubCommitRest,
  GitHubPullRequestRest,
  GitHubFileContentRest,
} from '@/lib/github/types'
import { mapWithConcurrency } from '@/features/sync/concurrency'
import type { SourceClient, SourceRepo, SourceActivity, HistoricalActivityRepo } from './interface'

export const MVP_INCLUDE_PRIVATE = false as const

const CONTRIBUTIONS_QUERY = `
  query ContributionsCollection($from: DateTime!, $to: DateTime!) {
    viewer {
      login
      contributionsCollection(from: $from, to: $to) {
        commitContributionsByRepository(maxRepositories: 100) {
          repository {
            id
            name
            owner { login }
            isPrivate
            primaryLanguage { name }
          }
          contributions(first: 100) {
            nodes {
              commitCount
              occurredAt
            }
            pageInfo { hasNextPage endCursor }
          }
        }
        pullRequestContributions(first: 100) {
          nodes {
            pullRequest {
              id
              number
              url
              createdAt
              repository {
                id
                name
                owner { login }
                isPrivate
              }
            }
          }
          pageInfo { hasNextPage endCursor }
          totalCount
        }
        issueContributions(first: 100) {
          nodes {
            issue {
              id
              number
              url
              createdAt
              repository {
                id
                name
                owner { login }
                isPrivate
              }
            }
          }
          pageInfo { hasNextPage endCursor }
          totalCount
        }
      }
    }
  }
`

const REPOSITORY_NODES_QUERY = `
  query RepositoryNodes($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Repository {
        id
        name
        owner { login }
        isPrivate
        primaryLanguage { name }
        pushedAt
      }
    }
  }
`

const GITHUB_REPO_FETCH_CONCURRENCY = 4
const REPOSITORY_NODE_BATCH_SIZE = 50

type RepositoryNodesData = {
  nodes: Array<{
    id?: string
    name?: string
    owner?: { login: string }
    isPrivate?: boolean
    primaryLanguage?: { name: string } | null
    pushedAt?: string | null
  } | null>
}

function isUnresolvableNodeError(err: unknown): boolean {
  return (
    err instanceof Error &&
    /Could not resolve to (?:a node|.* with the global id)/i.test(err.message)
  )
}

type AuthoredActivitiesResult = {
  activities: SourceActivity[]
  commitFetchedRepoExternalIds: string[]
}

export class GitHubSourceClient implements SourceClient {
  private graphql: GitHubGraphQLClient
  private rest: GitHubRestClient
  private authenticatedLogin: string | null = null

  constructor(
    private accessToken: string,
    private userId: string,
  ) {
    this.graphql = new GitHubGraphQLClient(accessToken)
    this.rest = new GitHubRestClient(accessToken)
  }

  async listAuthoredRepos(): Promise<SourceRepo[]> {
    const repos = await this.withAuthRetry(() =>
      this.rest.getAll<GitHubRepoRest>('/user/repos', {
        affiliation: 'owner,collaborator',
        sort: 'pushed',
        direction: 'desc',
      }),
    )

    return repos
      .filter((r) => MVP_INCLUDE_PRIVATE || !r.private)
      .map((r) => ({
        source: 'github' as const,
        externalRepoId: r.node_id,
        owner: r.owner.login,
        name: r.name,
        primaryLanguage: r.language,
        isPrivate: r.private,
        pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
      }))
  }

  async fetchReposByExternalIds(externalRepoIds: string[]): Promise<SourceRepo[]> {
    if (externalRepoIds.length === 0) return []

    const repos: SourceRepo[] = []
    for (const ids of chunkArray(externalRepoIds, REPOSITORY_NODE_BATCH_SIZE)) {
      const data = await this.fetchRepositoryNodesByIds(ids)

      for (const node of data.nodes) {
        if (!node?.id || !node.name || !node.owner) continue
        if (!MVP_INCLUDE_PRIVATE && node.isPrivate) continue

        repos.push({
          source: 'github',
          externalRepoId: node.id,
          owner: node.owner.login,
          name: node.name,
          primaryLanguage: node.primaryLanguage?.name ?? null,
          isPrivate: Boolean(node.isPrivate),
          pushedAt: node.pushedAt ? new Date(node.pushedAt) : null,
        })
      }
    }

    const byId = new Map(repos.map((repo) => [repo.externalRepoId, repo]))
    return externalRepoIds.flatMap((id) => {
      const repo = byId.get(id)
      return repo ? [repo] : []
    })
  }

  private async fetchRepositoryNodesByIds(ids: string[]): Promise<RepositoryNodesData> {
    try {
      return await this.withAuthRetry(() =>
        this.graphql.query<RepositoryNodesData>(REPOSITORY_NODES_QUERY, { ids }),
      )
    } catch (err) {
      if (!isUnresolvableNodeError(err)) throw err
      if (ids.length === 1) return { nodes: [null] }

      const nodes: RepositoryNodesData['nodes'] = []
      for (const id of ids) {
        try {
          const data = await this.withAuthRetry(() =>
            this.graphql.query<RepositoryNodesData>(REPOSITORY_NODES_QUERY, { ids: [id] }),
          )
          nodes.push(data.nodes[0] ?? null)
        } catch (innerErr) {
          if (!isUnresolvableNodeError(innerErr)) throw innerErr
          nodes.push(null)
        }
      }
      return { nodes }
    }
  }

  async listAuthoredActivities(opts: {
    repoExternalIds: string[]
    since: Date
  }): Promise<SourceActivity[]> {
    const result = await this.listAuthoredActivitiesWithFetchMetadata(opts)
    return result.activities
  }

  async listAuthoredActivitiesWithFetchMetadata(opts: {
    repoExternalIds: string[]
    since: Date
    commitRepoExternalIds?: string[]
  }): Promise<AuthoredActivitiesResult> {
    const to = new Date()
    const data = await this.withAuthRetry(() =>
      this.graphql.query<ContributionsCollectionData>(CONTRIBUTIONS_QUERY, {
        from: opts.since.toISOString(),
        to: to.toISOString(),
      }),
    )

    const repoIdSet = new Set(opts.repoExternalIds)
    const commitRepoIdSet = new Set(opts.commitRepoExternalIds ?? opts.repoExternalIds)
    const activities: SourceActivity[] = []
    const login = data.viewer.login
    this.authenticatedLogin = login

    // PRs
    for (const node of data.viewer.contributionsCollection.pullRequestContributions.nodes) {
      if (!node) continue
      const pr = node.pullRequest
      if (!pr) continue
      if (!repoIdSet.has(pr.repository.id)) continue
      if (!MVP_INCLUDE_PRIVATE && pr.repository.isPrivate) continue
      activities.push({
        source: 'github',
        externalId: pr.id,
        type: 'pr',
        repoExternalId: pr.repository.id,
        occurredAt: new Date(pr.createdAt),
        filePaths: [],
        additions: 0,
        deletions: 0,
        githubUrl: pr.url,
      })
    }

    // Issues
    for (const node of data.viewer.contributionsCollection.issueContributions.nodes) {
      if (!node) continue
      const issue = node.issue
      if (!issue) continue
      if (!repoIdSet.has(issue.repository.id)) continue
      if (!MVP_INCLUDE_PRIVATE && issue.repository.isPrivate) continue
      activities.push({
        source: 'github',
        externalId: issue.id,
        type: 'issue',
        repoExternalId: issue.repository.id,
        occurredAt: new Date(issue.createdAt),
        filePaths: [],
        additions: 0,
        deletions: 0,
        githubUrl: issue.url,
      })
    }

    // Commits: GraphQL tells us which repos have commits; REST gives us the individual SHAs
    const commitRepos = data.viewer.contributionsCollection.commitContributionsByRepository
      .filter((r) => repoIdSet.has(r.repository.id))
      .filter((r) => commitRepoIdSet.has(r.repository.id))
      .filter((r) => MVP_INCLUDE_PRIVATE || !r.repository.isPrivate)

    const commitActivityGroups = await mapWithConcurrency(
      commitRepos,
      GITHUB_REPO_FETCH_CONCURRENCY,
      async (repoEntry) => {
        const { id: repoNodeId, name, owner } = repoEntry.repository
        const commits = await this.withAuthRetry(() =>
          this.rest.getAll<GitHubCommitListItemRest>(`/repos/${owner.login}/${name}/commits`, {
            author: login,
            since: opts.since.toISOString(),
          }),
        )

        const repoActivities: SourceActivity[] = []
        for (const commit of commits) {
          if (!commit.commit.author?.date) continue
          repoActivities.push({
            source: 'github',
            externalId: commit.sha,
            type: 'commit',
            repoExternalId: repoNodeId,
            occurredAt: new Date(commit.commit.author.date),
            filePaths: [],
            additions: 0,
            deletions: 0,
            githubUrl: commit.html_url,
          })
        }
        return { repoExternalId: repoNodeId, activities: repoActivities }
      },
    )

    for (const group of commitActivityGroups) {
      activities.push(...group.activities)
    }

    return {
      activities,
      commitFetchedRepoExternalIds: commitActivityGroups.map((group) => group.repoExternalId),
    }
  }

  async listHistoricalAuthoredActivities(opts: {
    repos: HistoricalActivityRepo[]
    maxRepos: number
    maxCommitsPerRepo: number
    maxPagesPerRepo: number
  }): Promise<SourceActivity[]> {
    const login = await this.getAuthenticatedLogin()
    const activities: SourceActivity[] = []

    const historicalGroups = await mapWithConcurrency(
      opts.repos.slice(0, opts.maxRepos),
      GITHUB_REPO_FETCH_CONCURRENCY,
      async (repo) => {
        let collectedForRepo = 0
        const repoActivities: SourceActivity[] = []

        for (let page = 1; page <= opts.maxPagesPerRepo; page += 1) {
          if (collectedForRepo >= opts.maxCommitsPerRepo) break

          let commits: GitHubCommitListItemRest[]
          try {
            commits = await this.withAuthRetry(() =>
              this.rest.get<GitHubCommitListItemRest[]>(
                `/repos/${repo.owner}/${repo.name}/commits`,
                {
                  author: login,
                  page: String(page),
                  per_page: '100',
                },
              ),
            )
          } catch (err) {
            if (
              err instanceof RestRateLimitError ||
              (err instanceof Error && err.name === 'GitHubRateLimitError')
            ) {
              throw err
            }
            if (
              err instanceof RestNotFoundError ||
              (err instanceof Error &&
                (err.name === 'GitHubNotFoundError' ||
                  err.message.includes('GitHub REST request failed: 409')))
            ) {
              break
            }
            throw err
          }

          if (commits.length === 0) break

          for (const commit of commits) {
            if (collectedForRepo >= opts.maxCommitsPerRepo) break
            if (!commit.commit.author?.date) continue

            repoActivities.push({
              source: 'github',
              externalId: commit.sha,
              type: 'commit',
              repoExternalId: repo.externalRepoId,
              occurredAt: new Date(commit.commit.author.date),
              filePaths: [],
              additions: 0,
              deletions: 0,
              githubUrl: commit.html_url,
            })
            collectedForRepo += 1
          }

          if (commits.length < 100) break
        }
        return repoActivities
      },
    )

    for (const group of historicalGroups) {
      activities.push(...group)
    }

    return activities
  }

  async fetchCommitFiles(
    repoOwner: string,
    repoName: string,
    sha: string,
  ): Promise<{ file_paths: string[]; additions: number; deletions: number; github_url: string }> {
    const commit = await this.withAuthRetry(() =>
      this.rest.get<GitHubCommitRest>(`/repos/${repoOwner}/${repoName}/commits/${sha}`),
    )
    return {
      file_paths: (commit.files ?? []).map((f) => f.filename),
      additions: commit.stats?.additions ?? 0,
      deletions: commit.stats?.deletions ?? 0,
      github_url: commit.html_url,
    }
  }

  async fetchPullRequestTitles(
    handles: { owner: string; repo: string; number: number }[],
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {}
    await Promise.all(
      handles.map(async ({ owner, repo, number }) => {
        const pr = await this.withAuthRetry(() =>
          this.rest.get<GitHubPullRequestRest>(`/repos/${owner}/${repo}/pulls/${number}`),
        )
        result[`${owner}/${repo}#${number}`] = pr.title
      }),
    )
    return result
  }

  async fetchFileContent(owner: string, repo: string, path: string): Promise<string | null> {
    try {
      const response = await this.withAuthRetry(() =>
        this.rest.get<GitHubFileContentRest>(`/repos/${owner}/${repo}/contents/${path}`),
      )
      if (response.type !== 'file' || !response.content) return null
      return Buffer.from(response.content.replace(/\n/g, ''), 'base64').toString('utf-8')
    } catch (err) {
      if (
        err instanceof RestNotFoundError ||
        (err instanceof Error && err.name === 'GitHubNotFoundError')
      ) {
        return null
      }
      throw err
    }
  }

  async getLatestEventId(login: string): Promise<string | null> {
    try {
      const events = await this.withAuthRetry(() =>
        this.rest.get<Array<{ id: string }>>(`/users/${login}/events`, {
          per_page: '1',
          page: '1',
        }),
      )
      return Array.isArray(events) && events.length > 0 ? events[0].id : null
    } catch {
      return null
    }
  }

  async refreshTokenIfNeeded(): Promise<void> {
    this.accessToken = await refreshAccessToken(this.userId)
    this.graphql = new GitHubGraphQLClient(this.accessToken)
    this.rest = new GitHubRestClient(this.accessToken)
    this.authenticatedLogin = null
  }

  private async getAuthenticatedLogin(): Promise<string> {
    if (this.authenticatedLogin) return this.authenticatedLogin
    const user = await this.withAuthRetry(() => this.rest.get<GitHubUserRest>('/user'))
    this.authenticatedLogin = user.login
    return user.login
  }

  private async withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      if (
        err instanceof Error &&
        (err instanceof GraphQLAuthError ||
          err instanceof RestAuthError ||
          err.name === 'GitHubAuthError')
      ) {
        await this.refreshTokenIfNeeded()
        return fn()
      }
      throw err
    }
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}
