'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createBrowserClient } from '@/lib/auth/supabase-browser'

const COOLDOWN_MS = 5 * 60 * 1000

type RefreshResponse =
  | { status: 'queued'; jobId: string }
  | { status: 'github_disconnected' }
  | { status: 'dispatch_failed' }
  | { status: 'cooldown'; cooldownUntil: string; retryAfterSeconds: number }
  | {
      status: 'already_syncing'
      jobId: string
      kind: string
      jobStatus: string
      startedAt: string | null
    }

type LatestSyncJobResponse = {
  id: string
  kind: string
  status: string
  startedAt: string | null
} | null

export type SyncState = 'idle' | 'pending' | 'running'

export function shouldPollLatestSyncJob(
  syncState: SyncState,
  activeSyncKind: string | null,
): boolean {
  if (syncState === 'idle') return false
  return activeSyncKind !== 'initial' && activeSyncKind !== 'backfill'
}

async function readRefreshResponse(response: Response): Promise<RefreshResponse | null> {
  try {
    return (await response.json()) as RefreshResponse
  } catch {
    return null
  }
}

export function RefreshButton({
  userId,
  lastSyncStartedAt,
  initialSyncKind = null,
  initialSyncing = false,
}: {
  userId: string
  lastSyncStartedAt: Date | null
  initialSyncKind?: string | null
  initialSyncing?: boolean
}) {
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(() => {
    if (!lastSyncStartedAt) return null
    const until = new Date(lastSyncStartedAt.getTime() + COOLDOWN_MS)
    return until > new Date() ? until : null
  })
  const [syncState, setSyncState] = useState<SyncState>(initialSyncing ? 'running' : 'idle')
  const [activeSyncKind, setActiveSyncKind] = useState<string | null>(
    initialSyncing ? initialSyncKind : null,
  )
  const [, setTick] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const applySyncJobState = useCallback((row: {
    kind?: string | null
    status: string
    startedAt?: string | null
  }) => {
    if (row.status === 'pending') {
      setSyncState('pending')
      if (row.kind !== undefined) setActiveSyncKind(row.kind)
      return
    }

    if (row.status === 'running') {
      setSyncState('running')
      if (row.kind !== undefined) setActiveSyncKind(row.kind)
      return
    }

    if (row.status === 'completed' || row.status === 'failed') {
      setSyncState('idle')
      setActiveSyncKind(null)
      if (row.startedAt) {
        const until = new Date(new Date(row.startedAt).getTime() + COOLDOWN_MS)
        if (until > new Date()) setCooldownUntil(until)
      }
    }
  }, [])

  useEffect(() => {
    if (!cooldownUntil) return
    intervalRef.current = setInterval(() => {
      if (new Date() >= cooldownUntil) {
        setCooldownUntil(null)
        if (intervalRef.current) clearInterval(intervalRef.current)
      } else {
        setTick((t) => t + 1)
      }
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [cooldownUntil])

  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`refresh-btn:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_jobs',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!payload.new || typeof payload.new !== 'object') return
          const row = payload.new as Record<string, unknown>
          const status = String(row['status'] ?? '')
          const kind = row['kind'] ? String(row['kind']) : null
          const startedAt = row['started_at'] ? String(row['started_at']) : null
          applySyncJobState({ kind, status, startedAt })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [applySyncJobState, userId])

  useEffect(() => {
    if (!shouldPollLatestSyncJob(syncState, activeSyncKind)) return

    let cancelled = false
    const poll = async () => {
      try {
        const response = await fetch('/api/sync/latest-job', { cache: 'no-store' })
        if (!response.ok) return
        const latest = (await response.json()) as LatestSyncJobResponse
        if (cancelled) return
        if (latest) applySyncJobState(latest)
        else setSyncState('idle')
      } catch {
        // Realtime is the primary path; polling only prevents a stale loading state.
      }
    }

    const firstPollTimer = setTimeout(poll, 5_000)
    const pollTimer = setInterval(poll, 10_000)
    return () => {
      cancelled = true
      clearTimeout(firstPollTimer)
      clearInterval(pollTimer)
    }
  }, [activeSyncKind, applySyncJobState, syncState])

  const cooldownRemaining = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil.getTime() - Date.now()) / 1000))
    : 0

  const disabled = syncState !== 'idle' || cooldownRemaining > 0

  async function handleClick() {
    if (disabled) return

    try {
      const res = await fetch('/api/refresh', { method: 'POST' })
      const payload = await readRefreshResponse(res)

      if (res.ok && payload?.status === 'queued') {
        setSyncState('pending')
        setActiveSyncKind('manual')
        setCooldownUntil(new Date(Date.now() + COOLDOWN_MS))
        return
      }

      if (res.status === 409 && payload?.status === 'already_syncing') {
        setSyncState(payload.jobStatus === 'pending' ? 'pending' : 'running')
        setActiveSyncKind(payload.kind)
        return
      }

      if (res.status === 429 && payload?.status === 'cooldown') {
        setSyncState('idle')
        setActiveSyncKind(null)
        setCooldownUntil(new Date(payload.cooldownUntil))
      }
    } catch {
      // network error; user can retry
    }
  }

  let label = 'Refresh'
  if (syncState === 'pending') label = 'Queued...'
  else if (syncState === 'running') label = 'Syncing...'
  else if (cooldownRemaining > 0) {
    const mins = Math.ceil(cooldownRemaining / 60)
    label = `Refresh (${mins}m)`
  }

  return (
    <button
      data-testid="refresh-button"
      onClick={handleClick}
      disabled={disabled}
      className="rounded bg-slate-700/70 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-600/80 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
}
