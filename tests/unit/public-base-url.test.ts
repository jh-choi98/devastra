import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPublicBaseUrl, publicUrl } from '@/lib/utils/public-base-url'

describe('public-base-url', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers NEXT_PUBLIC_APP_URL for share links', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://preview.example.com/')
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://base.example.com')

    expect(getPublicBaseUrl()).toBe('https://preview.example.com')
    expect(publicUrl('/jh-choi98')).toBe('https://preview.example.com/jh-choi98')
  })

  it('falls back to NEXT_PUBLIC_BASE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://base.example.com/')

    expect(publicUrl('api/og/profile/jh-choi98')).toBe(
      'https://base.example.com/api/og/profile/jh-choi98',
    )
  })
})
