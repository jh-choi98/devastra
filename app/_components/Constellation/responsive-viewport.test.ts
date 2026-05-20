import { describe, expect, it } from 'vitest'
import { responsiveViewportForWidth } from './responsive-viewport'

describe('responsiveViewportForWidth', () => {
  it('uses mobile rendering for narrow web containers', () => {
    expect(responsiveViewportForWidth(390)).toBe('mobile')
    expect(responsiveViewportForWidth(390, 'desktop')).toBe('mobile')
  })

  it('uses desktop rendering for wider web containers', () => {
    expect(responsiveViewportForWidth(1024)).toBe('desktop')
    expect(responsiveViewportForWidth(1440, 'mobile')).toBe('desktop')
  })

  it('preserves the OG viewport because it is a fixed export format', () => {
    expect(responsiveViewportForWidth(390, 'og')).toBe('og')
  })

  it('falls back to the requested viewport before measurement', () => {
    expect(responsiveViewportForWidth(null, 'mobile')).toBe('mobile')
    expect(responsiveViewportForWidth(undefined)).toBe('desktop')
  })
})
