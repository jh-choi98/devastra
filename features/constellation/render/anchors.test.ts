import { describe, it, expect } from 'vitest'
import { ANCHORS, anchorsFor, anchorFor } from './anchors'

const VIEWPORTS = ['desktop', 'mobile', 'og'] as const
const ALL_TYPES = [
  'frontend_land',
  'backend_fortress',
  'data_pipeline_zone',
  'testing_lab',
  'devops_harbor',
  'docs_library',
] as const

describe('anchors', () => {
  it('each viewport has exactly 6 distinct cluster types', () => {
    for (const vp of VIEWPORTS) {
      const types = ANCHORS[vp].map((a) => a.type)
      expect(new Set(types).size).toBe(6)
      for (const t of ALL_TYPES) {
        expect(types).toContain(t)
      }
    }
  })

  it('all anchor positions are within the 1000x700 viewBox', () => {
    for (const vp of VIEWPORTS) {
      for (const a of ANCHORS[vp]) {
        expect(a.x).toBeGreaterThan(0)
        expect(a.x).toBeLessThan(1000)
        expect(a.y).toBeGreaterThan(0)
        expect(a.y).toBeLessThan(700)
        expect(a.spread).toBeGreaterThan(0)
      }
    }
  })

  it('anchorsFor returns the same array as ANCHORS', () => {
    for (const vp of VIEWPORTS) {
      expect(anchorsFor(vp)).toStrictEqual(ANCHORS[vp])
    }
  })

  it('anchorFor returns the correct anchor and throws for invalid type', () => {
    const a = anchorFor('desktop', 'frontend_land')
    expect(a.type).toBe('frontend_land')
    expect(a.x).toBe(215)
    expect(a.y).toBe(205)

    expect(() => anchorFor('desktop', 'unknown_type' as never)).toThrow()
  })
})
