'use client'
import { useEffect, useState } from 'react'

type PR = { number: number; title: string; repo: string; url: string; updated_at: string }
type RecentPRsResponse = { prs: PR[] }

export const RECENT_PRS_CACHE_TTL_MS = 5 * 60_000

const recentPRsCache = new Map<
  string,
  { promise?: Promise<RecentPRsResponse>; data?: RecentPRsResponse; expiresAt?: number }
>()

function recentPRsCacheKey(userId: string, cluster: string): string {
  return `${userId}:${cluster}`
}

export function clearRecentPRsCacheForTest(): void {
  recentPRsCache.clear()
}

export function fetchRecentPRs(userId: string, cluster: string): Promise<RecentPRsResponse> {
  const key = recentPRsCacheKey(userId, cluster)
  const cached = recentPRsCache.get(key)
  const now = Date.now()

  if (cached?.data && cached.expiresAt && cached.expiresAt > now) {
    return Promise.resolve(cached.data)
  }

  if (cached?.promise) {
    return cached.promise
  }

  if (cached) {
    recentPRsCache.delete(key)
  }

  const request = fetch(`/api/drawer/recent-prs?cluster=${encodeURIComponent(cluster)}`, {
    cache: 'no-store',
  }).then((response) => {
    if (!response.ok) throw new Error('Failed')
    return response.json() as Promise<RecentPRsResponse>
  })

  const promise = request.then(
    (data) => {
      if (recentPRsCache.get(key)?.promise === promise) {
        recentPRsCache.set(key, {
          data,
          expiresAt: Date.now() + RECENT_PRS_CACHE_TTL_MS,
        })
      }
      return data
    },
    (error) => {
      if (recentPRsCache.get(key)?.promise === promise) {
        recentPRsCache.delete(key)
      }
      throw error
    },
  )

  recentPRsCache.set(key, { promise })
  return promise
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function RecentPRs(props: { userId: string; cluster: string }): JSX.Element {
  const [prs, setPrs] = useState<PR[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchRecentPRs(props.userId, props.cluster)
      .then((data) => {
        if (!cancelled) {
          setPrs(data.prs)
          setError(null)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrs(null)
          setError('Could not load recent PRs')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [props.userId, props.cluster])

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-slate-700/50" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-slate-500">{error}</p>
  }

  if (!prs || prs.length === 0) {
    return <p className="text-sm text-slate-500">No recent pull requests.</p>
  }

  return (
    <div className="space-y-2">
      {prs.map((pr) => (
        <a
          key={pr.url}
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group -mx-2 flex items-start gap-2 rounded px-2 py-1 text-sm transition-colors hover:bg-slate-700/40"
        >
          <span className="mt-0.5 shrink-0 text-slate-500">#{pr.number}</span>
          <span className="line-clamp-1 flex-1 text-slate-200 group-hover:text-white">
            {pr.title}
          </span>
          <span className="mt-0.5 shrink-0 text-xs text-slate-500">{timeAgo(pr.updated_at)}</span>
        </a>
      ))}
      <a
        href={`https://github.com/pulls?q=is:pr+author:@me`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-slate-500 transition-colors hover:text-slate-300"
      >
        See more on GitHub →
      </a>
    </div>
  )
}
