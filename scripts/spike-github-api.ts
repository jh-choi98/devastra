#!/usr/bin/env tsx
/**
 * Verification spike: exercises the GitHub API paths used by DevAtlas.
 * Run with a real PAT to confirm rate limits, response shapes, and auth.
 *
 * IMPORTANT: Raw response bodies are never printed (ADR-9 compliance — they may
 * contain commit messages or other prose that must not be persisted or logged).
 */

const USER_AGENT = 'DevAtlas/0.1 (+https://devatlas.app)'

if (process.argv.includes('--help') || !process.env.GITHUB_TEST_TOKEN) {
  console.log('Usage: GITHUB_TEST_TOKEN=<token> npx tsx scripts/spike-github-api.ts')
  console.log('')
  console.log('Environment variables:')
  console.log('  GITHUB_TEST_TOKEN         GitHub personal access token (required)')
  console.log('  GITHUB_OAUTH_CLIENT_ID    OAuth App client ID (optional; needed for token refresh)')
  console.log('  GITHUB_OAUTH_CLIENT_SECRET OAuth App client secret (optional; needed for token refresh)')
  console.log('')
  console.log('Notes:')
  console.log('  - Response bodies are summarized only (no raw content printed — ADR-9)')
  console.log('  - If you see "Authorization: Basic" errors, set GITHUB_OAUTH_CLIENT_ID/SECRET')
  process.exit(0)
}

const TOKEN = process.env.GITHUB_TEST_TOKEN

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': USER_AGENT,
  }
}

async function restGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`https://api.github.com${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), { headers: headers() })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

async function graphqlQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`GraphQL → ${res.status} ${res.statusText}`)
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> }
  if (json.errors?.length) throw new Error(`GraphQL errors: ${json.errors.map((e) => e.message).join(', ')}`)
  if (!json.data) throw new Error('GraphQL returned no data')
  return json.data
}

async function main() {
  console.log('=== DevAtlas GitHub API Spike ===\n')

  // Step 1: GET /user
  console.log('1. GET /user')
  const user = await restGet<{ login: string; id: number }>('/user')
  console.log(`   login: ${user.login} (id: ${user.id})\n`)

  // Step 2: GraphQL contributionsCollection (12 months)
  console.log('2. GraphQL contributionsCollection (12 months)')
  const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  const to = new Date().toISOString()

  const contribData = await graphqlQuery<{
    viewer: {
      contributionsCollection: {
        commitContributionsByRepository: Array<{ repository: { name: string } }>
        pullRequestContributions: { totalCount: number }
        issueContributions: { totalCount: number }
      }
    }
  }>(
    `query($from: DateTime!, $to: DateTime!) {
       viewer {
         contributionsCollection(from: $from, to: $to) {
           commitContributionsByRepository(maxRepositories: 100) {
             repository { name }
           }
           pullRequestContributions { totalCount }
           issueContributions { totalCount }
         }
       }
     }`,
    { from, to },
  )
  const col = contribData.viewer.contributionsCollection
  console.log(`   repos with commits: ${col.commitContributionsByRepository.length}`)
  console.log(`   PRs: ${col.pullRequestContributions.totalCount}`)
  console.log(`   Issues: ${col.issueContributions.totalCount}\n`)

  // Step 3: GET /users/{login}/events/public
  console.log('3. GET /users/{login}/events/public')
  const events = await restGet<Array<{ type: string; created_at: string }>>(
    `/users/${user.login}/events/public`,
    { per_page: '1' },
  )
  if (events.length > 0) {
    console.log(`   first event type: ${events[0].type}`)
    console.log(`   first event date: ${events[0].created_at}\n`)
  } else {
    console.log('   (no public events)\n')
  }

  // Step 4: Sample commit files (use the first available repo + first commit)
  console.log('4. Sample commit file fetch')
  const firstRepo = col.commitContributionsByRepository[0]
  if (firstRepo) {
    const repoName = firstRepo.repository.name
    const commits = await restGet<Array<{ sha: string; html_url: string }>>(
      `/repos/${user.login}/${repoName}/commits`,
      { author: user.login, per_page: '1' },
    )
    if (commits.length > 0) {
      const commitDetail = await restGet<{
        sha: string
        stats?: { additions: number; deletions: number }
        files?: Array<{ filename: string }>
      }>(`/repos/${user.login}/${repoName}/commits/${commits[0].sha}`)
      console.log(`   repo: ${repoName}`)
      console.log(`   file_paths count: ${commitDetail.files?.length ?? 0}`)
      console.log(`   additions: ${commitDetail.stats?.additions ?? 0}`)
      console.log(`   deletions: ${commitDetail.stats?.deletions ?? 0}\n`)
    } else {
      console.log(`   (no commits found in ${repoName})\n`)
    }
  } else {
    console.log('   (no commit repos found)\n')
  }

  // Step 5: Rate limit
  console.log('5. Rate limit remaining')
  const rateLimit = await restGet<{
    resources: {
      core: { remaining: number; limit: number }
      graphql: { remaining: number; limit: number }
    }
  }>('/rate_limit')
  console.log(`   REST core: ${rateLimit.resources.core.remaining}/${rateLimit.resources.core.limit}`)
  console.log(`   GraphQL: ${rateLimit.resources.graphql.remaining}/${rateLimit.resources.graphql.limit}\n`)

  console.log('=== Spike complete ===')
}

main().catch((err) => {
  console.error('Spike failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
