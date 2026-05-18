'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@/lib/auth/supabase-browser'

const COOLDOWN_MS = 5 * 60 * 1000

export function RefreshButton({
  userId,
  lastSyncStartedAt,
  initialSyncing = false,
}: {
  userId: string
  lastSyncStartedAt: Date | null
  initialSyncing?: boolean
}) {
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(() => {
    if (!lastSyncStartedAt) return null
    const until = new Date(lastSyncStartedAt.getTime() + COOLDOWN_MS)
    return until > new Date() ? until : null
  })
  const [syncing, setSyncing] = useState(initialSyncing)
  const [, setTick] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
          if (status === 'pending' || status === 'running') {
            setSyncing(true)
          } else if (status === 'completed' || status === 'failed') {
            setSyncing(false)
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  const cooldownRemaining = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil.getTime() - Date.now()) / 1000))
    : 0

  const disabled = syncing || cooldownRemaining > 0

  async function handleClick() {
    if (disabled) {
      if (cooldownRemaining > 0) {
        const mins = Math.ceil(cooldownRemaining / 60)
        alert(`Refresh available in ${mins} minute${mins !== 1 ? 's' : ''}`)
      }
      return
    }

    try {
      const res = await fetch('/api/refresh', { method: 'POST' })
      if (res.ok) {
        setSyncing(true)
        setCooldownUntil(new Date(Date.now() + COOLDOWN_MS))
      }
    } catch {
      // network error; user can retry
    }
  }

  let label = 'Refresh'
  if (syncing) label = 'Syncing...'
  else if (cooldownRemaining > 0) {
    const mins = Math.ceil(cooldownRemaining / 60)
    label = `Refresh (${mins}m)`
  }

  return (
    <button
      data-testid="refresh-button"
      onClick={handleClick}
      disabled={disabled}
      className="px-3 py-1.5 text-sm rounded bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  )
}
