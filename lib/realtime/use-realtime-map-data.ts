'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@/lib/auth/supabase-browser'
import type { ConstellationData } from '@/app/_components/Constellation/Constellation'
import type { TerritoryType } from '@/features/territories/registry'

export type SyncJobProgress = {
  repos_analyzed: number
  total: number
  current_step: string
}

export type SyncJobUpdate = {
  id: string
  kind: 'initial' | 'incremental' | 'manual' | 'backfill' | string
  status: string
  progress: SyncJobProgress | null
  startedAt?: string | null
  createdAt: string | null
}

export function isLatestSyncJobUpdate(
  current: SyncJobUpdate | null,
  incoming: SyncJobUpdate,
): boolean {
  if (!current) return true
  if (incoming.id && incoming.id === current.id) return true
  if (!incoming.createdAt || !current.createdAt) return true
  return new Date(incoming.createdAt).getTime() >= new Date(current.createdAt).getTime()
}

// Exported pure helpers for testability
export function mergeTerritoryUpdate(
  territories: ConstellationData['territories'],
  row: Record<string, unknown>,
): ConstellationData['territories'] {
  const incoming = {
    type: String(row['type'] ?? '') as TerritoryType,
    stage: Number(row['stage'] ?? 1),
    totalWeight: Number(row['total_weight'] ?? 0),
    growth30d: Number(row['growth_30d'] ?? 0),
    stageChangedAt: row['stage_changed_at'] ? String(row['stage_changed_at']) : null,
  }
  const existing = territories.find((t) => t.type === incoming.type)
  if (existing) {
    return territories.map((t) => (t.type === incoming.type ? incoming : t))
  }
  return [...territories, incoming]
}

export function mergeLandmarkUpdate(
  landmarks: ConstellationData['landmarks'],
  row: Record<string, unknown>,
): ConstellationData['landmarks'] {
  const incoming = {
    tech_key: String(row['tech_key'] ?? ''),
    territory: String(row['territory_type'] ?? '') as TerritoryType,
    weight: Number(row['weight'] ?? 0),
    firstUnlockedAt: row['first_unlocked_at'] ? String(row['first_unlocked_at']) : null,
  }
  const existing = landmarks.find((l) => l.tech_key === incoming.tech_key)
  if (existing) {
    return landmarks.map((l) => (l.tech_key === incoming.tech_key ? incoming : l))
  }
  return [...landmarks, incoming]
}

export function removeLandmark(
  landmarks: ConstellationData['landmarks'],
  row: Record<string, unknown>,
): ConstellationData['landmarks'] {
  const techKey = String(row['tech_key'] ?? '')
  if (!techKey) return landmarks
  return landmarks.filter((landmark) => landmark.tech_key !== techKey)
}

export function useRealtimeMapData(
  userId: string,
  initial: ConstellationData,
  onSyncJobUpdate?: (update: SyncJobUpdate) => void,
): ConstellationData {
  const [data, setData] = useState<ConstellationData>(initial)
  const onSyncJobUpdateRef = useRef(onSyncJobUpdate)
  useEffect(() => {
    onSyncJobUpdateRef.current = onSyncJobUpdate
  })

  useEffect(() => {
    setData(initial)
  }, [initial, userId])

  useEffect(() => {
    const supabase = createBrowserClient()

    const channel = supabase
      .channel(`map:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'territories',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!payload.new || typeof payload.new !== 'object') return
          setData((prev) => ({
            ...prev,
            territories: mergeTerritoryUpdate(
              prev.territories,
              payload.new as Record<string, unknown>,
            ),
          }))
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'landmarks',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            if (!payload.old || typeof payload.old !== 'object') return
            setData((prev) => ({
              ...prev,
              landmarks: removeLandmark(prev.landmarks, payload.old as Record<string, unknown>),
            }))
            return
          }
          if (!payload.new || typeof payload.new !== 'object') return
          setData((prev) => ({
            ...prev,
            landmarks: mergeLandmarkUpdate(prev.landmarks, payload.new as Record<string, unknown>),
          }))
        },
      )
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
          const id = String(row['id'] ?? '')
          const kind = String(row['kind'] ?? '')
          const status = String(row['status'] ?? '')
          const startedAt = row['started_at'] ? String(row['started_at']) : null
          const createdAt = row['created_at'] ? String(row['created_at']) : null
          const rawProgress = row['progress']
          const progress =
            rawProgress && typeof rawProgress === 'object' && !Array.isArray(rawProgress)
              ? (rawProgress as SyncJobProgress)
              : null
          onSyncJobUpdateRef.current?.({ id, kind, status, progress, startedAt, createdAt })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  return data
}
