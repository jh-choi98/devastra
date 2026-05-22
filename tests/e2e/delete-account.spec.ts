import { expect, test, type Page } from '@playwright/test'
import { loadEnvConfig } from '@next/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import postgres from 'postgres'

loadEnvConfig(process.cwd())

const TEST_GITHUB_LOGIN = 'test-e2e-user'
const RUN_ID = `delete-${Date.now()}`
const canUseDatabase = Boolean(process.env.DATABASE_URL)
const canUseSupabaseAdmin = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

test.skip(!canUseDatabase, 'DATABASE_URL is required for delete account E2E tests.')
test.skip(!canUseSupabaseAdmin, 'Supabase admin credentials are required for delete account E2E tests.')
test.describe.configure({ mode: 'serial' })

const sql = postgres(process.env.DATABASE_URL ?? '', {
  max: 1,
  prepare: false,
})

let deletedUserId: string | null = null
let adminClient: SupabaseClient | null = null

test.beforeAll(() => {
  adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
})

test.afterAll(async () => {
  await sql`
    delete from users
    where github_login = ${TEST_GITHUB_LOGIN}
  `
  if (deletedUserId && adminClient) {
    await adminClient.auth.admin.deleteUser(deletedUserId)
  }
  await sql.end({ timeout: 5 })
})

test('Delete account requires exact username and removes the test account plus associated data', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const runtime = trackRuntime(page)

  await signInWithMockOAuth(page)
  const user = await getTestUser()
  deletedUserId = user.id
  await seedUserData(user.id, user.display_username)

  await expect.poll(() => getCascadeCounts(user.id)).toEqual({
    users: 1,
    repositories: 1,
    activities: 1,
    activityTerritories: 1,
    territories: 1,
    landmarks: 1,
    weeklyRecaps: 1,
    emailSends: 1,
    usernameHistory: 1,
    misclassificationFeedback: 1,
    syncJobs: 1,
  })

  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete account' }).click()

  await expect(page.getByRole('heading', { name: 'Delete your account' })).toBeVisible()
  await expect(page.getByText('This cannot be undone. We will delete:')).toBeVisible()
  await expect(page.getByText('Your constellation', { exact: true })).toBeVisible()
  await expect(page.getByText('All weekly recaps', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Your public profile', { exact: true })).toBeVisible()
  await expect(page.getByText('All account data', { exact: true })).toBeVisible()

  const permanentlyDeleteButton = page.getByRole('button', { name: 'Permanently delete' })
  await expect(permanentlyDeleteButton).toBeDisabled()

  const usernameInput = page.getByRole('textbox', { name: user.display_username })
  await usernameInput.fill(`${user.display_username}-wrong`)
  await expect(permanentlyDeleteButton).toBeDisabled()
  await usernameInput.fill(user.display_username)
  await expect(permanentlyDeleteButton).toBeEnabled()

  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { name: 'Delete your account' })).toHaveCount(0)
  await expect.poll(() => getCascadeCounts(user.id)).toMatchObject({ users: 1 })

  await page.getByRole('button', { name: 'Delete account' }).click()
  await expect(page.getByRole('heading', { name: 'Delete your account' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Permanently delete' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Delete your account' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Delete account' }).click()
  await expect(page.getByRole('heading', { name: 'Delete your account' })).toBeVisible()
  await page.mouse.click(10, 10)
  await expect(page.getByRole('heading', { name: 'Delete your account' })).toBeVisible()

  await page.getByRole('textbox', { name: user.display_username }).fill(user.display_username)
  await page.getByRole('button', { name: 'Permanently delete' }).click()

  await expect(page).toHaveURL(/\/account-deleted$/, { timeout: 20_000 })
  await expect(page.getByRole('heading', { name: /Thanks for trying DevAstra/ })).toBeVisible()
  await expect.poll(() => getCascadeCounts(user.id)).toEqual({
    users: 0,
    repositories: 0,
    activities: 0,
    activityTerritories: 0,
    territories: 0,
    landmarks: 0,
    weeklyRecaps: 0,
    emailSends: 0,
    usernameHistory: 0,
    misclassificationFeedback: 0,
    syncJobs: 0,
  })
  await expect.poll(() => authUserExists(user.id)).toBe(false)

  await page.goto('/settings')
  await expect(page).toHaveURL(/\/$/)

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

async function seedUserData(userId: string, displayUsername: string): Promise<void> {
  await sql`
    update users
    set
      is_public = true,
      github_access_token_enc = ${Buffer.from(`${RUN_ID}-access-token`)},
      github_refresh_token_enc = ${Buffer.from(`${RUN_ID}-refresh-token`)},
      github_token_expires_at = now() + interval '1 day',
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
      'delete-account-fixture',
      'TypeScript',
      true
    )
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
        file_paths: ['app/delete-account-fixture.tsx'],
        additions: 10,
        deletions: 1,
        github_url: 'https://github.com/test-owner/delete-account-fixture/commit/e2e',
      })}
    )
    returning id
  `
  const activityId = activityRows[0].id as string

  await sql`
    insert into activity_territories (activity_id, territory_type, weight, tech_keys)
    values (${activityId}, 'frontend_land', 5, array['typescript'])
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
  `
  await sql`
    insert into email_sends (user_id, email_type, external_message_id)
    values (${userId}, 'weekly_recap', ${`${RUN_ID}-email`})
  `
  await sql`
    insert into username_history (old_username, user_id)
    values (${`${displayUsername}-${RUN_ID}`}, ${userId})
  `
  await sql`
    insert into misclassification_feedback (
      user_id,
      tech_key,
      territory_type,
      related_repo_id,
      category,
      note
    )
    values (
      ${userId},
      'typescript',
      'frontend_land',
      ${repoId},
      'wrong_category',
      'delete account e2e fixture'
    )
  `
  await sql`
    insert into sync_jobs (user_id, kind, status, started_at, completed_at)
    values (${userId}, 'manual', 'completed', now(), now())
  `
}

type CascadeCounts = {
  users: number
  repositories: number
  activities: number
  activityTerritories: number
  territories: number
  landmarks: number
  weeklyRecaps: number
  emailSends: number
  usernameHistory: number
  misclassificationFeedback: number
  syncJobs: number
}

async function getCascadeCounts(userId: string): Promise<CascadeCounts> {
  const rows = await sql`
    select
      (select count(*)::int from users where id = ${userId}) as users,
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
      (select count(*)::int from weekly_recaps where user_id = ${userId}) as "weeklyRecaps",
      (select count(*)::int from email_sends where user_id = ${userId}) as "emailSends",
      (select count(*)::int from username_history where user_id = ${userId}) as "usernameHistory",
      (
        select count(*)::int
        from misclassification_feedback
        where user_id = ${userId}
      ) as "misclassificationFeedback",
      (select count(*)::int from sync_jobs where user_id = ${userId}) as "syncJobs"
  `
  const row = rows[0] as Record<keyof CascadeCounts, number>
  return {
    users: row.users,
    repositories: row.repositories,
    activities: row.activities,
    activityTerritories: row.activityTerritories,
    territories: row.territories,
    landmarks: row.landmarks,
    weeklyRecaps: row.weeklyRecaps,
    emailSends: row.emailSends,
    usernameHistory: row.usernameHistory,
    misclassificationFeedback: row.misclassificationFeedback,
    syncJobs: row.syncJobs,
  }
}

async function authUserExists(userId: string): Promise<boolean> {
  if (!adminClient) throw new Error('Supabase admin client not initialized')
  const { data, error } = await adminClient.auth.admin.getUserById(userId)
  if (error && error.message.toLowerCase().includes('not found')) return false
  if (error && error.status === 404) return false
  if (error) throw new Error(error.message)
  return Boolean(data.user)
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
