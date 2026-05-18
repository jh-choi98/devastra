'use client'

import { useState, useEffect } from 'react'

export function SystemStatusBanner({
  id,
  message,
  severity: _severity,
}: {
  id: string
  message: string
  severity: 'info' | 'warning' | 'error'
}) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(`system_status_dismissed_${id}`)) {
      setDismissed(true)
    }
  }, [id])

  if (dismissed) return null

  const dismiss = () => {
    localStorage.setItem(`system_status_dismissed_${id}`, '1')
    setDismissed(true)
  }

  return (
    <div className="w-full flex items-center justify-between gap-4 bg-slate-800/90 backdrop-blur border-b border-slate-700 px-4 py-2.5 text-sm text-slate-200">
      <span>{message || 'Sync is delayed right now. Your constellation is safe.'}</span>
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
