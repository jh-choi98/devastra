'use client'

import { useState, useEffect } from 'react'

export function WelcomeBackStrip(props: {
  diffSummary: {
    new_stars_count: number
    expanded_clusters: string[]
  }
  /** ISO string of the previous lastLoginAt, used to scope dismiss per-visit. */
  lastLoginIso: string
  onDismiss: () => void
}): JSX.Element {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const key = `welcome_back_dismissed_${props.lastLoginIso}`
    if (typeof window !== 'undefined' && localStorage.getItem(key)) {
      setDismissed(true)
    }
  }, [props.lastLoginIso])

  if (dismissed) return null as unknown as JSX.Element

  const dismiss = () => {
    localStorage.setItem(`welcome_back_dismissed_${props.lastLoginIso}`, '1')
    setDismissed(true)
    props.onDismiss()
  }

  const parts: string[] = []
  if (props.diffSummary.new_stars_count > 0) {
    parts.push(`${props.diffSummary.new_stars_count} stars lit`)
  }
  for (const cluster of props.diffSummary.expanded_clusters) {
    parts.push(`${cluster} expanded`)
  }
  const subLine = parts.length > 0 ? `Since your last visit: ${parts.join(' · ')}` : null

  return (
    <div className="w-full flex items-center justify-between gap-4 bg-slate-800/90 backdrop-blur border-b border-slate-700 px-4 py-2.5 text-sm text-slate-200">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span>Welcome back — your constellation has new activity</span>
        {subLine && <span className="text-slate-400 text-xs truncate">{subLine}</span>}
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-slate-400 hover:text-slate-200 transition-colors text-lg leading-none ml-2 flex-shrink-0"
      >
        ×
      </button>
    </div>
  )
}
