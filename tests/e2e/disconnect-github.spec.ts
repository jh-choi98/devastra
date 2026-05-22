import { expect, test, type Page } from '@playwright/test'
import { loadEnvConfig } from '@next/env'
import postgres from 'postgres'

loadEnvConfig(process.cwd())

const TEST_GITHUB_LOGIN = 'test-e2e-user'
const RUN_ID = `disconnect-${Date.now()}`
const canUseDatabase = Boolean(process.env.DATABASE_URL)

test.skip(!canUseDatabase, 'DATABASE_URL is required for disconnect GitHub E2E tests.')
test.describe.configure({ mode: 'serial' })

const sql = postgres(process.env.DATABASE_URL ?? '', {
  max: 1,
  prepare: false,
})

test.afterAll(async () => {
  await sql`
    delete from users
    where github_login = ${TEST_GITHUB_LOGIN}
  `
  await sql.end({ timeout: 5 })
})

test('Disconnect GitHub clears tokens, makes the profile private, and preserves constellation data', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const runtime = trackRuntime(page)

  await signInWithMockOAuth(page)
  const user = await getTestUser()
  const beforeCounts = await seedConnectedUserWithConstellationData(user.id)

  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /danger zone/i })).toBeVisible()

  await page.getByRole('button', { name: 'Disconnect GitHub' }).click()
  await expect(page.getByRole('heading', { name: 'Disconnect GitHub?' })).toBeVisible()
  await expect(
    page.getByText('Your constellation stays. Public profile becomes private. Reconnect anytime.'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('heading', { name: 'Disconnect GitHub?' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Disconnect GitHub' }).click()
  await expect(page.getByRole('heading', { name: 'Disconnect GitHub?' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { name: 'Disconnect GitHub?' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Disconnect GitHub' }).click()
  await expect(page.getByRole('heading', { name: 'Disconnect GitHub?' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Disconnect GitHub?' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Disconnect GitHub' }).click()
  await expect(page.getByRole('heading', { name: 'Disconnect GitHub?' })).toBeVisible()
  await page.mouse.click(10, 10)
  await expect(page.getByRole('heading', { name: 'Disconnect GitHub?' })).toBeVisible()

  await page.getByRole('button', { name: 'Disconnect', exact: true }).click()

  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 })
  const disconnectedBanner = page.getByTestId('github-disconnected-banner')
  await expect(disconnectedBanner).toBeVisible()
  await expect(
    page.getByText('GitHub disconnected — reconnect to sync new activity'),
  ).toBeVisible()
  const reconnectLink = page.getByRole('link', { name: 'Reconnect' })
  await expect(reconnectLink).toBeVisible()
  await expect(reconnectLink).toHaveAttribute('href', '/api/auth/sign-in')

  const bannerBox = await disconnectedBanner.boundingBox()
  const viewport = page.viewportSize()
  expect(bannerBox).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect((bannerBox?.y ?? 0) + (bannerBox?.height ?? 0)).toBeGreaterThan(
    (viewport?.height ?? 0) - 2,
  )
  expect(bannerBox?.y ?? 0).toBeGreaterThan((viewport?.height ?? 0) - 120)

  await expect.poll(() => getDisconnectState(user.id)).toEqual({
    accessCleared: true,
    refreshCleared: true,
    expiryCleared: true,
    isPublic: false,
  })

  await expect.poll(() => getConstellationDataCounts(user.id)).toEqual(beforeCounts)

  const reconnectResponse = await page.request.get('/api/auth/sign-in', { maxRedirects: 0 })
  expect(reconnectResponse.status()).toBe(307)
  expect(reconnectResponse.headers()['location']).toBe('http://localhost:3001/api/test/mock-oauth')

  const refreshResponse = await page.request.post('/api/refresh')
  expect(refreshResponse.status()).toBe(409)
  await expect(refreshResponse.json()).resolves.toEqual({ status: 'github_disconnected' })

  await reconnectLink.click()
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 })
  await expect(page.getByTestId('github-disconnected-banner')).toHaveCount(0)
  await expect.poll(() => getDisconnectState(user.id)).toEqual({
    accessCleared: false,
    refreshCleared: false,
    expiryCleared: true,
    isPublic: false,
  })

  expect(runtime.serverErrors).toEqual([])
  expect(runtime.pageErrors).toEqual([])
})

async function signInWithMockOAuth(page: Page): Promise<void> {
  const response = await page.request.get('/api/test/mock-oauth', { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  await expect.poll(async () => (await getTestUser()).id).not.toBe('')
}

async function getTestUser(): Promise<{ id: string; display_username: string }> {
  const rows = await sql`
    select id, display_username
    from users
    where github_login = ${TEST_GITHUB_LOGIN}
    limit 1
  `
  expect(rows).toHaveLength(1)
  return rows[0] as { id: string; display_username: string }
}

async function seedConnectedUserWithConstellationData(userId: string): Promise<DataCounts> {
  await sql`
    update users
    set
      github_access_token_enc = ${Buffer.from(`${RUN_ID}-access-token`)},
      github_refresh_token_enc = ${Buffer.from(`${RUN_ID}-refresh-token`)},
      github_token_expires_at = now() + interval '1 day',
      is_public = true,
      last_event_id = ${`${RUN_ID}-last-event`},
      last_login_at = now()
    where id = ${userId}
  `

  const repoRows = await sql`
    insert into repositories (
      user_id,
      source,
      external_repo_id,
      owner,
      name,
      primary_language,
      is_included
    )
    values (
      ${userId},
      'github',
      ${`${RUN_ID}-repo`},
      'test-owner',
      'disconnect-fixture',
      'TypeScript',
      true
    )
    on conflict (user_id, source, external_repo_id)
    do update set is_included = excluded.is_included
    returning id
  `
  const repoId = repoRows[0].id as string

  const activityRows = await sql`
    insert into activities (
      user_id,
      repo_id,
      source,
      external_id,
      type,
      occurred_at,
      raw
    )
    values (
      ${userId},
      ${repoId},
      'github',
      ${`${RUN_ID}-activity`},
      'commit',
      now(),
      ${sql.json({
        file_paths: ['app/example.tsx'],
        additions: 7,
        deletions: 1,
        github_url: 'https://github.com/test-owner/disconnect-fixture/commit/e2e',
      })}
    )
    on conflict (user_id, source, external_id)
    do update set raw = excluded.raw
    returning id
  `
  const activityId = activityRows[0].id as string

  await sql`
    insert into activity_territories (activity_id, territory_type, weight, tech_keys)
    values (${activityId}, 'frontend_land', 5, array['typescript'])
    on conflict (activity_id, territory_type)
    do update set weight = excluded.weight, tech_keys = excluded.tech_keys
  `

  await sql`
    insert into territories (
      user_id,
      type,
      total_weight,
      stage,
      stage_changed_at,
      last_grown_at,
      growth_30d
    )
    values (${userId}, 'frontend_land', 50, 2, now(), now(), 5)
    on conflict (user_id, type)
    do update set
      total_weight = excluded.total_weight,
      stage = excluded.stage,
      stage_changed_at = excluded.stage_changed_at,
      last_grown_at = excluded.last_grown_at,
      growth_30d = excluded.growth_30d
  `

  await sql`
    insert into landmarks (
      user_id,
      tech_key,
      territory_type,
      weight,
      first_unlocked_at,
      last_grown_at
    )
    values (${userId}, 'typescript', 'frontend_land', 5, now(), now())
    on conflict (user_id, tech_key)
    do update set
      territory_type = excluded.territory_type,
      weight = excluded.weight,
      first_unlocked_at = excluded.first_unlocked_at,
      last_grown_at = excluded.last_grown_at
  `

  await sql`
    insert into weekly_recaps (user_id, week_start, highlights)
    values (
      ${userId},
      date_trunc('week', now())::date,
      ${sql.json({
        kind: 'active',
        slot_1: { kind: 'brightest_cluster', cluster_type: 'frontend_land', growth_pct: 10 },
        slot_2: { kind: 'new_stars', tech_keys: ['typescript'] },
        slot_3: { kind: 'activity', active_days: 1, commits: 1, prs_shipped: 0 },
      })}
    )
    on conflict (user_id, week_start)
    do update set highlights = excluded.highlights
  `

  return getConstellationDataCounts(userId)
}

type DataCounts = {
  repositories: number
  activities: number
  activityTerritories: number
  territories: number
  landmarks: number
  weeklyRecaps: number
}

async function getConstellationDataCounts(userId: string): Promise<DataCounts> {
  const rows = await sql`
    select
      (select count(*)::int from repositories where user_id = ${userId}) as repositories,
      (select count(*)::int from activities where user_id = ${userId}) as activities,
      (
        select count(*)::int
        from activity_territories at
        join activities a on a.id = at.activity_id
        where a.user_id = ${userId}
      ) as "activityTerritories",
      (select count(*)::int from territories where user_id = ${userId}) as territories,
      (select count(*)::int from landmarks where user_id = ${userId}) as landmarks,
      (select count(*)::int from weekly_recaps where user_id = ${userId}) as "weeklyRecaps"
  `

  const row = rows[0] as Record<keyof DataCounts, number>
  return {
    repositories: row.repositories,
    activities: row.activities,
    activityTerritories: row.activityTerritories,
    territories: row.territories,
    landmarks: row.landmarks,
    weeklyRecaps: row.weeklyRecaps,
  }
}

async function getDisconnectState(userId: string): Promise<{
  accessCleared: boolean
  refreshCleared: boolean
  expiryCleared: boolean
  isPublic: boolean
}> {
  const rows = await sql`
    select
      github_access_token_enc is null as access_cleared,
      github_refresh_token_enc is null as refresh_cleared,
      github_token_expires_at is null as expiry_cleared,
      is_public
    from users
    where id = ${userId}
    limit 1
  `
  expect(rows).toHaveLength(1)
  const row = rows[0] as {
    access_cleared: boolean
    refresh_cleared: boolean
    expiry_cleared: boolean
    is_public: boolean
  }

  return {
    accessCleared: row.access_cleared,
    refreshCleared: row.refresh_cleared,
    expiryCleared: row.expiry_cleared,
    isPublic: row.is_public,
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
