import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

test('constellation renders with stable visual snapshot', async ({ page }) => {
  // Sign in via mock OAuth, run sync, navigate to /
  // (Reuse helpers from signup-to-reveal.spec.ts via test fixtures or duplicate inline.)

  await page.goto('/')
  await page.goto('/api/test/mock-oauth')
  if (page.url().includes('/onboarding/repos')) {
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible()) await skipButton.click()
  }
  await expect(page).toHaveURL(/^\//)

  // After the reveal completes, snapshot the canvas region.
  const canvas = page.locator('[data-testid="constellation-canvas"]')
  await canvas.waitFor({ state: 'visible', timeout: 10_000 })
  await expect(canvas).toHaveScreenshot('constellation-default.png', {
    maxDiffPixelRatio: 0.02,
    timeout: 5000,
  })
})
