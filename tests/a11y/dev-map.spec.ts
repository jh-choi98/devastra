import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('/dev/map passes WCAG AA', async ({ page }) => {
  // Requires ENABLE_DEV_MAP=1 in env or NODE_ENV=development
  await page.goto('http://localhost:3000/dev/map?layers=all')
  await page.waitForLoadState('networkidle')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})
