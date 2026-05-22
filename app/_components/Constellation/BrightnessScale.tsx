'use client'

import { useId, useMemo, useState } from 'react'
import {
  BRIGHTNESS_SCALE_STOPS,
  countLitStars,
  type BrightnessDescriptor,
} from '@/features/constellation/render/magnitude'
import type { ConstellationData } from './types'

const SIGNAL_RANGES: Record<BrightnessDescriptor, string> = {
  faint: '5-9',
  emerging: '10-29',
  steady: '30-79',
  bright: '80-199',
  radiant: '200+',
}

const STAR_STYLES: Record<
  BrightnessDescriptor,
  {
    haloSize: number
    coreSize: number
    haloClass: string
    halo: string
    core: string
    spike?: {
      size: number
      className: string
    }
  }
> = {
  faint: {
    haloSize: 7,
    coreSize: 4,
    haloClass: 'blur-[1px]',
    halo: 'bg-blue-100/8',
    core: 'bg-slate-200/75 shadow-[0_0_5px_rgba(226,232,240,0.34)]',
  },
  emerging: {
    haloSize: 9,
    coreSize: 5,
    haloClass: 'blur-[0.5px]',
    halo: 'bg-blue-100/10',
    core: 'bg-blue-50/90 shadow-[0_0_7px_rgba(191,219,254,0.48)]',
  },
  steady: {
    haloSize: 20,
    coreSize: 7,
    haloClass: 'blur-[2px]',
    halo: 'bg-blue-100/22',
    core: 'bg-slate-50 shadow-[0_0_10px_rgba(219,234,254,0.58)]',
  },
  bright: {
    haloSize: 28,
    coreSize: 9,
    haloClass: 'blur-[2.5px]',
    halo: 'bg-blue-100/28',
    core: 'bg-white shadow-[0_0_14px_rgba(226,232,240,0.78)]',
  },
  radiant: {
    haloSize: 40,
    coreSize: 12,
    haloClass: 'blur-[3px]',
    halo: 'bg-amber-100/36',
    core: 'bg-amber-50 shadow-[0_0_22px_rgba(253,230,138,0.96)]',
    spike: {
      size: 40,
      className: 'bg-amber-100/56 shadow-[0_0_10px_rgba(253,230,138,0.54)]',
    },
  },
}

function StarSample({
  descriptor,
  variant = 'detail',
}: {
  descriptor: BrightnessDescriptor
  variant?: 'compact' | 'detail'
}) {
  const style = STAR_STYLES[descriptor]
  const scale = variant === 'compact' ? 0.72 : 1
  return (
    <span
      className={`relative grid shrink-0 place-items-center ${
        variant === 'compact' ? 'h-5 w-6' : 'h-8 w-8'
      }`}
      aria-hidden="true"
    >
      <span
        className={`absolute rounded-full ${style.haloClass} ${style.halo}`}
        style={{ height: style.haloSize * scale, width: style.haloSize * scale }}
      />
      {style.spike ? (
        <>
          <span
            className={`absolute h-px ${style.spike.className}`}
            style={{ width: style.spike.size * scale }}
          />
          <span
            className={`absolute w-px ${style.spike.className}`}
            style={{ height: style.spike.size * scale }}
          />
        </>
      ) : null}
      <span
        className={`relative rounded-full ${style.core}`}
        style={{ height: style.coreSize * scale, width: style.coreSize * scale }}
      />
    </span>
  )
}

export function BrightnessScale({ data }: { data: ConstellationData }) {
  const detailsId = useId()
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  const summary = useMemo(() => {
    return {
      litCount: countLitStars(data.landmarks),
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
        className={`bg-slate-950/86 absolute bottom-[calc(100%+0.6rem)] right-0 w-[min(19rem,calc(100vw-2rem))] rounded-md border border-slate-400/20 p-3 text-[11px] leading-4 text-slate-300 shadow-2xl shadow-black/35 backdrop-blur-md transition duration-200 sm:bottom-0 sm:right-[calc(100%+0.65rem)] sm:text-xs ${
          expanded
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-1 opacity-0'
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-100">Brightness</p>
          <p className="text-[10px] text-slate-500">signal</p>
        </div>

        <div className="space-y-1.5">
          {BRIGHTNESS_SCALE_STOPS.map((stop) => (
            <div
              key={stop.descriptor}
              className="grid grid-cols-[2rem_5.4rem_1fr] items-center gap-2"
            >
              <StarSample descriptor={stop.descriptor} />
              <span className="capitalize text-slate-200">{stop.descriptor}</span>
              <span className="justify-self-end font-mono text-[10px] text-slate-400">
                {SIGNAL_RANGES[stop.descriptor]}
              </span>
            </div>
          ))}
        </div>

        <div className="border-slate-500/14 mt-3 border-t pt-2">
          <p className="mb-1.5 text-[10px] text-slate-500">Signal added by matched activity</p>
          <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px] leading-3">
            <span className="border-slate-500/18 rounded border bg-slate-900/45 px-1.5 py-1 text-slate-300">
              commit +1
            </span>
            <span className="border-slate-500/18 rounded border bg-slate-900/45 px-1.5 py-1 text-slate-300">
              issue +2
            </span>
            <span className="border-slate-500/18 rounded border bg-slate-900/45 px-1.5 py-1 text-slate-300">
              PR +5
            </span>
          </div>
        </div>

        <p className="mt-2 text-[10px] leading-4 text-slate-500">
          If one activity matches multiple techs, its signal is split across those stars.
        </p>
        <p className="border-slate-500/14 mt-2 border-t pt-2 text-[10px] text-slate-500">
          {summary.litCount > 0 ? `${summary.litCount} stars lit` : 'No stars lit yet'}
        </p>
      </div>

      <button
        type="button"
        className="bg-slate-950/24 shadow-black/16 hover:border-slate-300/18 hover:bg-slate-950/42 group w-[84px] rounded-md border border-slate-500/10 px-1.5 py-1.5 shadow-lg backdrop-blur-[1px] transition focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-100/50 sm:w-[96px]"
        aria-label="Star brightness scale"
        aria-expanded={expanded}
        aria-describedby={expanded ? detailsId : undefined}
        onClick={() => setPinned((value) => !value)}
      >
        <span className="sr-only">Star brightness scale</span>
        <span className="mb-2 flex items-center text-[9px] font-medium text-slate-300 sm:text-[10px]">
          Brightness
        </span>
        <span className="space-y-0.5" aria-hidden="true">
          {BRIGHTNESS_SCALE_STOPS.map((stop) => (
            <span key={stop.descriptor} className="grid grid-cols-[1.5rem_1fr] items-center gap-2">
              <span className="grid h-5 w-6 place-items-center">
                <StarSample descriptor={stop.descriptor} variant="compact" />
              </span>
              <span className="text-slate-300/72 font-mono text-[9px] sm:text-[10px]">
                {stop.compactLabel}
              </span>
            </span>
          ))}
        </span>
      </button>
    </div>
  )
}
