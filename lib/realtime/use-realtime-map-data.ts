'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@/lib/auth/supabase-browser'
import type { MapData } from '@/app/_components/Map/LivingMap'
import type { TerritoryType } from '@/features/territories/registry'

export type SyncJobProgress = {
  repos_analyzed: number
  total: number
  current_step: string
}

export type SyncJobUpdate = {
  status: string
  progress: SyncJobProgress | null
}

// Exported pure helpers for testability
export function mergeTerritoryUpdate(
  territories: MapData['territories'],
  row: Record<string, unknown>,
): MapData['territories'] {
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
  landmarks: MapData['landmarks'],
  row: Record<string, unknown>,
): MapData['landmarks'] {
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

export function useRealtimeMapData(
  userId: string,
  initial: MapData,
  onSyncJobUpdate?: (update: SyncJobUpdate) => void,
): MapData {
  const [data, setData] = useState<MapData>(initial)
  const onSyncJobUpdateRef = useRef(onSyncJobUpdate)
  useEffect(() => {
    onSyncJobUpdateRef.current = onSyncJobUpdate
  })

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
          if (!payload.new || typeof payload.new !== 'object') return
          setData((prev) => ({
            ...prev,
            landmarks: mergeLandmarkUpdate(
              prev.landmarks,
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
          table: 'sync_jobs',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!payload.new || typeof payload.new !== 'object') return
          const row = payload.new as Record<string, unknown>
          const status = String(row['status'] ?? '')
          const rawProgress = row['progress']
          const progress =
            rawProgress && typeof rawProgress === 'object' && !Array.isArray(rawProgress)
              ? (rawProgress as SyncJobProgress)
              : null
          onSyncJobUpdateRef.current?.({ status, progress })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  return data
}
