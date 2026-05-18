import { describe, expect, it } from 'vitest'
import { getTimezoneOptions, isSupportedTimezone } from '@/app/(authenticated)/settings/_timezones'

describe('settings timezones', () => {
  it('includes the current timezone exactly once', () => {
    const options = getTimezoneOptions('America/Coyhaique')

    expect(options.filter((timezone) => timezone === 'America/Coyhaique')).toHaveLength(1)
  })

  it('returns a stable sorted option list', () => {
    const options = getTimezoneOptions('Asia/Seoul')

    expect(options).toEqual([...options].sort())
  })

  it('validates timezone names before saving', () => {
    expect(isSupportedTimezone('UTC')).toBe(true)
    expect(isSupportedTimezone('Not/A Zone')).toBe(false)
  })
})
