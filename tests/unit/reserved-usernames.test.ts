import { describe, it, expect } from 'vitest'
import { isReserved, RESERVED_USERNAMES } from '../../lib/utils/reserved-usernames'

describe('isReserved', () => {
  it('returns true for "settings"', () => {
    expect(isReserved('settings')).toBe(true)
  })

  it('returns true for "api"', () => {
    expect(isReserved('api')).toBe(true)
  })

  it('returns true for "admin"', () => {
    expect(isReserved('admin')).toBe(true)
  })

  it('returns true for "login"', () => {
    expect(isReserved('login')).toBe(true)
  })

  it('returns true for "devatlas"', () => {
    expect(isReserved('devatlas')).toBe(true)
  })

  it('returns false for a normal username "juho"', () => {
    expect(isReserved('juho')).toBe(false)
  })

  it('returns false for a normal username "alice"', () => {
    expect(isReserved('alice')).toBe(false)
  })

  it('is case-insensitive: "Settings" returns true', () => {
    expect(isReserved('Settings')).toBe(true)
  })

  it('is case-insensitive: "ADMIN" returns true', () => {
    expect(isReserved('ADMIN')).toBe(true)
  })

  it('set contains all documented system paths', () => {
    const expected = [
      'settings', 'api', 'admin', 'login', 'signup', 'signin', 'signout', 'auth',
      'app', 'dev', 'static', '_next', 'public', 'about', 'help', 'support',
      'privacy', 'terms', 'docs', 'blog', 'home', 'me', 'profile', 'account',
      'onboarding', 'welcome', 'feed', 'explore', 'search', 'notifications',
    ]
    for (const name of expected) {
      expect(RESERVED_USERNAMES.has(name)).toBe(true)
    }
  })
})
