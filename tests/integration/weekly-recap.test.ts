import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/client', () => ({ db: {} }))
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: vi.fn() } } }))

import { computeLastFullWeekUtcMonday, computeSendAtSundayLocal } from '@/features/recap/time'

describe('computeLastFullWeekUtcMonday', () => {
  it('returns the Monday of the previous full UTC week', () => {
    // 2026-05-13 (Wednesday)
    const now = new Date('2026-05-13T12:00:00Z')
    const result = computeLastFullWeekUtcMonday(now)
    // Previous Monday: 2026-05-04
    expect(result.toISOString().startsWith('2026-05-04')).toBe(true)
    expect(result.getUTCHours()).toBe(0)
    expect(result.getUTCMinutes()).toBe(0)
  })

  it('returns the previous Monday when called on a Sunday', () => {
    // 2026-05-17 (Sunday)
    const now = new Date('2026-05-17T23:00:00Z')
    const result = computeLastFullWeekUtcMonday(now)
    // Previous Monday: 2026-05-04
    expect(result.toISOString().startsWith('2026-05-04')).toBe(true)
  })

  it('returns the correct Monday when called on a Monday', () => {
    // 2026-05-18 (Monday)
    const now = new Date('2026-05-18T09:00:00Z')
    const result = computeLastFullWeekUtcMonday(now)
    // Previous week Monday: 2026-05-11
    expect(result.toISOString().startsWith('2026-05-11')).toBe(true)
  })
})

describe('computeSendAtSundayLocal', () => {
  it('returns a date with Sunday in the given timezone', () => {
    // Use a known date: 2026-05-13 Wednesday
    const now = new Date('2026-05-13T12:00:00Z')
    const result = computeSendAtSundayLocal('UTC', now)
    expect(result.getUTCDay()).toBe(0) // 0 = Sunday
  })

  it('returns a future date for UTC timezone', () => {
    const now = new Date('2026-05-13T12:00:00Z')
    const result = computeSendAtSundayLocal('UTC', now)
    expect(result.getTime()).toBeGreaterThan(now.getTime())
  })
})
