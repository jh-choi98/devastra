import { describe, expect, it } from 'vitest'
import { mergeCachedActivityAttribution } from '@/features/sync/cached-attribution'

describe('mergeCachedActivityAttribution', () => {
  it('keeps dependency stars during fast rebuilds with default manifest context', () => {
    const results = mergeCachedActivityAttribution(
      [{ territory: 'frontend_land', weight: 1, techKeys: ['typescript'] }],
      [{ territory: 'frontend_land', weight: 1, techKeys: ['typescript', 'react'] }],
    )

    expect(results).toEqual([
      { territory: 'frontend_land', weight: 1, techKeys: ['typescript', 'react'] },
    ])
  })

  it('keeps framework-implied runtime stars in the same territory', () => {
    const results = mergeCachedActivityAttribution(
      [{ territory: 'backend_fortress', weight: 1, techKeys: ['go'] }],
      [{ territory: 'backend_fortress', weight: 2, techKeys: ['go', 'gin'] }],
    )

    expect(results).toEqual([{ territory: 'backend_fortress', weight: 2, techKeys: ['go', 'gin'] }])
  })

  it('can restore a cached dependency-only territory until manifests are rechecked', () => {
    const results = mergeCachedActivityAttribution(
      [],
      [{ territory: 'testing_lab', weight: 0.7, techKeys: ['vitest'] }],
    )

    expect(results).toEqual([{ territory: 'testing_lab', weight: 0.7, techKeys: ['vitest'] }])
  })
})
