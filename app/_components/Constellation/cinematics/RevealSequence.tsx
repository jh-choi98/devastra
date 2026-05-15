'use client'
import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import type { TerritoryType } from '@/features/territories/registry'
import type { CinematicMode } from '../state'

const CLUSTER_LABELS: Record<TerritoryType, string> = {
  frontend_land:      'Frontend',
  backend_fortress:   'Backend',
  data_pipeline_zone: 'Data',
  testing_lab:        'Testing',
  devops_harbor:      'DevOps',
  docs_library:       'Docs',
}

export interface RevealSequenceProps {
  totalCommits?: number
  totalRepos?: number
  litClusters?: TerritoryType[]
  /** Called after the 12s minimum reveal duration (or faster under reducedMotion). */
  onComplete: () => void
  /** Optional — parent can forward cinematic mode to the canvas context. */
  onStartCinematic?: (mode: CinematicMode) => void
}

// Minimum 12s, maximum 30s per screens.md Flow 1 step 6.
const MIN_DURATION_MS = 12_000
const MAX_DURATION_MS = 30_000

export function RevealSequence({
  totalCommits,
  totalRepos,
  litClusters = [],
  onComplete,
  onStartCinematic,
}: RevealSequenceProps) {
  const reducedMotion = useReducedMotion()
  const completedRef = useRef(false)

  useEffect(() => {
    onStartCinematic?.('reveal')

    const duration = reducedMotion ? 200 : MIN_DURATION_MS
    const maxGuard = reducedMotion ? 400 : MAX_DURATION_MS

    const minTimer = setTimeout(() => {
      if (completedRef.current) return
      completedRef.current = true
      onStartCinematic?.('idle')
      onComplete()
    }, duration)

    const maxTimer = setTimeout(() => {
      if (completedRef.current) return
      completedRef.current = true
      onStartCinematic?.('idle')
      onComplete()
    }, maxGuard)

    return () => {
      clearTimeout(minTimer)
      clearTimeout(maxTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion])

  const litLabel = litClusters.map(c => CLUSTER_LABELS[c]).join(' · ')

  return (
    <>
      {(totalCommits != null || totalRepos != null) && (
        <div className="fixed bottom-6 right-6 text-slate-300 text-sm pointer-events-none z-40">
          {totalCommits ?? '—'} commits analyzed in {totalRepos ?? '—'} repos
        </div>
      )}
      {litLabel && (
        <div className="fixed inset-x-0 bottom-12 flex justify-center pointer-events-none z-40">
          <p className="text-slate-100 text-sm">
            Lit: {litLabel}
          </p>
        </div>
      )}
    </>
  )
}
