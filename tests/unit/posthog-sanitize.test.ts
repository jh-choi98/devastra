import { describe, it, expect } from 'vitest'
import { sanitizePath, sanitizeUrl } from '@/lib/posthog'

describe('sanitizePath', () => {
  it('masks a top-level username path', () => {
    expect(sanitizePath('/alice')).toBe('/[username]')
    expect(sanitizePath('/bob123')).toBe('/[username]')
    expect(sanitizePath('/my-user_name')).toBe('/[username]')
  })

  it('preserves system paths', () => {
    expect(sanitizePath('/')).toBe('/')
    expect(sanitizePath('/auth/callback')).toBe('/auth/callback')
    expect(sanitizePath('/settings')).toBe('/settings')
    expect(sanitizePath('/settings/profile')).toBe('/settings/profile')
    expect(sanitizePath('/onboarding/repos')).toBe('/onboarding/repos')
    expect(sanitizePath('/api/health')).toBe('/api/health')
    expect(sanitizePath('/privacy')).toBe('/privacy')
    expect(sanitizePath('/terms')).toBe('/terms')
    expect(sanitizePath('/unsubscribe')).toBe('/unsubscribe')
    expect(sanitizePath('/account-deleted')).toBe('/account-deleted')
    expect(sanitizePath('/rate-limited')).toBe('/rate-limited')
    expect(sanitizePath('/_next/static/chunks/main.js')).toBe('/_next/static/chunks/main.js')
  })

  it('does not mask paths with uppercase letters (not a username)', () => {
    // Usernames are lowercase; paths with uppercase fall through unchanged
    expect(sanitizePath('/Alice')).toBe('/Alice')
  })
})

describe('sanitizeUrl', () => {
  it('masks username in a full URL', () => {
    const result = sanitizeUrl('https://devastra.app/alice')
    expect(result).toBe('https://devastra.app/[username]')
  })

  it('preserves system paths in full URLs', () => {
    expect(sanitizeUrl('https://devastra.app/')).toBe('https://devastra.app/')
    expect(sanitizeUrl('https://devastra.app/privacy')).toBe('https://devastra.app/privacy')
  })

  it('returns the original string on invalid URL', () => {
    expect(sanitizeUrl('not-a-url')).toBe('not-a-url')
  })
})
