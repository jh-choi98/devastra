import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { loadEnvConfig } from '@next/env'
import { SignJWT } from 'jose'
import postgres from 'postgres'
import { Webhook } from 'svix'

loadEnvConfig(process.cwd())

const TEST_GITHUB_LOGIN = 'test-e2e-user'
const UNSUBSCRIBE_SECRET =
  process.env.UNSUBSCRIBE_TOKEN_SECRET ?? 'local-e2e-unsubscribe-secret-for-tests-only'
const RESEND_WEBHOOK_SECRET =
  process.env.RESEND_WEBHOOK_SECRET ?? 'whsec_test'
const WEBHOOK_MESSAGE_PREFIX = `e2e-bounce-${Date.now()}`
const canUseDatabase = Boolean(process.env.DATABASE_URL)

test.skip(!canUseDatabase, 'DATABASE_URL is required for email flow E2E tests.')
test.describe.configure({ mode: 'serial' })

const sql = postgres(process.env.DATABASE_URL ?? '', {
  max: 1,
  prepare: false,
})

test.afterAll(async () => {
  await sql`
    delete from email_sends
    where external_message_id like ${`${WEBHOOK_MESSAGE_PREFIX}%`}
  `
  await sql`
    update users
    set email_recap_enabled = true
    where github_login = ${TEST_GITHUB_LOGIN}
  `
  await sql.end({ timeout: 5 })
})

test('Settings email recap switch persists to users.email_recap_enabled', async ({ page }) => {
  test.skip(process.env.ENABLE_EMAIL_RECAPS !== '1', 'Email recap Settings UI is Phase 2 gated.')
  const runtime = trackRuntime(page)

  await signInWithMockOAuth(page)
  await setEmailRecapEnabled(true)

  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  const emailSection = page.locator('section').filter({ hasText: 'Email recap' })
  const recapSwitch = emailSection.getByRole('switch')

  await expect(recapSwitch).toHaveAttribute('aria-checked', 'true')
  await recapSwitch.click()
  await expect(recapSwitch).toHaveAttribute('aria-checked', 'false')
  await expect.poll(getEmailRecapEnabled).toBe(false)

  await recapSwitch.click()
  await expect(recapSwitch).toHaveAttribute('aria-checked', 'true')
  await expect.poll(getEmailRecapEnabled).toBe(true)

  expect(runtime.errors).toEqual([])
  expect(runtime.serverErrors).toEqual([])
})

test('Settings hides email recap controls while the Phase 2 flag is disabled', async ({ page }) => {
  test.skip(process.env.ENABLE_EMAIL_RECAPS === '1', 'Email recap Settings UI is enabled.')
  const runtime = trackRuntime(page)

  await signInWithMockOAuth(page)

  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Email recap' })).toHaveCount(0)
  await expect(page.getByText('Dates are shown in this timezone.')).toBeVisible()

  expect(runtime.errors).toEqual([])
  expect(runtime.serverErrors).toEqual([])
})

test('unsubscribe link disables recap and Undo re-enables it', async ({ page }) => {
  const runtime = trackRuntime(page)

  await signInWithMockOAuth(page)
  await setEmailRecapEnabled(true)
  const user = await getTestUser()
  const token = await signUnsubscribeToken(user.id)

  await page.goto(`/unsubscribe?token=${encodeURIComponent(token)}`)
  await expect(page.getByRole('heading', { name: /unsubscribed from weekly recaps/i })).toBeVisible()
  await expect.poll(getEmailRecapEnabled).toBe(false)

  await page.getByRole('button', { name: /undo/i }).click()
  await expect.poll(getEmailRecapEnabled).toBe(true)
  await expect(page.getByRole('button', { name: /undo/i })).toHaveCount(0)

  expect(runtime.errors).toEqual([])
  expect(runtime.serverErrors).toEqual([])
})

test('Resend bounce webhook disables recap after 3 consecutive bounces', async ({ page, request }) => {
  const runtime = trackRuntime(page)

  await signInWithMockOAuth(page)
  await setEmailRecapEnabled(true)
  const user = await getTestUser()
  const messageIds = [
    `${WEBHOOK_MESSAGE_PREFIX}-oldest`,
    `${WEBHOOK_MESSAGE_PREFIX}-middle`,
    `${WEBHOOK_MESSAGE_PREFIX}-newest`,
  ]

  await sql`
    delete from email_sends
    where external_message_id like ${`${WEBHOOK_MESSAGE_PREFIX}%`}
  `
  await sql`
    insert into email_sends (user_id, email_type, external_message_id, bounced, sent_at)
    values
      (${user.id}, 'weekly_recap_active', ${messageIds[0]}, false, now() + interval '8 minutes'),
      (${user.id}, 'weekly_recap_active', ${messageIds[1]}, false, now() + interval '9 minutes'),
      (${user.id}, 'weekly_recap_active', ${messageIds[2]}, false, now() + interval '10 minutes')
  `

  await postResendBounce(request, messageIds[0])
  await expect.poll(getEmailRecapEnabled).toBe(true)

  await postResendBounce(request, messageIds[1])
  await expect.poll(getEmailRecapEnabled).toBe(true)

  await postResendBounce(request, messageIds[2])
  await expect.poll(getEmailRecapEnabled).toBe(false)

  expect(runtime.errors).toEqual([])
  expect(runtime.serverErrors).toEqual([])
})

async function signInWithMockOAuth(page: Page): Promise<void> {
  const response = await page.request.get('/api/test/mock-oauth', { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  await expect.poll(async () => (await getTestUser()).id).not.toBe('')
}

async function getTestUser(): Promise<{ id: string; email_recap_enabled: boolean }> {
  const rows = await sql`
    select id, email_recap_enabled
    from users
    where github_login = ${TEST_GITHUB_LOGIN}
    limit 1
  `
  expect(rows).toHaveLength(1)
  return rows[0] as { id: string; email_recap_enabled: boolean }
}

async function getEmailRecapEnabled(): Promise<boolean> {
  return (await getTestUser()).email_recap_enabled
}

async function setEmailRecapEnabled(enabled: boolean): Promise<void> {
  await sql`
    update users
    set email_recap_enabled = ${enabled}
    where github_login = ${TEST_GITHUB_LOGIN}
  `
}

async function signUnsubscribeToken(userId: string): Promise<string> {
  return new SignJWT({
    user_id: userId,
    email_type: 'weekly_recap_active',
    version: Number(process.env.UNSUBSCRIBE_TOKEN_VERSION ?? '1'),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(new TextEncoder().encode(UNSUBSCRIBE_SECRET))
}

async function postResendBounce(request: APIRequestContext, emailId: string): Promise<void> {
  const body = JSON.stringify({ type: 'email.bounced', data: { email_id: emailId } })
  const msgId = `msg_${emailId}`
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = new Webhook(RESEND_WEBHOOK_SECRET).sign(
    msgId,
    new Date(Number(timestamp) * 1000),
    body,
  )

  const response = await request.post('/api/webhooks/resend', {
    data: body,
    headers: {
      'content-type': 'application/json',
      'svix-id': msgId,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    },
  })
  expect(response.ok()).toBe(true)
}

function trackRuntime(page: Page): { errors: string[]; serverErrors: string[] } {
  const errors: string[] = []
  const serverErrors: string[] = []

  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`)
    }
  })

  return { errors, serverErrors }
}
