import 'server-only'

import { getUsableAccessToken } from '@/lib/github/token'
import { GitHubGraphQLClient } from '@/lib/github/graphql'
import { GitHubRestClient } from '@/lib/github/rest'
import { MVP_INCLUDE_PRIVATE } from '@/features/sync/sources/github'

export interface OnboardingRepo {
  externalRepoId: string
  owner: string
  name: string
  primaryLanguage: string | null
  lastUpdated: string
  ninetyDayCommitCount: number
}

interface GitHubRepoWithStats {
  node_id: string
  name: string
  private: boolean
  owner: { login: string }
  language: string | null
  pushed_at: string
}

const ONBOARDING_COMMIT_COUNTS_QUERY = `
  query OnboardingCommitCounts($from: DateTime!, $to: DateTime!) {
    viewer {
      contributionsCollection(from: $from, to: $to) {
        commitContributionsByRepository(maxRepositories: 100) {
          repository { id }
          contributions(first: 100) {
            nodes { commitCount }
          }
        }
      }
    }
  }
`

type OnboardingCommitCountsData = {
  viewer: {
    contributionsCollection: {
      commitContributionsByRepository: Array<{
        repository: { id: string }
        contributions: { nodes: Array<{ commitCount: number }> }
      }>
    }
  }
}

export async function fetchReposViaGitHub(userId: string): Promise<OnboardingRepo[]> {
  const token = await getUsableAccessToken(userId)
  const client = new GitHubRestClient(token)
  const graphql = new GitHubGraphQLClient(token)

  const repos = await client.getAll<GitHubRepoWithStats>('/user/repos', {
    affiliation: 'owner,collaborator',
    sort: 'pushed',
    direction: 'desc',
  })

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const commitCounts = await fetchNinetyDayCommitCounts(graphql, ninetyDaysAgo)

  const filtered = repos.filter((r) => MVP_INCLUDE_PRIVATE || !r.private)

  const withCounts = filtered.map((repo): OnboardingRepo => ({
    externalRepoId: repo.node_id,
    owner: repo.owner.login,
    name: repo.name,
    primaryLanguage: repo.language,
    lastUpdated: repo.pushed_at,
    ninetyDayCommitCount: commitCounts.get(repo.node_id) ?? 0,
  }))

  return withCounts.sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
  )
}

async function fetchNinetyDayCommitCounts(
  graphql: GitHubGraphQLClient,
  sinceIso: string,
): Promise<Map<string, number>> {
  try {
    const data = await graphql.query<OnboardingCommitCountsData>(ONBOARDING_COMMIT_COUNTS_QUERY, {
      from: sinceIso,
      to: new Date().toISOString(),
    })
    const counts = new Map<string, number>()
    for (const repo of data.viewer.contributionsCollection.commitContributionsByRepository) {
      counts.set(
        repo.repository.id,
        repo.contributions.nodes.reduce((sum, node) => sum + node.commitCount, 0),
      )
    }
    return counts
  } catch {
    return new Map()
  }
}
