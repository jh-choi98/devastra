import 'server-only'

export type SourceUserId = { source: 'github'; externalId: string }

export type SourceRepo = {
  source: 'github'
  externalRepoId: string
  owner: string
  name: string
  primaryLanguage: string | null
  isPrivate: boolean
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

export interface SourceClient {
  listAuthoredRepos(): Promise<SourceRepo[]>
  listAuthoredActivities(opts: {
    repoExternalIds: string[]
    since: Date // contributions window
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
