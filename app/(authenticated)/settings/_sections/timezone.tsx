'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setTimezone } from '../_actions'

interface TimezoneSectionProps {
  initialTimezone: string
  initialPreviewLine: string
  timezones: string[]
}

export function TimezoneSection({
  initialTimezone,
  initialPreviewLine,
  timezones,
}: TimezoneSectionProps) {
  const [timezone, setTz] = useState(initialTimezone)
  const [previewLine, setPreviewLine] = useState(initialPreviewLine)
  const [isPending, startTransition] = useTransition()

  function handleChange(tz: string) {
    setTz(tz)
    // Compute preview line client-side
    try {
      const sunday = new Date()
      sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7 || 7))
      sunday.setHours(18, 0, 0, 0)
      const formatted = sunday.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: tz,
      })
      setPreviewLine(`Your weekly recap arrives Sunday at ${formatted} in this timezone.`)
    } catch {
      setPreviewLine('Your weekly recap arrives Sunday in this timezone.')
    }
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
      <select
        value={timezone}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {timezones.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-zinc-500">{previewLine}</p>
    </section>
  )
}
