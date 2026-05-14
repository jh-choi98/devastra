'use client'
import { useEffect, useState } from 'react'

type PR = { number: number; title: string; repo: string; url: string; updated_at: string }

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
    fetch(`/api/drawer/recent-prs?cluster=${encodeURIComponent(props.cluster)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed'))))
      .then((data: { prs: PR[] }) => {
        if (!cancelled) {
          setPrs(data.prs)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load recent PRs')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [props.cluster])

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 rounded bg-slate-700/50 animate-pulse" />
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
          className="flex items-start gap-2 text-sm hover:bg-slate-700/40 rounded px-2 py-1 -mx-2 transition-colors group"
        >
          <span className="text-slate-500 shrink-0 mt-0.5">#{pr.number}</span>
          <span className="flex-1 text-slate-200 group-hover:text-white line-clamp-1">{pr.title}</span>
          <span className="text-slate-500 text-xs shrink-0 mt-0.5">{timeAgo(pr.updated_at)}</span>
        </a>
      ))}
      <a
        href={`https://github.com/pulls?q=is:pr+author:@me`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        See more on GitHub →
      </a>
    </div>
  )
}
