import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

test.describe('signup → repo selection → reveal complete', () => {
  test('smoke: landing → mock oauth → onboarding → reveal', async ({ page }) => {
    // 1. Navigate to landing page
    await page.goto(BASE_URL)
    await expect(page.locator('h1')).toContainText('Turn your GitHub into')

    // 2. Trigger mock OAuth (bypasses real GitHub, creates test session)
    await page.goto(`${BASE_URL}/api/test/mock-oauth`)
    // After mock OAuth, should land on onboarding or home
    await expect(page).toHaveURL(/\/(onboarding\/repos|$)/)

    // 3. If on onboarding, click Skip & Build
    if (page.url().includes('/onboarding/repos')) {
      const skipButton = page.getByRole('button', { name: /skip/i })
      await expect(skipButton).toBeVisible()
      await skipButton.click()
    }

    // 4. Should land on home page (map)
    await expect(page).toHaveURL(`${BASE_URL}/`)

    // 5. Wait for reveal to complete — progress text disappears and all 6 territories render
    await expect(page.locator('[data-territory]')).toHaveCount(6, { timeout: 60_000 })
  })
})
