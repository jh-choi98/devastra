'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { toggleEmailRecap } from '../_actions'

interface EmailRecapSectionProps {
  initial: boolean
}

export function EmailRecapSection({ initial }: EmailRecapSectionProps) {
  const [enabled, setEnabled] = useState(initial)
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const next = !enabled
    setEnabled(next)
    startTransition(async () => {
      try {
        await toggleEmailRecap({ next })
        toast.success(next ? 'Weekly recap emails enabled.' : 'Weekly recap emails disabled.')
      } catch (err) {
        setEnabled(!next)
        toast.error(err instanceof Error ? err.message : 'Failed to update email preference.')
      }
    })
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Weekly recap email</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Receive a weekly summary of your DevAstra activity every Sunday.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
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
    </div>
  )
}
