// SPDX-License-Identifier: MIT

export interface MagnitudeOutput {
  /** Core radius in viewBox units (1000x700 space). */
  coreRadius: number
  /** HDR-friendly intensity multiplier for the bloom pass. >1 means it will bloom. */
  intensity: number
  /** Whether to draw a visible diffraction spike (top-N brightest). */
  showSpikes: boolean
  /** Spike length in viewBox units, 0 if showSpikes is false. */
  spikeLength: number
}

/**
 * Maps a landmark's weight to render parameters.
 *
 *   - weight 5  (just unlocked) → coreRadius ~2, intensity 1.0, no spikes
 *   - weight 50 (typical lit)   → coreRadius ~4, intensity 1.5, no spikes
 *   - weight 500 (heavy hitter) → coreRadius ~6, intensity 1.8, spikes if top-quintile
 *
 * The top-quintile decision needs the full landmark set; callers pre-compute
 * the quintile boundary and pass it via `topQuintileThreshold`.
 */
export function magnitudeFor(weight: number, topQuintileThreshold: number): MagnitudeOutput {
  // Logarithmic scale: weight 5 → t=0, weight 500 → t≈1
  const t = Math.min(1, Math.max(0, Math.log(weight / 5) / Math.log(100)))
  const coreRadius = 2 + t * 4        // 2..6
  const intensity = 1.0 + t * 0.8    // 1.0..1.8
  const showSpikes = weight >= topQuintileThreshold
  const spikeLength = showSpikes ? 8 + t * 16 : 0
  return { coreRadius, intensity, showSpikes, spikeLength }
}

/** Computes the 80th-percentile weight of lit landmark weights. */
export function topQuintileThreshold(weightsOfLitStars: number[]): number {
  if (weightsOfLitStars.length === 0) return Infinity
  const sorted = [...weightsOfLitStars].sort((a, b) => a - b)
  const idx = Math.floor(sorted.length * 0.8)
  return sorted[Math.min(idx, sorted.length - 1)]
}

/** Maps a landmark weight to a human-readable brightness descriptor (5-quintile scale). */
export function brightnessDescriptor(weight: number): string {
  if (weight >= 200) return 'brightest'
  if (weight >= 80) return 'bright'
  if (weight >= 30) return 'mid'
  if (weight >= 10) return 'dim'
  return 'very dim'
}
