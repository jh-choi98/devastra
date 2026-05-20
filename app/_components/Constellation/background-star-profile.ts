import type { Viewport } from '@/features/constellation/render/types'

export interface BackgroundStarProfile {
  fieldCount: number
  midCount: number
  fieldOpacity: number
  midOpacity: number
  fieldSizeScale: number
  midSizeScale: number
  fieldSpreadX: number
  fieldSpreadY: number
  twinkleAmplitude: number
}

const BASELINE_AREA = 1440 * 900
const BASE_FIELD_COUNT = 2000
const BASE_MID_COUNT = 420
const BACKGROUND_STAR_SIZE_MULTIPLIER = 1.1

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step
}

function enlargeBackgroundStars(sizeScale: number): number {
  return sizeScale * BACKGROUND_STAR_SIZE_MULTIPLIER
}

/**
 * Keeps the background sky responsive to real canvas size while preserving the
 * fixed semantic constellation layout. Small canvases get quieter skies so tech
 * stars stay foreground; large canvases get a little more fill and scale.
 */
export function backgroundStarProfileForCanvas(
  width: number,
  height: number,
  viewport: Viewport = 'desktop',
): BackgroundStarProfile {
  if (viewport === 'og') {
    return {
      fieldCount: 1500,
      midCount: 280,
      fieldOpacity: 1,
      midOpacity: 1,
      fieldSizeScale: enlargeBackgroundStars(1),
      midSizeScale: enlargeBackgroundStars(1),
      fieldSpreadX: 1,
      fieldSpreadY: 1,
      twinkleAmplitude: 0.1,
    }
  }

  const safeWidth = Math.max(320, width)
  const safeHeight = Math.max(480, height)
  const areaRatio = (safeWidth * safeHeight) / BASELINE_AREA
  const areaScale = clamp(Math.sqrt(areaRatio), 0.38, 1.42)
  const narrowness = clamp((720 - safeWidth) / 400, 0, 1)
  const spaciousness = clamp((safeWidth - 1440) / 900, 0, 1)
  const aspect = safeWidth / safeHeight
  const tallCanvas = clamp(1.2 - aspect, 0, 0.82)

  const fieldCount = roundToStep(
    clamp(BASE_FIELD_COUNT * areaScale * (1 - narrowness * 0.18), 720, 3000),
    20,
  )
  const midCount = roundToStep(
    clamp(BASE_MID_COUNT * Math.pow(areaScale, 1.18) * (1 - narrowness * 0.35), 90, 620),
    10,
  )

  return {
    fieldCount,
    midCount,
    fieldOpacity: clamp(0.82 + areaScale * 0.16 - narrowness * 0.08, 0.74, 1),
    midOpacity: clamp(0.74 + areaScale * 0.2 - narrowness * 0.14, 0.62, 0.96),
    fieldSizeScale: enlargeBackgroundStars(
      clamp(0.9 + areaScale * 0.08 + spaciousness * 0.06, 0.9, 1.1),
    ),
    midSizeScale: enlargeBackgroundStars(
      clamp(0.86 + areaScale * 0.1 + spaciousness * 0.05, 0.88, 1.08),
    ),
    fieldSpreadX: 1,
    fieldSpreadY: 1 + tallCanvas * 0.82,
    twinkleAmplitude: clamp(0.065 + areaScale * 0.025 - narrowness * 0.015, 0.055, 0.095),
  }
}
