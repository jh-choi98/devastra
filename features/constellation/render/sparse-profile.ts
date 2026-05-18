// SPDX-License-Identifier: MIT

import type { Viewport } from './types'

export interface SparseConstellationProfile {
  intensity: number
  cameraZoom: number
  fieldStarOpacity: number
  midStarOpacity: number
  techStarScale: number
  techStarIntensity: number
  spikeScale: number
  unlitAnchorOpacity: number
}

const SPARSE_STAR_LIMIT = 18

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function sparseIntensityForLitStars(litStarCount: number): number {
  if (litStarCount <= 0) return 0
  if (litStarCount >= SPARSE_STAR_LIMIT) return 0
  return clamp01((SPARSE_STAR_LIMIT - litStarCount) / (SPARSE_STAR_LIMIT - 1))
}

export function sparseProfileForLitStars(
  litStarCount: number,
  viewport: Viewport = 'desktop',
): SparseConstellationProfile {
  const intensity = sparseIntensityForLitStars(litStarCount)
  const mobile = viewport === 'mobile'

  return {
    intensity,
    cameraZoom: 1 + intensity * (mobile ? 0.06 : 0.1),
    fieldStarOpacity: 1 - intensity * 0.1,
    midStarOpacity: 1 - intensity * 0.12,
    techStarScale: 1 + intensity * (mobile ? 0.14 : 0.18),
    techStarIntensity: 1 + intensity * 0.16,
    spikeScale: 1 + intensity * 0.22,
    unlitAnchorOpacity: 1 + intensity * 0.25,
  }
}
