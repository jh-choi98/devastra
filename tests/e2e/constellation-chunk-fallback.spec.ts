import { expect, test } from '@playwright/test'

test('renderer chunk load failure keeps the constellation shell visible', async ({ page }) => {
  let blockedRendererChunk = false

  await page.route('**/*.js', async (route) => {
    const url = route.request().url()
    if (url.includes('ConstellationWebGL')) {
      blockedRendererChunk = true
      await route.abort('failed')
      return
    }

    await route.continue()
  })

  await page.goto('/dev/map?scenario=dense')

  await expect.poll(() => blockedRendererChunk, { timeout: 5_000 }).toBe(true)
  await expect(page.locator('svg').first()).toBeVisible()
  await expect(page.getByText('Unhandled Runtime Error')).toHaveCount(0)
})
