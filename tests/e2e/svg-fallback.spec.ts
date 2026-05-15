import { test, expect } from '@playwright/test'

test('CONSTELLATION_RENDERER=svg still renders the legacy SVG path', async ({ page }) => {
  // Requires the dev server to be started with CONSTELLATION_RENDERER=svg
  await page.goto('http://localhost:3000/dev/map?scenario=dense')
  // The SVG renderer is the legacy implementation; at least one SVG should be present
  await expect(page.locator('svg').first()).toBeVisible()
  // No <canvas> from R3F should be present
  await expect(page.locator('canvas')).toHaveCount(0)
})
