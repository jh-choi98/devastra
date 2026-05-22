'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setTimezone } from '../_actions'
import { getTimezonePreviewLine } from '../_timezones'

interface TimezoneSectionProps {
  initialTimezone: string
  initialPreviewLine: string
  timezones: string[]
  emailRecapsEnabled?: boolean
}

export function TimezoneSection({
  initialTimezone,
  initialPreviewLine,
  timezones,
  emailRecapsEnabled = true,
}: TimezoneSectionProps) {
  const [timezone, setTz] = useState(initialTimezone)
  const [previewLine, setPreviewLine] = useState(initialPreviewLine)
  const [isPending, startTransition] = useTransition()

  function handleChange(tz: string) {
    setTz(tz)
    setPreviewLine(getTimezonePreviewLine(tz, { emailRecapsEnabled }))
    startTransition(async () => {
      try {
        await setTimezone(tz)
        toast('Timezone updated')
      } catch {
        setTz(initialTimezone)
        toast.error('Failed to update timezone.')
      }
    })
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Timezone</h2>
      <div className="relative">
        <select
          value={timezone}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isPending}
          className="w-full appearance-none rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 pr-11 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </div>
      <p className="mt-2 text-xs text-zinc-500">{previewLine}</p>
    </section>
  )
}
