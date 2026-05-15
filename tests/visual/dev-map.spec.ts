import { test, expect } from '@playwright/test'

const SCENARIOS = [
  { name: 'empty',      url: '/dev/map?scenario=empty' },
  { name: 'sparse',     url: '/dev/map?scenario=sparse' },
  { name: 'dense',      url: '/dev/map?scenario=dense' },
  { name: 'stage-up',   url: '/dev/map?scenario=stage-up' },
  { name: 'first-ever', url: '/dev/map?scenario=first-ever' },
]

for (const s of SCENARIOS) {
  test(`visual regression: ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`http://localhost:3000${s.url}`)
    // Wait for Scene fade-in (~500ms) + texture load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
    await expect(page).toHaveScreenshot(`${s.name}.png`, { maxDiffPixelRatio: 0.03 })
  })
}
