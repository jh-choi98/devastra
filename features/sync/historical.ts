import 'server-only'

import type { SourceActivity, HistoricalActivityRepo } from './sources/interface'
import type { GitHubSourceClient } from './sources/github'

export const HISTORICAL_BOOTSTRAP_MAX_REPOS = 20
export const HISTORICAL_BOOTSTRAP_MAX_COMMITS_PER_REPO = 100
export const HISTORICAL_BOOTSTRAP_MAX_PAGES_PER_REPO = 3

export function dedupeActivities<T extends { source: string; externalId: string }>(
  activities: T[],
): T[] {
  const seen = new Set<string>()
  const deduped: T[] = []

  for (const activity of activities) {
    const key = `${activity.source}:${activity.externalId}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(activity)
  }

  return deduped
}

export function selectHistoricalBootstrapRepos<T extends HistoricalActivityRepo>(
  repos: T[],
  recentActivities: SourceActivity[],
): T[] {
  const reposWithRecentActivity = new Set(
    recentActivities.map((activity) => activity.repoExternalId),
  )

  return repos
    .filter((repo) => !reposWithRecentActivity.has(repo.externalRepoId))
    .filter((repo) => !hasValidatedHistoricalBootstrap(repo))
    .slice(0, HISTORICAL_BOOTSTRAP_MAX_REPOS)
}

export async function fetchHistoricalBootstrapActivities<T extends HistoricalActivityRepo>(
  github: GitHubSourceClient,
  repos: T[],
  recentActivities: SourceActivity[],
): Promise<SourceActivity[]> {
  const historicalRepos = selectHistoricalBootstrapRepos(repos, recentActivities)
  if (historicalRepos.length === 0) return []

  return github.listHistoricalAuthoredActivities({
    repos: historicalRepos,
    maxRepos: HISTORICAL_BOOTSTRAP_MAX_REPOS,
    maxCommitsPerRepo: HISTORICAL_BOOTSTRAP_MAX_COMMITS_PER_REPO,
    maxPagesPerRepo: HISTORICAL_BOOTSTRAP_MAX_PAGES_PER_REPO,
  })
}

export function hasValidatedHistoricalBootstrap(repo: HistoricalActivityRepo): boolean {
  return sameInstant(repo.sourcePushedAt, repo.historicalBootstrapSourcePushedAt)
}

function sameInstant(a: Date | string | null | undefined, b: Date | string | null | undefined) {
  const left = toDateOrNull(a)
  const right = toDateOrNull(b)
  if (!left || !right) return false
  return left.getTime() === right.getTime()
}

function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
