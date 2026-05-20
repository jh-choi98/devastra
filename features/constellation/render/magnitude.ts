// SPDX-License-Identifier: MIT

export interface MagnitudeOutput {
  /** Core radius in viewBox units (1000x700 space). */
  coreRadius: number
  /** Intensity multiplier for shader-local glow and optional postprocessing. */
  intensity: number
  /** Whether to draw a visible diffraction spike (top-N brightest). */
  showSpikes: boolean
  /** Spike length in viewBox units, 0 if showSpikes is false. */
  spikeLength: number
}

export type BrightnessDescriptor = 'faint' | 'emerging' | 'steady' | 'bright' | 'radiant'

export type BrightnessScaleStop = {
  descriptor: BrightnessDescriptor
  minWeight: number
  compactLabel: string
}

export const DIFFRACTION_SPIKE_MIN_WEIGHT = 80

export const BRIGHTNESS_SCALE_STOPS: readonly BrightnessScaleStop[] = [
  { descriptor: 'radiant', minWeight: 200, compactLabel: '200+' },
  { descriptor: 'bright', minWeight: 80, compactLabel: '80' },
  { descriptor: 'steady', minWeight: 30, compactLabel: '30' },
  { descriptor: 'emerging', minWeight: 10, compactLabel: '10' },
  { descriptor: 'faint', minWeight: 5, compactLabel: '5' },
] as const

/**
 * Maps a landmark's weight to render parameters.
 *
 *   - weight 5  (just unlocked) -> coreRadius ~0.64, intensity 0.38, no spikes
 *   - weight 50 (typical lit)   -> coreRadius ~1.7, intensity 1.2, no spikes
 *   - weight 500 (heavy hitter) -> coreRadius ~3.3, intensity 1.9, spikes if bright+ and top-quintile
 *
 * The top-quintile decision needs the full landmark set; callers pre-compute
 * the quintile boundary and pass it via `topQuintileThreshold`.
 */
export function magnitudeFor(weight: number, topQuintileThreshold: number): MagnitudeOutput {
  // Logarithmic scale: weight 5 -> t=0, weight 500 -> t~1.
  const t = Math.min(1, Math.max(0, Math.log(weight / 5) / Math.log(100)))
  const sizeT = Math.pow(t, 1.35)
  const intensityT = Math.pow(t, 0.78)
  // Star cores stay small — the glow comes from shader-local halos/spikes,
  // not oversized icon-like cores.
  // Newly lit stars remain pinpoints; heavy hitters earn visibly larger halos
  // and diffraction spikes so brightness grades are readable at a glance.
  const coreRadius = 0.64 + sizeT * 2.65 // 0.64..3.29
  const intensity = 0.38 + intensityT * 1.55 // 0.38..1.93 (feeds shader-local glow)
  const showSpikes = weight >= DIFFRACTION_SPIKE_MIN_WEIGHT && weight >= topQuintileThreshold
  const spikeLength = showSpikes ? 5.5 + sizeT * 14.5 : 0 // 5.5..20
  return { coreRadius, intensity, showSpikes, spikeLength }
}

/** Computes the 80th-percentile weight of lit landmark weights. */
export function topQuintileThreshold(weightsOfLitStars: number[]): number {
  if (weightsOfLitStars.length === 0) return Infinity
  const sorted = [...weightsOfLitStars].sort((a, b) => a - b)
  const idx = Math.floor(sorted.length * 0.8)
  return sorted[Math.min(idx, sorted.length - 1)]
}

/** Maps a landmark weight to a human-readable brightness descriptor. */
export function brightnessDescriptor(weight: number): BrightnessDescriptor {
  return BRIGHTNESS_SCALE_STOPS.find((stop) => weight >= stop.minWeight)?.descriptor ?? 'faint'
}
