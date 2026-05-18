'use client'
import { useEffect, useState } from 'react'
import { brightnessDescriptor } from '@/features/constellation/render/magnitude'
import { getPublicTech } from '@/features/territories/tech-catalog-public'
import { useConstellationState } from '../state'
import type { ConstellationData } from '../types'

interface TooltipState {
  tech_key: string
  x: number
  y: number
}

interface TooltipHostProps {
  data: ConstellationData
}

function techDisplayName(tech_key: string): string {
  return getPublicTech(tech_key)?.displayName ?? tech_key
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function TooltipHost({ data }: TooltipHostProps) {
  const [tip, setTip] = useState<TooltipState | null>(null)
  const { selected } = useConstellationState()

  useEffect(() => {
    const onStarHover = (e: Event) => {
      setTip((e as CustomEvent<TooltipState | null>).detail)
    }
    window.addEventListener('constellation:star-hover', onStarHover)
    return () => window.removeEventListener('constellation:star-hover', onStarHover)
  }, [])

  useEffect(() => {
    if (selected) setTip(null)
  }, [selected])

  if (!tip || selected) return null

  const landmark = data.landmarks.find(l => l.tech_key === tip.tech_key)
  if (!landmark) return null

  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: tip.x + 14,
        top: tip.y - 32,
        zIndex: 50,
        pointerEvents: 'none',
      }}
      className="bg-slate-900/95 text-slate-100 text-xs px-3 py-1.5 rounded shadow-lg whitespace-nowrap"
    >
      {techDisplayName(tip.tech_key)} · {brightnessDescriptor(landmark.weight)}
      {landmark.firstUnlockedAt && ` · since ${formatShortDate(landmark.firstUnlockedAt)}`}
    </div>
  )
}
