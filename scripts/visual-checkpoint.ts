import { chromium } from 'playwright'
import * as path from 'path'

const url = process.argv[2] ?? 'http://localhost:3000/dev/map?layers=sky,fieldstars'
const outputPath = process.argv[3] ?? path.join(process.cwd(), 'tasks/2-stellarium-redesign/visual-checkpoints/phase4.png')
const TIMEOUT = 15_000

async function capture() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const errors: string[] = []
  // Filter out dev-mode noise from third-party analytics CSP warnings
  const isIgnoredError = (msg: string) =>
    msg.includes('va.vercel-scripts.com') ||
    msg.includes('Content Security Policy') ||
    msg.includes('posthog') ||
    msg.includes('sentry-cdn')

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isIgnoredError(msg.text())) errors.push(msg.text())
  })
  page.on('pageerror', (err) => {
    if (!isIgnoredError(err.message)) errors.push(err.message)
  })

  await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT })
  // Wait for WebGL canvas to fade in
  await page.waitForTimeout(3000)

  await page.screenshot({ path: outputPath, fullPage: false })
  await browser.close()

  if (errors.length > 0) {
    console.error('Console errors detected:')
    errors.forEach((e) => console.error(' -', e))
    process.exit(1)
  }

  console.log('Screenshot saved:', outputPath)
  console.log('Console errors: 0')
}

capture().catch((err) => {
  console.error(err)
  process.exit(1)
})
