import 'server-only'

import { GitHubGraphQLClient, GitHubAuthError as GraphQLAuthError } from '@/lib/github/graphql'
import { GitHubRestClient, GitHubAuthError as RestAuthError } from '@/lib/github/rest'
import { refreshAccessToken } from '@/lib/github/token'
import type {
  ContributionsCollectionData,
  GitHubRepoRest,
  GitHubCommitListItemRest,
  GitHubCommitRest,
  GitHubPullRequestRest,
  GitHubFileContentRest,
} from '@/lib/github/types'
import type { SourceClient, SourceRepo, SourceActivity } from './interface'

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

export class GitHubSourceClient implements SourceClient {
  private graphql: GitHubGraphQLClient
  private rest: GitHubRestClient

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
      }))
  }

  async listAuthoredActivities(opts: {
    repoExternalIds: string[]
    since: Date
  }): Promise<SourceActivity[]> {
    const to = new Date()
    const data = await this.withAuthRetry(() =>
      this.graphql.query<ContributionsCollectionData>(CONTRIBUTIONS_QUERY, {
        from: opts.since.toISOString(),
        to: to.toISOString(),
      }),
    )

    const repoIdSet = new Set(opts.repoExternalIds)
    const activities: SourceActivity[] = []
    const login = data.viewer.login

    // PRs
    for (const node of data.viewer.contributionsCollection.pullRequestContributions.nodes) {
      const pr = node.pullRequest
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
      const issue = node.issue
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
      .filter((r) => MVP_INCLUDE_PRIVATE || !r.repository.isPrivate)

    for (const repoEntry of commitRepos) {
      const { id: repoNodeId, name, owner } = repoEntry.repository
      const commits = await this.withAuthRetry(() =>
        this.rest.getAll<GitHubCommitListItemRest>(`/repos/${owner.login}/${name}/commits`, {
          author: login,
          since: opts.since.toISOString(),
        }),
      )

      for (const commit of commits) {
        if (!commit.commit.author?.date) continue
        activities.push({
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
    } catch {
      return null
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
  }

  private async withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      if (
        err instanceof Error &&
        (err instanceof GraphQLAuthError || err instanceof RestAuthError || err.name === 'GitHubAuthError')
      ) {
        await this.refreshTokenIfNeeded()
        return fn()
      }
      throw err
    }
  }
}
