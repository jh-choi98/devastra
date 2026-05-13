import 'server-only'

import { getUsableAccessToken } from '@/lib/github/token'
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

export async function fetchReposViaGitHub(userId: string): Promise<OnboardingRepo[]> {
  const token = await getUsableAccessToken(userId)
  const client = new GitHubRestClient(token)

  const repos = await client.getAll<GitHubRepoWithStats>('/user/repos', {
    affiliation: 'owner,collaborator',
    sort: 'pushed',
    direction: 'desc',
  })

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const filtered = repos.filter((r) => MVP_INCLUDE_PRIVATE || !r.private)

  // Fetch 90-day commit counts in parallel (capped at first page, 100 per repo)
  const withCounts = await Promise.all(
    filtered.map(async (repo): Promise<OnboardingRepo> => {
      let ninetyDayCommitCount = 0
      try {
        const commits = await client.getAll<{ sha: string }>(
          `/repos/${repo.owner.login}/${repo.name}/commits`,
          { since: ninetyDaysAgo, per_page: '100' },
        )
        ninetyDayCommitCount = commits.length
      } catch {
        // ignore per-repo errors; show 0
      }
      return {
        externalRepoId: repo.node_id,
        owner: repo.owner.login,
        name: repo.name,
        primaryLanguage: repo.language,
        lastUpdated: repo.pushed_at,
        ninetyDayCommitCount,
      }
    }),
  )

  return withCounts.sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
  )
}
