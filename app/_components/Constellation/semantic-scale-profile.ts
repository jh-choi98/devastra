import type { Viewport } from '@/features/constellation/render/types'

export interface SemanticConstellationScaleProfile {
  techCoreScale: number
  techSpikeScale: number
  techIntensityScale: number
  techLabelScale: number
  techLabelDistanceScale: number
}

export const DEFAULT_SEMANTIC_SCALE_PROFILE: SemanticConstellationScaleProfile = {
  techCoreScale: 1,
  techSpikeScale: 1,
  techIntensityScale: 1,
  techLabelScale: 1,
  techLabelDistanceScale: 1,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundScale(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function semanticScaleProfileForCanvas(
  width: number | null | undefined,
  height: number | null | undefined,
  viewport: Viewport,
): SemanticConstellationScaleProfile {
  if (viewport === 'og') return DEFAULT_SEMANTIC_SCALE_PROFILE

  const safeWidth = Math.max(1, width ?? (viewport === 'mobile' ? 390 : 1440))
  const safeHeight = Math.max(1, height ?? (viewport === 'mobile' ? 844 : 900))

  if (viewport === 'desktop') {
    const compactDesktop = clamp((1024 - safeWidth) / 256, 0, 1)
    if (compactDesktop <= 0) return DEFAULT_SEMANTIC_SCALE_PROFILE
    return {
      techCoreScale: roundScale(1 - compactDesktop * 0.06),
      techSpikeScale: roundScale(1 - compactDesktop * 0.1),
      techIntensityScale: roundScale(1 - compactDesktop * 0.015),
      techLabelScale: roundScale(1 - compactDesktop * 0.06),
      techLabelDistanceScale: roundScale(1 - compactDesktop * 0.04),
    }
  }

  const widthPressure = clamp((720 - safeWidth) / 360, 0, 1)
  const heightPressure = clamp((760 - safeHeight) / 300, 0, 1)
  const pressure = clamp(0.42 + widthPressure * 0.52 + heightPressure * 0.06, 0, 1)

  return {
    techCoreScale: roundScale(1 - pressure * 0.24),
    techSpikeScale: roundScale(1 - pressure * 0.38),
    techIntensityScale: roundScale(1 - pressure * 0.055),
    techLabelScale: roundScale(1 - pressure * 0.2),
    techLabelDistanceScale: roundScale(1 - pressure * 0.12),
  }
}
