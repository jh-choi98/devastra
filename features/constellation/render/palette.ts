// SPDX-License-Identifier: MIT
import type { SpectralColor } from './types'

function cyrb53(str: string): number {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

const SPECTRAL_HEX: Record<SpectralColor, string> = {
  'white':        '#f0f4ff',
  'blue-white':   '#a8c4ff',
  'yellow-white': '#fff2c4',
  'orange':       '#ffb070',
  'red':          '#ff7050',
}

/**
 * Palette distribution targets (ADR-61):
 *   70% white, 20% blue-white, 7% yellow-white, 2% orange, 1% red.
 * Uses cyrb53 hash mod 100 for deterministic bucket assignment.
 */
export function spectralColorFor(tech_key: string): SpectralColor {
  const bucket = Math.abs(cyrb53(tech_key)) % 100
  if (bucket < 70) return 'white'
  if (bucket < 90) return 'blue-white'
  if (bucket < 97) return 'yellow-white'
  if (bucket < 99) return 'orange'
  return 'red'
}

export function spectralHex(color: SpectralColor): string {
  return SPECTRAL_HEX[color]
}
