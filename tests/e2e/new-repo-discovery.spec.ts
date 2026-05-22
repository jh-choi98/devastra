import { expect, test, type Page } from '@playwright/test'
import { loadEnvConfig } from '@next/env'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import postgres from 'postgres'

loadEnvConfig(process.cwd())

const TEST_GITHUB_LOGIN = 'test-e2e-user'
const MOCK_GITHUB_PORT = Number(process.env.E2E_MOCK_GITHUB_PORT ?? 4010)
const MOCK_GITHUB_ORIGIN = `http://127.0.0.1:${MOCK_GITHUB_PORT}`
const MOCK_GRAPHQL_URL = `${MOCK_GITHUB_ORIGIN}/graphql`
const RUN_ID = `new-repo-${Date.now()}`
const canUseDatabase = Boolean(process.env.DATABASE_URL)
const canUseMockGitHub =
  process.env.GITHUB_REST_API_BASE_URL === MOCK_GITHUB_ORIGIN &&
  process.env.GITHUB_GRAPHQL_API_URL === MOCK_GRAPHQL_URL

test.skip(!canUseDatabase, 'DATABASE_URL is required for new repo discovery E2E tests.')
test.skip(
  !canUseMockGitHub,
  `Set GITHUB_REST_API_BASE_URL=${MOCK_GITHUB_ORIGIN} and GITHUB_GRAPHQL_API_URL=${MOCK_GRAPHQL_URL}.`,
)
test.describe.configure({ mode: 'serial' })

const sql = postgres(process.env.DATABASE_URL ?? '', {
  max: 1,
  prepare: false,
})

type MockRepo = {
  node_id: string
  name: string
  full_name: string
  private: boolean
  owner: { login: string; id: number }
  language: string | null
  pushed_at: string | null
}

const existingRepo = makeRepo('R_existing_e2e', 'existing-repo', false, 'TypeScript')
const newRepo = makeRepo('R_new_e2e', 'new-repo', false, 'TypeScript')
const privateRepo = makeRepo('R_private_e2e', 'private-repo', true, 'TypeScript')

const mockGitHub = {
  repos: [existingRepo] as MockRepo[],
  counts: new Map<string, number>(),
}

let mockServer: ReturnType<typeof createServer> | null = null

test.beforeAll(async () => {
  await startMockGitHub()
})

test.afterAll(async () => {
  await sql`
    delete from users
    where github_login = ${TEST_GITHUB_LOGIN}
  `
  await sql.end({ timeout: 5 })

  if (mockServer) {
    await new Promise<void>((resolve, reject) => {
      mockServer?.close((err) => (err ? reject(err) : resolve()))
    })
  }
})

test('new public GitHub repos appear in Settings after post-onboarding sync', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const runtime = trackRuntime(page)

  await signInWithMockOAuth(page)
  const user = await getTestUser()
  await seedPostOnboardingUser(user.id)

  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByText('0 of 1 repos included')).toBeVisible()
  await page.getByRole('button', { name: 'Edit' }).click()
  await expect(repoRow(page, 'test-owner/existing-repo')).toBeVisible()
  await expect(repoRow(page, 'test-owner/new-repo')).toHaveCount(0)
  await expect(repoRow(page, 'test-owner/existing-repo').locator('input')).not.toBeChecked()

  mockGitHub.counts.clear()
  mockGitHub.repos = [existingRepo, newRepo, privateRepo]

  const syncStartedAt = Date.now()
  const syncResponse = await page.request.post('/api/test/run-manual-sync')
  const syncDurationMs = Date.now() - syncStartedAt
  expect(syncResponse.status()).toBe(200)
  await expect(syncResponse.json()).resolves.toMatchObject({ status: 'completed' })
  expect(syncDurationMs).toBeLessThan(15_000)

  await expect.poll(() => getRepoDiscoveryState(user.id)).toEqual({
    totalRepos: 2,
    includedRepos: 1,
    existingIncluded: false,
    newIncluded: true,
    privateRepoSaved: false,
    newRepoActivities: 1,
    newRepoAttributions: 1,
    completedManualJobs: 1,
  })

  expect(mockGitHub.counts.get('GET /user/repos')).toBe(1)
  expect(mockGitHub.counts.get('POST /graphql')).toBe(1)
  expect(mockGitHub.counts.get('GET /repos/test-owner/new-repo/commits')).toBe(1)
  expect(mockGitHub.counts.get('GET /repos/test-owner/new-repo/commits/sha-new-repo-1')).toBe(1)
  expect(mockGitHub.counts.get('GET /users/test-e2e-user/events')).toBe(1)

  await page.goto('/settings')
  await expect(page.getByText('1 of 2 repos included')).toBeVisible()
  await page.getByRole('button', { name: 'Edit' }).click()
  await expect(repoRow(page, 'test-owner/existing-repo')).toBeVisible()
  await expect(repoRow(page, 'test-owner/new-repo')).toBeVisible()
  await expect(repoRow(page, 'test-owner/existing-repo').locator('input')).not.toBeChecked()
  await expect(repoRow(page, 'test-owner/new-repo').locator('input')).toBeChecked()

  await page.goto('/')
  await expect(page.getByRole('status')).toContainText(/Your constellation has \d+ stars lit/, {
    timeout: 20_000,
  })

  expect(runtime.serverErrors).toEqual([])
  expect(runtime.pageErrors).toEqual([])
})

function makeRepo(
  externalRepoId: string,
  name: string,
  isPrivate: boolean,
  language: string | null,
): MockRepo {
  return {
    node_id: externalRepoId,
    name,
    full_name: `test-owner/${name}`,
    private: isPrivate,
    owner: { login: 'test-owner', id: 100 },
    language,
    pushed_at: '2026-05-21T12:00:00.000Z',
  }
}

async function startMockGitHub() {
  mockServer = createServer((request, response) => {
    void handleMockGitHubRequest(request, response)
  })

  await new Promise<void>((resolve, reject) => {
    mockServer?.once('error', reject)
    mockServer?.listen(MOCK_GITHUB_PORT, '127.0.0.1', () => resolve())
  })
}

async function handleMockGitHubRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', MOCK_GITHUB_ORIGIN)
  const method = request.method ?? 'GET'
  const key = `${method} ${url.pathname}`
  mockGitHub.counts.set(key, (mockGitHub.counts.get(key) ?? 0) + 1)

  if (method === 'GET' && url.pathname === '/user/repos') {
    return writeJson(response, mockGitHub.repos)
  }

  if (method === 'POST' && url.pathname === '/graphql') {
    const body = JSON.parse(await readBody(request)) as {
      query?: string
      variables?: Record<string, unknown>
    }

    if (body.query?.includes('RepositoryNodes')) {
      const ids = Array.isArray(body.variables?.ids) ? body.variables.ids : []
      return writeJson(response, {
        data: {
          nodes: ids.map((id) => {
            const repo = mockGitHub.repos.find((candidate) => candidate.node_id === id)
            if (!repo) return null
            return {
              id: repo.node_id,
              name: repo.name,
              owner: { login: repo.owner.login },
              isPrivate: repo.private,
              primaryLanguage: repo.language ? { name: repo.language } : null,
              pushedAt: repo.pushed_at,
            }
          }),
        },
      })
    }

    if (body.query?.includes('ContributionsCollection')) {
      return writeJson(response, {
        data: {
          viewer: {
            login: TEST_GITHUB_LOGIN,
            contributionsCollection: {
              commitContributionsByRepository: [
                {
                  repository: {
                    id: newRepo.node_id,
                    name: newRepo.name,
                    owner: { login: newRepo.owner.login },
                    isPrivate: false,
                    primaryLanguage: { name: 'TypeScript' },
                  },
                  contributions: {
                    nodes: [{ commitCount: 1, occurredAt: '2026-05-21T12:00:00.000Z' }],
                    pageInfo: { hasNextPage: false, endCursor: null },
                  },
                },
              ],
              pullRequestContributions: {
                nodes: [],
                pageInfo: { hasNextPage: false, endCursor: null },
                totalCount: 0,
              },
              issueContributions: {
                nodes: [],
                pageInfo: { hasNextPage: false, endCursor: null },
                totalCount: 0,
              },
            },
          },
        },
      })
    }

    return writeJson(response, { data: { viewer: { contributionsCollection: {} } } })
  }

  if (method === 'GET' && url.pathname === '/repos/test-owner/new-repo/commits') {
    return writeJson(response, [
      {
        sha: 'sha-new-repo-1',
        html_url: 'https://github.com/test-owner/new-repo/commit/sha-new-repo-1',
        commit: {
          author: {
            name: TEST_GITHUB_LOGIN,
            email: 'test-e2e-user@test.devastra.local',
            date: '2026-05-21T12:00:00.000Z',
          },
        },
      },
    ])
  }

  if (method === 'GET' && url.pathname === '/repos/test-owner/new-repo/commits/sha-new-repo-1') {
    return writeJson(response, {
      sha: 'sha-new-repo-1',
      html_url: 'https://github.com/test-owner/new-repo/commit/sha-new-repo-1',
      stats: { additions: 12, deletions: 2, total: 14 },
      files: [{ filename: 'server/api.ts', additions: 12, deletions: 2, status: 'modified' }],
    })
  }

  if (method === 'GET' && url.pathname === '/users/test-e2e-user/events') {
    return writeJson(response, [{ id: 'event-after-new-repo' }])
  }

  return writeJson(response, { message: `No mock for ${key}` }, 404)
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf-8')
}

function writeJson(response: ServerResponse, body: unknown, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

function repoRow(page: Page, name: string) {
  return page.locator('li').filter({ hasText: name })
}

async function signInWithMockOAuth(page: Page): Promise<void> {
  const response = await page.request.get('/api/test/mock-oauth', { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  await expect.poll(async () => (await getTestUser()).id).not.toBe('')
}

async function getTestUser(): Promise<{ id: string }> {
  const rows = await sql`
    select id
    from users
    where github_login = ${TEST_GITHUB_LOGIN}
    limit 1
  `
  expect(rows).toHaveLength(1)
  return rows[0] as { id: string }
}

async function seedPostOnboardingUser(userId: string): Promise<void> {
  const encryptedToken = await encryptTokenForTest(`${RUN_ID}-github-token`)

  await sql`
    update users
    set
      github_access_token_enc = ${encryptedToken},
      github_refresh_token_enc = null,
      github_token_expires_at = null,
      last_event_id = ${`${RUN_ID}-onboarded`},
      last_incremental_sync_at = null,
      last_login_at = now()
    where id = ${userId}
  `

  await sql`
    insert into repositories (
      user_id,
      source,
      external_repo_id,
      owner,
      name,
      primary_language,
      source_pushed_at,
      is_included
    )
    values (
      ${userId},
      'github',
      ${existingRepo.node_id},
      'test-owner',
      'existing-repo',
      'TypeScript',
      ${existingRepo.pushed_at},
      false
    )
    on conflict (user_id, source, external_repo_id)
    do update set
      owner = excluded.owner,
      name = excluded.name,
      primary_language = excluded.primary_language,
      source_pushed_at = excluded.source_pushed_at,
      is_included = false
  `
}

async function encryptTokenForTest(token: string): Promise<Buffer> {
  const rows = await sql`
    select pgp_sym_encrypt(${token}, decrypted_secret)::bytea as encrypted
    from vault.decrypted_secrets
    where name = 'devastra_token_encryption_key'
    limit 1
  `
  expect(rows).toHaveLength(1)
  return (rows[0] as { encrypted: Buffer }).encrypted
}

async function getRepoDiscoveryState(userId: string): Promise<{
  totalRepos: number
  includedRepos: number
  existingIncluded: boolean
  newIncluded: boolean
  privateRepoSaved: boolean
  newRepoActivities: number
  newRepoAttributions: number
  completedManualJobs: number
}> {
  const rows = await sql`
    select
      (select count(*)::int from repositories where user_id = ${userId}) as total_repos,
      (
        select count(*)::int
        from repositories
        where user_id = ${userId}
          and is_included = true
      ) as included_repos,
      (
        select is_included
        from repositories
        where user_id = ${userId}
          and external_repo_id = ${existingRepo.node_id}
        limit 1
      ) as existing_included,
      (
        select is_included
        from repositories
        where user_id = ${userId}
          and external_repo_id = ${newRepo.node_id}
        limit 1
      ) as new_included,
      exists (
        select 1
        from repositories
        where user_id = ${userId}
          and external_repo_id = ${privateRepo.node_id}
      ) as private_repo_saved,
      (
        select count(*)::int
        from activities a
        join repositories r on r.id = a.repo_id
        where a.user_id = ${userId}
          and r.external_repo_id = ${newRepo.node_id}
      ) as new_repo_activities,
      (
        select count(*)::int
        from activity_territories at
        join activities a on a.id = at.activity_id
        join repositories r on r.id = a.repo_id
        where a.user_id = ${userId}
          and r.external_repo_id = ${newRepo.node_id}
      ) as new_repo_attributions,
      (
        select count(*)::int
        from sync_jobs
        where user_id = ${userId}
          and kind = 'manual'
          and status = 'completed'
      ) as completed_manual_jobs
  `
  expect(rows).toHaveLength(1)
  const row = rows[0] as {
    total_repos: number
    included_repos: number
    existing_included: boolean
    new_included: boolean
    private_repo_saved: boolean
    new_repo_activities: number
    new_repo_attributions: number
    completed_manual_jobs: number
  }

  return {
    totalRepos: row.total_repos,
    includedRepos: row.included_repos,
    existingIncluded: row.existing_included,
    newIncluded: row.new_included,
    privateRepoSaved: row.private_repo_saved,
    newRepoActivities: row.new_repo_activities,
    newRepoAttributions: row.new_repo_attributions,
    completedManualJobs: row.completed_manual_jobs,
  }
}

function trackRuntime(page: Page): { pageErrors: string[]; serverErrors: string[] } {
  const pageErrors: string[] = []
  const serverErrors: string[] = []

  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`)
    }
  })

  return { pageErrors, serverErrors }
}
