'use client'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import type { CinematicMode } from '../state'

export interface FirstEverCinematicProps {
  /** Newly-lit landmarks from this sync. Used to build strip copy. */
  firstStarLandmarks: Array<{ tech_key: string; displayName: string }>
  /** Called when the 8-second sequence completes. Clears the server flag. */
  onComplete: () => void
  /** Optional — parent can forward cinematic mode to the canvas context. */
  onStartCinematic?: (mode: CinematicMode) => void
}

// Sequence phases (seconds)
const PHASE_OUTLINES  = 0.5
const PHASE_SPARKS    = 3.5
const PHASE_COPY      = 6.0
const PHASE_HEADLINE  = 7.5
const PHASE_END       = 8.0

function buildCopyLine(landmarks: Array<{ tech_key: string; displayName: string }>): string {
  if (landmarks.length === 0) return 'Your first star lit'
  if (landmarks.length === 1) return `Your first star lit: ${landmarks[0].displayName}`
  const names = landmarks.slice(0, 3).map(l => l.displayName).join(', ')
  return `Your first stars: ${names}`
}

export function FirstEverCinematic({
  firstStarLandmarks,
  onComplete,
  onStartCinematic,
}: FirstEverCinematicProps) {
  const reducedMotion = useReducedMotion()
  const completedRef = useRef(false)
  const [phase, setPhase] = useState(0)  // 0=outlines 1=sparks 2=copy 3=headline 4=done

  useEffect(() => {
    onStartCinematic?.('first-ever')

    if (reducedMotion) {
      // Snap to final state immediately
      const t = setTimeout(() => {
        if (completedRef.current) return
        completedRef.current = true
        onStartCinematic?.('idle')
        onComplete()
      }, 200)
      return () => clearTimeout(t)
    }

    // Phase timers — cannot be dismissed (ADR-38 / screens.md §I.2)
    const timers = [
      setTimeout(() => setPhase(1), PHASE_OUTLINES * 1000),
      setTimeout(() => setPhase(2), PHASE_SPARKS  * 1000),
      setTimeout(() => setPhase(3), PHASE_COPY    * 1000),
      setTimeout(() => setPhase(4), PHASE_HEADLINE * 1000),
      setTimeout(() => {
        if (completedRef.current) return
        completedRef.current = true
        onStartCinematic?.('idle')
        onComplete()
      }, PHASE_END * 1000),
    ]
    return () => timers.forEach(clearTimeout)
  // onComplete is stable (useCallback in parent); onStartCinematic is stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion])

  if (phase >= 4) return null

  const copyLine = buildCopyLine(firstStarLandmarks)

  return (
    <div
      className="fixed inset-x-0 bottom-12 flex flex-col items-center gap-2 pointer-events-none z-40"
      aria-live="polite"
    >
      {phase >= 2 && (
        <p className="text-slate-100 text-sm animate-fade-in">
          {copyLine}
        </p>
      )}
      {phase >= 3 && (
        <p className="text-slate-300 text-xs animate-fade-in">
          Your constellation has begun
        </p>
      )}
    </div>
  )
}
