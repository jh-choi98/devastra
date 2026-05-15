import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
    },
    {
      name: 'a11y',
      testDir: './tests/a11y',
    },
    {
      name: 'visual',
      testDir: './tests/visual',
      snapshotDir: './tests/visual/__screenshots__',
      // reducedMotion disables field-star twinkle, making snapshots deterministic
      use: { reducedMotion: 'reduce' },
    },
    {
      name: 'mobile-chrome',
      testDir: './tests/visual',
      snapshotDir: './tests/visual/__screenshots__/mobile',
      use: { ...devices['Pixel 5'], reducedMotion: 'reduce' },
    },
  ],
})
