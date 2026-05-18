import { test, expect } from '@playwright/test'

test('reduced motion: no twinkle, no parallax, no breathing', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto('/dev/map?scenario=dense')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  // Take two screenshots 2s apart; they should be identical (no motion)
  const a = await page.screenshot()
  await page.waitForTimeout(2000)
  const b = await page.screenshot()
  // If twinkle/parallax/breathing were active, pixels would differ.
  // Allow tiny diff for sub-pixel raster differences.
  expect(Buffer.compare(a, b)).toBe(0)
})
