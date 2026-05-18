import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test('signup → repo selection → first reveal completes', async ({ page }) => {
  // Mock OAuth flow uses /api/test/mock-oauth (NODE_ENV must be non-prod)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /skill constellation that lights up/i })).toBeVisible()

  // Click sign in (this triggers a Server Action; on dev, it routes to mock OAuth)
  await page.getByRole('button', { name: /sign in with github/i }).click()

  // Repo selection
  await expect(page).toHaveURL(/onboarding\/repos/)
  await expect(page.getByText(/pick your repos/i)).toBeVisible()
  await page.getByRole('button', { name: /build my constellation/i }).click()

  // Main constellation page — wait for reveal to complete (max ~30s + buffer)
  await expect(page).toHaveURL(/^\//)
  await page.waitForSelector('[data-testid="constellation-canvas"]', { timeout: 5000 })

  // First reveal should complete and the cluster labels should appear.
  // Visible cluster labels should include at least one of the six names.
  const clusterLabels = ['Frontend', 'Backend', 'Data', 'Testing', 'DevOps', 'Docs']
  // Wait until any cluster label is visible (timing depends on sync speed; budget 60s).
  await Promise.any(clusterLabels.map((label) =>
    page.getByText(label, { exact: true }).waitFor({ state: 'visible', timeout: 60_000 }),
  ))

  // Drawer test: click a visible cluster label
  for (const label of clusterLabels) {
    const el = page.getByText(label, { exact: true })
    if (await el.isVisible()) {
      await el.click()
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
      await page.keyboard.press('Escape')
      break
    }
  }
})
