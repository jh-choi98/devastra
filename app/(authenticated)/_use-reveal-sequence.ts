'use client'

import { useEffect, useState } from 'react'
import type { SyncJobProgress, SyncJobUpdate } from '@/lib/realtime/use-realtime-map-data'

// Exported pure helpers for testability
export function computeRevealDuration(firstReveal: boolean): number {
  return firstReveal ? 45_000 : 3_000
}

export function formatSyncProgressText(
  progress: SyncJobProgress | null,
  status: string | null,
): string | null {
  if (status !== 'running') return null
  if (!progress) return 'Syncing...'
  const { repos_analyzed, total, current_step } = progress
  if (current_step) return current_step
  if (total > 0) return `${repos_analyzed}/${total} repos analyzed...`
  return 'Syncing...'
}

export function useRevealSequence(opts: {
  firstReveal: boolean
  syncJobUpdate: SyncJobUpdate | null
}): {
  revealComplete: boolean
  syncProgressText: string | null
} {
  const { firstReveal, syncJobUpdate } = opts
  const [revealComplete, setRevealComplete] = useState(false)

  useEffect(() => {
    const duration = computeRevealDuration(firstReveal)
    const timer = setTimeout(() => setRevealComplete(true), duration)
    return () => clearTimeout(timer)
  }, [firstReveal])

  const syncProgressText = formatSyncProgressText(
    syncJobUpdate?.progress ?? null,
    syncJobUpdate?.status ?? null,
  )

  return { revealComplete, syncProgressText }
}
