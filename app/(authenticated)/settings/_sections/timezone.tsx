'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setTimezone } from '../_actions'

interface TimezoneSectionProps {
  initialTimezone: string
  initialPreviewLine: string
}

export function TimezoneSection({ initialTimezone, initialPreviewLine }: TimezoneSectionProps) {
  const [timezone, setTz] = useState(initialTimezone)
  const [previewLine, setPreviewLine] = useState(initialPreviewLine)
  const [isPending, startTransition] = useTransition()

  const timezones = Intl.supportedValuesOf('timeZone')

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
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Timezone</h2>
      <select
        value={timezone}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="w-full rounded-lg bg-zinc-800 border border-zinc-600 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {timezones.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>
      <p className="text-xs text-zinc-500 mt-2">{previewLine}</p>
    </section>
  )
}
