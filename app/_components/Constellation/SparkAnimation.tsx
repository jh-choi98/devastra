'use client'
import { type Variants } from 'framer-motion'

// Spark sequence: small dot (scale 0.2) → plus-shape flash (scale 1.5 for 100ms) → settle (scale 1).
export const SPARK_VARIANTS: Variants = {
  initial: { scale: 0.2, opacity: 0 },
  flash:   { scale: 1.5, opacity: 1, transition: { duration: 0.15, ease: 'easeOut' } },
  settle:  { scale: 1.0, opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
}

export function useReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
