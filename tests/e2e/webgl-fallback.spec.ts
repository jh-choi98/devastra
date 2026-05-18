import { test, expect } from '@playwright/test'

test('WebGL fallback shows banner + skeleton', async ({ browser }) => {
  const context = await browser.newContext()
  // Null out WebGL context creation so useWebGLDetect returns false
  await context.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    HTMLCanvasElement.prototype.getContext = function (...args: any[]) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(args[0])) return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (orig as any).apply(this, args)
    }
  })
  const page = await context.newPage()
  await page.goto('/dev/map')
  await expect(page.getByRole('status').first()).toContainText("doesn't support advanced graphics")
  // Skeleton (SVG boundary lines) still renders
  await expect(page.locator('svg').first()).toBeVisible()
})
