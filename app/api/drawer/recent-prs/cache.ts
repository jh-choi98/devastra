import 'server-only'
import type { RecentPR } from '@/lib/github/graphql'

export type RecentPRsResponse = { prs: RecentPR[] }

export const RECENT_PRS_ROUTE_CACHE_TTL_MS = 5 * 60_000
const RECENT_PRS_ROUTE_CACHE_MAX_ENTRIES = 128

// Instance-local only: PR titles stay ephemeral and are never persisted.
const recentPRsRouteCache = new Map<string, { data: RecentPRsResponse; expiresAt: number }>()

function recentPRsRouteCacheKey(userId: string, cluster: string): string {
  return `${userId}:${cluster}`
}

function pruneRecentPRsRouteCache(now: number): void {
  for (const [key, value] of Array.from(recentPRsRouteCache.entries())) {
    if (value.expiresAt <= now) recentPRsRouteCache.delete(key)
  }

  while (recentPRsRouteCache.size >= RECENT_PRS_ROUTE_CACHE_MAX_ENTRIES) {
    const oldestKey = recentPRsRouteCache.keys().next().value
    if (!oldestKey) return
    recentPRsRouteCache.delete(oldestKey)
  }
}

export function getCachedRecentPRsResponse(
  userId: string,
  cluster: string,
): RecentPRsResponse | undefined {
  const now = Date.now()
  const key = recentPRsRouteCacheKey(userId, cluster)
  const cached = recentPRsRouteCache.get(key)
  if (!cached) return undefined
  if (cached.expiresAt <= now) {
    recentPRsRouteCache.delete(key)
    return undefined
  }
  return cached.data
}

export function setCachedRecentPRsResponse(
  userId: string,
  cluster: string,
  data: RecentPRsResponse,
): void {
  const now = Date.now()
  pruneRecentPRsRouteCache(now)

  const key = recentPRsRouteCacheKey(userId, cluster)
  recentPRsRouteCache.delete(key)
  recentPRsRouteCache.set(key, {
    data,
    expiresAt: now + RECENT_PRS_ROUTE_CACHE_TTL_MS,
  })
}

export function clearRecentPRsRouteCacheForTest(): void {
  recentPRsRouteCache.clear()
}
