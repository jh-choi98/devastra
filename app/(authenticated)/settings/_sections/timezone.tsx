'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { changeTimezone } from '../_actions'

interface TimezoneSectionProps {
  initial: string
}

export function TimezoneSection({ initial }: TimezoneSectionProps) {
  const [timezone, setTimezone] = useState(initial)
  const [isPending, startTransition] = useTransition()

  const timezones = Intl.supportedValuesOf('timeZone')

  function handleSave() {
    startTransition(async () => {
      try {
        await changeTimezone({ timezone })
        toast.success('Timezone updated.')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update timezone.')
      }
    })
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 mb-4">
      <h2 className="text-base font-semibold text-white mb-1">Timezone</h2>
      <p className="text-sm text-zinc-400 mb-4">
        Affects weekly recap email delivery time. Data is always stored in UTC.
      </p>
      <div className="flex gap-3">
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="flex-1 rounded-lg bg-zinc-800 border border-zinc-600 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || timezone === initial}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  )
}
