import type { Viewport } from '@/features/constellation/render/types'

export const MOBILE_VIEWPORT_MAX_WIDTH = 767

export function responsiveViewportForWidth(
  width: number | null | undefined,
  requestedViewport?: Viewport,
): Viewport {
  if (requestedViewport === 'og') return 'og'
  if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
    return width <= MOBILE_VIEWPORT_MAX_WIDTH ? 'mobile' : 'desktop'
  }
  return requestedViewport ?? 'desktop'
}
