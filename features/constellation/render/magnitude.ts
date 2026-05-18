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

export type BrightnessDescriptor = 'very dim' | 'dim' | 'mid' | 'bright' | 'brightest'

export type BrightnessScaleStop = {
  descriptor: BrightnessDescriptor
  minWeight: number
  compactLabel: string
}

export const BRIGHTNESS_SCALE_STOPS: readonly BrightnessScaleStop[] = [
  { descriptor: 'brightest', minWeight: 200, compactLabel: '200+' },
  { descriptor: 'bright', minWeight: 80, compactLabel: '80' },
  { descriptor: 'mid', minWeight: 30, compactLabel: '30' },
  { descriptor: 'dim', minWeight: 10, compactLabel: '10' },
  { descriptor: 'very dim', minWeight: 5, compactLabel: '5' },
] as const

/**
 * Maps a landmark's weight to render parameters.
 *
 *   - weight 5  (just unlocked) -> coreRadius ~0.85, intensity 0.55, no spikes
 *   - weight 50 (typical lit)   -> coreRadius ~1.7, intensity 1.1, no spikes
 *   - weight 500 (heavy hitter) -> coreRadius ~2.8, intensity 1.6, spikes if top-quintile
 *
 * The top-quintile decision needs the full landmark set; callers pre-compute
 * the quintile boundary and pass it via `topQuintileThreshold`.
 */
export function magnitudeFor(weight: number, topQuintileThreshold: number): MagnitudeOutput {
  // Logarithmic scale: weight 5 -> t=0, weight 500 -> t~1.
  const t = Math.min(1, Math.max(0, Math.log(weight / 5) / Math.log(100)))
  const sizeT = Math.pow(t, 1.18)
  const intensityT = Math.pow(t, 0.9)
  // Star cores stay small — the glow comes from shader-local halos/spikes,
  // not oversized icon-like cores.
  // Newly lit stars remain pinpoints; heavy hitters earn visibly larger halos
  // and diffraction spikes so brightness grades are readable at a glance.
  const coreRadius = 0.86 + sizeT * 1.95 // 0.86..2.81
  const intensity = 0.54 + intensityT * 1.08 // 0.54..1.62 (feeds shader-local glow)
  const showSpikes = weight >= topQuintileThreshold
  const spikeLength = showSpikes ? 4.5 + sizeT * 11.5 : 0 // 4.5..16
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
  return BRIGHTNESS_SCALE_STOPS.find((stop) => weight >= stop.minWeight)?.descriptor ?? 'very dim'
}
