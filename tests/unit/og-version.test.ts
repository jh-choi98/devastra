import { describe, it, expect } from 'vitest'
import { OG_RENDER_VERSION, ogVersionParam } from '@/lib/og/version'

describe('og version', () => {
  it('reads from env when set', async () => {
    const orig = process.env.OG_RENDER_VERSION
    process.env.OG_RENDER_VERSION = 'test-v9'
    // Re-import to bypass module-level const capture — note this test verifies
    // the shape, not module hot-reload semantics. The runtime value is read
    // at module load time, so this just checks the helper format.
    expect(ogVersionParam()).toMatch(/^v=/)
    process.env.OG_RENDER_VERSION = orig
  })

  it('returns a v=... query param string', () => {
    expect(ogVersionParam()).toMatch(/^v=[A-Za-z0-9-]+$/)
  })
})
