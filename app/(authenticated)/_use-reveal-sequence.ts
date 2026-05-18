'use client'

import { useEffect, useState } from 'react'
import type { SyncJobProgress, SyncJobUpdate } from '@/lib/realtime/use-realtime-map-data'

type BuildStatusCopy = {
  title: string
  body: string
  detail: string
}

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

export function isBlockingBuildJob(syncJobUpdate: SyncJobUpdate | null): boolean {
  if (!syncJobUpdate) return false
  if (syncJobUpdate.status !== 'pending' && syncJobUpdate.status !== 'running') return false
  return syncJobUpdate.kind === 'initial' || syncJobUpdate.kind === 'backfill'
}

export function getBuildStatusCopy(syncJobUpdate: SyncJobUpdate | null): BuildStatusCopy | null {
  if (!isBlockingBuildJob(syncJobUpdate)) return null

  const isInitial = syncJobUpdate?.kind === 'initial'
  const currentStep = syncJobUpdate?.progress?.current_step?.trim()
  const fallbackDetail =
    syncJobUpdate?.status === 'pending'
      ? 'Waiting for the build to begin...'
      : 'Reading your selected repositories...'

  return {
    title: isInitial ? 'Building your constellation' : 'Updating your constellation',
    body: isInitial
      ? 'Your selected repositories are being analyzed. Stars and connections will settle in as the first build becomes ready.'
      : 'Your repo choices are being applied. Stars and connections will redraw after saved activity and project manifests are checked.',
    detail: currentStep || fallbackDetail,
  }
}

export function useRevealSequence(opts: {
  firstReveal: boolean
  syncJobUpdate: SyncJobUpdate | null
  paused?: boolean
}): {
  revealComplete: boolean
  syncProgressText: string | null
} {
  const { firstReveal, syncJobUpdate, paused = false } = opts
  const [revealComplete, setRevealComplete] = useState(false)

  useEffect(() => {
    if (paused) return
    const duration = computeRevealDuration(firstReveal)
    const timer = setTimeout(() => setRevealComplete(true), duration)
    return () => clearTimeout(timer)
  }, [firstReveal, paused])

  const syncProgressText = formatSyncProgressText(
    syncJobUpdate?.progress ?? null,
    syncJobUpdate?.status ?? null,
  )

  return { revealComplete, syncProgressText }
}
