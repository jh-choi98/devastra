'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setEmailRecapEnabled } from '../_actions'

interface EmailRecapSectionProps {
  initialEnabled: boolean
  nextRecapDate: string
}

export function EmailRecapSection({ initialEnabled, nextRecapDate }: EmailRecapSectionProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const next = !enabled
    setEnabled(next)
    startTransition(async () => {
      try {
        await setEmailRecapEnabled(next)
        toast(`Weekly recap ${next ? 'enabled' : 'disabled'}`)
      } catch {
        setEnabled(!next)
        toast.error('Failed to update email preference.')
      }
    })
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
        Email recap
      </h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-300">Weekly recap email</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Sundays. Skipped after 2 quiet weeks. Next recap: {nextRecapDate}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
            enabled ? 'bg-indigo-600' : 'bg-zinc-600'
          } disabled:opacity-50`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </section>
  )
}
