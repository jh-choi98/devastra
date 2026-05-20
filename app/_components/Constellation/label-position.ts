'use client'
import { anchorFor } from '@/features/constellation/render/anchors'
import { resolveStarViewBoxPosition } from './star-positions'
import type { TerritoryType } from '@/features/territories/registry'

type Viewport = 'desktop' | 'mobile' | 'og'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function fallbackDirection(techKey: string): { x: number; y: number } {
  let h = 2166136261
  for (let i = 0; i < techKey.length; i += 1) {
    h ^= techKey.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const angle = ((h >>> 0) / 4294967296) * Math.PI * 2
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

export function resolveTechLabelViewBoxPosition(
  techKey: string,
  territory: TerritoryType,
  viewport: Viewport,
  distanceScale = 1,
): { x: number; y: number } {
  const star = resolveStarViewBoxPosition(techKey, territory, viewport)
  const anchor = anchorFor(viewport, territory)
  const dx = star.x - anchor.x
  const dy = star.y - anchor.y
  const len = Math.hypot(dx, dy)
  const direction = len > 0.001
    ? { x: dx / len, y: dy / len }
    : fallbackDirection(techKey)
  const distance = (viewport === 'mobile' ? 18 : 22) * distanceScale
  const verticalBias = (viewport === 'mobile' ? -7 : -9) * distanceScale
  const minX = viewport === 'mobile' ? 78 : 34
  const maxX = viewport === 'mobile' ? 922 : 966

  return {
    x: clamp(star.x + direction.x * distance, minX, maxX),
    y: clamp(star.y + direction.y * distance + verticalBias, 18, 682),
  }
}

export function techLabelFontSize(weight: number, viewport: Viewport, scale = 1): number {
  const t = clamp(Math.log(Math.max(5, weight) / 5) / Math.log(100), 0, 1)
  const base = viewport === 'mobile' ? 7.6 : 8.8
  const range = viewport === 'mobile' ? 1.5 : 1.8
  return (base + t * range) * scale
}

export function techLabelOpacity(weight: number): number {
  const t = clamp(Math.log(Math.max(5, weight) / 5) / Math.log(100), 0, 1)
  return 0.66 + t * 0.28
}

export function estimateTechLabelWidth(label: string, fontSize: number): number {
  return Math.max(28, label.length * fontSize * 0.56 + 12)
}
