import { describe, expect, it } from 'vitest'
import { shouldPollLatestSyncJob } from '@/app/_components/RefreshButton'

describe('RefreshButton polling gate', () => {
  it('does not poll when idle', () => {
    expect(shouldPollLatestSyncJob('idle', null)).toBe(false)
  })

  it('polls manual and unknown active jobs as a missed-realtime fallback', () => {
    expect(shouldPollLatestSyncJob('pending', 'manual')).toBe(true)
    expect(shouldPollLatestSyncJob('running', null)).toBe(true)
  })

  it('does not duplicate the map container polling for build-blocking jobs', () => {
    expect(shouldPollLatestSyncJob('pending', 'initial')).toBe(false)
    expect(shouldPollLatestSyncJob('running', 'backfill')).toBe(false)
  })
})
