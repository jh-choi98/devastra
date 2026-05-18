'use client'

import { useId, useMemo, useState } from 'react'
import {
  BRIGHTNESS_SCALE_STOPS,
  topQuintileThreshold,
  type BrightnessScaleStop,
} from '@/features/constellation/render/magnitude'
import type { ConstellationData } from './types'

const SCALE_MIN = 5
const SCALE_MAX = 500

function formatSignal(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value >= 100) return Math.round(value).toString()
  if (value >= 10) return value.toFixed(value % 1 === 0 ? 0 : 1)
  return value.toFixed(value % 1 === 0 ? 0 : 1)
}

function stopTopPercent(stop: BrightnessScaleStop): number {
  const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, stop.minWeight))
  const t = Math.log(clamped / SCALE_MIN) / Math.log(SCALE_MAX / SCALE_MIN)
  return (1 - t) * 100
}

export function BrightnessScale({ data }: { data: ConstellationData }) {
  const detailsId = useId()
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  const summary = useMemo(() => {
    const weights = data.landmarks
      .filter((landmark) => landmark.firstUnlockedAt !== null && landmark.weight >= SCALE_MIN)
      .map((landmark) => landmark.weight)
    const strongest = weights.length > 0 ? Math.max(...weights) : null
    const spikeThreshold = topQuintileThreshold(weights)
    return {
      litCount: weights.length,
      strongest,
      spikeThreshold: Number.isFinite(spikeThreshold) ? spikeThreshold : null,
    }
  }, [data.landmarks])

  const expanded = pinned || hovered || focused

  return (
    <div
      className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-20 flex items-end gap-3 text-slate-200 sm:bottom-6 sm:right-6"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
    >
      <div
        id={detailsId}
        className={`bg-slate-950/82 absolute bottom-[calc(100%+0.75rem)] right-0 w-[min(18rem,calc(100vw-2rem))] rounded-md border border-slate-500/25 p-3 text-[11px] leading-5 text-slate-300 shadow-2xl shadow-black/30 backdrop-blur-md transition duration-200 sm:bottom-0 sm:right-[calc(100%+0.75rem)] sm:text-xs ${
          expanded
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-1 opacity-0'
        }`}
      >
        <p className="mb-2 text-sm font-medium text-slate-100">Star brightness</p>
        <p>
          A star lights at 5 signal. Brightness then follows a logarithmic curve, so early evidence
          is visible while heavy activity stays point-like.
        </p>
        <p className="mt-2">
          Signal comes from selected public repos: file paths, dependencies, and repo language.
          Commits add 1, issues add 2, and PRs add 5 before confidence is split across matches.
        </p>
        <p className="mt-2 text-slate-400">
          {summary.litCount > 0
            ? `Current range: ${summary.litCount} lit stars, strongest at ${formatSignal(summary.strongest ?? 0)} signal. Diffraction spikes mark the current top 20%${
                summary.spikeThreshold
                  ? `, from ${formatSignal(summary.spikeThreshold)} signal`
                  : ''
              }.`
            : 'No stars are lit yet. The scale will begin at 5 signal.'}
        </p>
      </div>

      <button
        type="button"
        className="bg-slate-950/38 hover:bg-slate-950/62 group flex h-[154px] w-[64px] items-end justify-center rounded-md border border-slate-500/20 px-1.5 py-2.5 shadow-lg shadow-black/20 backdrop-blur-[2px] transition hover:border-amber-200/35 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-100/70 sm:h-[190px] sm:w-[84px] sm:px-2 sm:py-3"
        aria-label="Star brightness scale"
        aria-expanded={expanded}
        aria-describedby={expanded ? detailsId : undefined}
        onClick={() => setPinned((value) => !value)}
      >
        <span className="sr-only">Star brightness scale</span>
        <span
          className="relative flex h-[132px] w-full items-stretch justify-center sm:h-[166px]"
          aria-hidden="true"
        >
          <span className="bg-amber-200/58 absolute bottom-0 left-1/2 h-[116px] w-px -translate-x-1/2 shadow-[0_0_8px_rgba(252,211,77,0.28)] sm:h-[150px]" />
          <span className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-amber-100 shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
          {BRIGHTNESS_SCALE_STOPS.map((stop) => {
            const y = stopTopPercent(stop)
            return (
              <span
                key={stop.descriptor}
                className="absolute left-0 right-0 flex items-center justify-end gap-1.5"
                style={{ top: `${y}%` }}
              >
                <span className="text-amber-100/72 min-w-6 text-right font-mono text-[9px] sm:min-w-8 sm:text-[10px]">
                  {stop.compactLabel}
                </span>
                <span className="bg-amber-100/56 h-px w-3 sm:w-4" />
              </span>
            )
          })}
        </span>
      </button>
    </div>
  )
}
