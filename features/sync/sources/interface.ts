import 'server-only'

export type SourceUserId = { source: 'github'; externalId: string }

export type SourceRepo = {
  source: 'github'
  externalRepoId: string
  owner: string
  name: string
  primaryLanguage: string | null
  isPrivate: boolean
  pushedAt?: Date | null
}

export type SourceActivity = {
  source: 'github'
  externalId: string
  type: 'commit' | 'pr' | 'issue'
  repoExternalId: string
  occurredAt: Date
  filePaths: string[] // empty array if not yet fetched (sampled separately)
  additions: number
  deletions: number
  githubUrl: string
}

export type HistoricalActivityRepo = {
  externalRepoId: string
  owner: string
  name: string
  sourcePushedAt?: Date | string | null
  historicalBootstrapSourcePushedAt?: Date | string | null
}

export interface SourceClient {
  listAuthoredRepos(): Promise<SourceRepo[]>
  listAuthoredActivities(opts: {
    repoExternalIds: string[]
    since: Date // contributions window
  }): Promise<SourceActivity[]>
  listHistoricalAuthoredActivities(opts: {
    repos: HistoricalActivityRepo[]
    maxRepos: number
    maxCommitsPerRepo: number
    maxPagesPerRepo: number
  }): Promise<SourceActivity[]>
  fetchCommitFiles(
    repoOwner: string,
    repoName: string,
    sha: string,
  ): Promise<{ file_paths: string[]; additions: number; deletions: number; github_url: string }>
  fetchPullRequestTitles(
    handles: { owner: string; repo: string; number: number }[],
  ): Promise<Record<string, string>>
  refreshTokenIfNeeded(): Promise<void>
}
