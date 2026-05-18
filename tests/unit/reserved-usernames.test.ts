import { describe, it, expect } from 'vitest'
import { isReservedUsername, RESERVED_USERNAMES } from '@/lib/utils/reserved-usernames'

describe('reserved usernames', () => {
  it('contains common system paths', () => {
    expect(RESERVED_USERNAMES.has('settings')).toBe(true)
    expect(RESERVED_USERNAMES.has('api')).toBe(true)
    expect(RESERVED_USERNAMES.has('devastra')).toBe(true)
  })

  it('isReservedUsername is case-insensitive', () => {
    expect(isReservedUsername('Settings')).toBe(true)
    expect(isReservedUsername('SETTINGS')).toBe(true)
    expect(isReservedUsername('settings')).toBe(true)
  })

  it('returns false for non-reserved names', () => {
    expect(isReservedUsername('alice')).toBe(false)
    expect(isReservedUsername('juho')).toBe(false)
  })
})
