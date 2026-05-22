import { describe, expect, it } from 'vitest'
import {
  getTimezoneOptions,
  getTimezonePreviewLine,
  isSupportedTimezone,
} from '@/app/(authenticated)/settings/_timezones'

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

  it('describes the weekly recap as a local wall-clock time', () => {
    expect(getTimezonePreviewLine('Pacific/Pitcairn')).toBe(
      'Your weekly recap arrives Sunday at 6:00 PM in this timezone.',
    )
    expect(getTimezonePreviewLine('Asia/Seoul')).toBe(
      'Your weekly recap arrives Sunday at 6:00 PM in this timezone.',
    )
  })

  it('falls back when the timezone cannot be formatted', () => {
    expect(getTimezonePreviewLine('Not/A Zone')).toBe(
      'Your weekly recap arrives Sunday in this timezone.',
    )
  })

  it('uses account date copy while email recaps are deferred', () => {
    expect(getTimezonePreviewLine('Asia/Seoul', { emailRecapsEnabled: false })).toBe(
      'Dates are shown in this timezone.',
    )
  })
})
