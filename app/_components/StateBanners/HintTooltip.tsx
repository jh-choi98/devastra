'use client'

import { useEffect, useRef } from 'react'

export function HintTooltip(props: {
  target: 'cluster-label' | 'share-button' | 'cluster-recap-diff'
  text: string
  onDismiss: () => void
  /** Auto-dismiss timer in ms; 0 means stay until action. */
  autoDismissMs?: number
}): JSX.Element {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { autoDismissMs, onDismiss } = props

  useEffect(() => {
    if (autoDismissMs && autoDismissMs > 0) {
      timerRef.current = setTimeout(() => {
        onDismiss()
      }, autoDismissMs)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [autoDismissMs, onDismiss])

  return (
    <div
      className="absolute z-50 pointer-events-none"
      role="tooltip"
    >
      <div className="relative inline-flex flex-col items-start">
        <div className="bg-slate-700 text-slate-100 text-xs rounded px-3 py-2 shadow-lg max-w-xs whitespace-nowrap">
          {props.text}
        </div>
        <div className="w-2.5 h-2.5 bg-slate-700 rotate-45 -mt-1.5 ml-4" />
      </div>
    </div>
  )
}
