import 'server-only'

// GitHub REST API response shapes

export interface GitHubUserRest {
  login: string
  id: number
  node_id: string
  avatar_url: string
  email: string | null
}

export interface GitHubRepoRest {
  id: number
  node_id: string
  name: string
  full_name: string
  private: boolean
  owner: { login: string; id: number }
  language: string | null
}

export interface GitHubCommitFileRest {
  filename: string
  additions: number
  deletions: number
  status: string
  sha: string
}

export interface GitHubCommitRest {
  sha: string
  html_url: string
  stats?: {
    additions: number
    deletions: number
    total: number
  }
  files?: GitHubCommitFileRest[]
}

export interface GitHubCommitListItemRest {
  sha: string
  html_url: string
  commit: {
    author: { name: string; email: string; date: string } | null
  }
}

export interface GitHubPullRequestRest {
  id: number
  node_id: string
  number: number
  title: string
  html_url: string
}

export interface GitHubRateLimitRest {
  resources: {
    core: { limit: number; used: number; remaining: number; reset: number }
    graphql: { limit: number; used: number; remaining: number; reset: number }
  }
}

export interface GitHubFileContentRest {
  type: 'file' | 'dir' | 'symlink' | 'submodule'
  encoding?: string
  content?: string
  name: string
  path: string
  sha: string
  size: number
}

// GraphQL response shapes

export interface ContributionsByRepoNode {
  repository: {
    id: string
    name: string
    owner: { login: string }
    isPrivate: boolean
    primaryLanguage: { name: string } | null
  }
  contributions: {
    nodes: Array<{
      commitCount: number
      occurredAt: string
    }>
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
  }
}

export interface PullRequestContributionNode {
  pullRequest: {
    id: string
    number: number
    url: string
    createdAt: string
    repository: {
      id: string
      name: string
      owner: { login: string }
      isPrivate: boolean
    }
  }
}

export interface IssueContributionNode {
  issue: {
    id: string
    number: number
    url: string
    createdAt: string
    repository: {
      id: string
      name: string
      owner: { login: string }
      isPrivate: boolean
    }
  }
}

export interface ContributionsCollectionData {
  viewer: {
    login: string
    contributionsCollection: {
      commitContributionsByRepository: ContributionsByRepoNode[]
      pullRequestContributions: {
        nodes: PullRequestContributionNode[]
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
        totalCount: number
      }
      issueContributions: {
        nodes: IssueContributionNode[]
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
        totalCount: number
      }
    }
  }
}
