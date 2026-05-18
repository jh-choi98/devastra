'use client'

import { useState, useEffect } from 'react'

type Highlights = {
  stage_up?: { cluster_name: string; new_stars_count: number; brightened_count: number }
  new_stars?: number
  growth_pct?: { cluster_name: string; pct: number }
}

export function ThisWeekStrip(props: {
  highlights: Highlights
  /** ISO string of the week start, used to scope dismiss per-week. */
  weekStartIso: string
  onDismiss: () => void
}): JSX.Element {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const key = `this_week_dismissed_${props.weekStartIso}`
    if (typeof window !== 'undefined' && localStorage.getItem(key)) {
      setDismissed(true)
    }
  }, [props.weekStartIso])

  if (dismissed) return null as unknown as JSX.Element

  const dismiss = () => {
    localStorage.setItem(`this_week_dismissed_${props.weekStartIso}`, '1')
    setDismissed(true)
    props.onDismiss()
  }

  const h = props.highlights
  let copy: string

  if (h.stage_up) {
    copy = `${h.stage_up.cluster_name} cluster expanded · ${h.stage_up.brightened_count} stars brightened`
  } else {
    const parts: string[] = []
    if (h.new_stars != null && h.new_stars > 0) parts.push(`${h.new_stars} new stars`)
    if (h.growth_pct) parts.push(`${h.growth_pct.cluster_name} +${h.growth_pct.pct}%`)
    copy =
      parts.length > 0
        ? `This week: ${parts.join(' · ')}`
        : 'This week: updates to your constellation'
  }

  return (
    <div className="w-full flex items-center justify-between gap-4 bg-slate-800/90 backdrop-blur border-b border-slate-700 px-4 py-2.5 text-sm text-slate-200">
      <span>{copy}</span>
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
