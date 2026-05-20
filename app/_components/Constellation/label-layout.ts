import { anchorFor } from '@/features/constellation/render/anchors'
import { selectPersistentLabels } from '@/features/constellation/render/labels'
import { getPublicTech } from '@/features/territories/tech-catalog-public'
import {
  CLUSTER_LABELS,
  clusterLabelFontSize,
  clusterLabelHeight,
  estimateClusterLabelWidth,
} from './cluster-labels'
import {
  estimateTechLabelWidth,
  techLabelFontSize,
} from './label-position'
import { resolveStarViewBoxPosition } from './star-positions'
import {
  DEFAULT_SEMANTIC_SCALE_PROFILE,
  type SemanticConstellationScaleProfile,
} from './semantic-scale-profile'
import type { ConstellationData } from './types'
import type { TerritoryType } from '@/features/territories/registry'
import type { Viewport, WorldCoord } from '@/features/constellation/render/types'

export interface LabelRect {
  x: number
  y: number
  width: number
  height: number
}

interface CanvasSize {
  width: number | null
  height: number | null
}

interface Candidate {
  position: WorldCoord
  rect: LabelRect
  distanceFromPreferred: number
  ring: number
  directionPenalty: number
}

export interface TechLabelLayout {
  tech_key: string
  label: string
  landmark: ConstellationData['landmarks'][number]
  star: WorldCoord
  position: WorldCoord
  rect: LabelRect
  fontSize: number
  labelWidth: number
  labelHeight: number
}

const VIEWBOX_BOUNDS = {
  minX: 18,
  maxX: 982,
  minY: 16,
  maxY: 684,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function techDisplayName(tech_key: string): string {
  return getPublicTech(tech_key)?.displayName ?? tech_key
}

function fallbackDirection(techKey: string): WorldCoord {
  let h = 2166136261
  for (let i = 0; i < techKey.length; i += 1) {
    h ^= techKey.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const angle = ((h >>> 0) / 4294967296) * Math.PI * 2
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

function normalize(direction: WorldCoord, fallback: WorldCoord): WorldCoord {
  const length = Math.hypot(direction.x, direction.y)
  if (length < 0.001) return fallback
  return { x: direction.x / length, y: direction.y / length }
}

function rotate(direction: WorldCoord, radians: number): WorldCoord {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: direction.x * cos - direction.y * sin,
    y: direction.x * sin + direction.y * cos,
  }
}

function rectForCenter(position: WorldCoord, width: number, height: number): LabelRect {
  return {
    x: position.x - width / 2,
    y: position.y - height / 2,
    width,
    height,
  }
}

function paddedRect(rect: LabelRect, padding: number): LabelRect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

function overlapArea(a: LabelRect, b: LabelRect): number {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return x * y
}

export function labelsOverlap(a: LabelRect, b: LabelRect, padding = 0): boolean {
  return overlapArea(paddedRect(a, padding), paddedRect(b, padding)) > 0
}

function clampPosition(position: WorldCoord, width: number, height: number): WorldCoord {
  const halfWidth = width / 2
  const halfHeight = height / 2
  return {
    x: clamp(position.x, VIEWBOX_BOUNDS.minX + halfWidth, VIEWBOX_BOUNDS.maxX - halfWidth),
    y: clamp(position.y, VIEWBOX_BOUNDS.minY + halfHeight, VIEWBOX_BOUNDS.maxY - halfHeight),
  }
}

export function resolveClusterLabelProtectionRects(
  viewport: Viewport,
  canvasSize?: CanvasSize,
): LabelRect[] {
  const unitsPerCssPixel = viewBoxUnitsPerCssPixel(viewport, canvasSize)
  const fontSize = clusterLabelFontSize(viewport)
  return Object.entries(CLUSTER_LABELS).map(([type, label]) => {
    const anchor = anchorFor(viewport, type as TerritoryType)
    const width = estimateClusterLabelWidth(label, fontSize) * unitsPerCssPixel
    const height = clusterLabelHeight(fontSize) * unitsPerCssPixel
    return rectForCenter(anchor, width, height)
  })
}

function labelHeightForFontSize(fontSize: number): number {
  return Math.max(11, fontSize * 1.28 + 5)
}

function fallbackCanvasSize(viewport: Viewport): { width: number; height: number } {
  if (viewport === 'mobile') return { width: 390, height: 844 }
  if (viewport === 'og') return { width: 1200, height: 630 }
  return { width: 1440, height: 900 }
}

function viewBoxUnitsPerCssPixel(viewport: Viewport, canvasSize?: CanvasSize): number {
  const fallback = fallbackCanvasSize(viewport)
  const width = Math.max(1, canvasSize?.width ?? fallback.width)
  const height = Math.max(1, canvasSize?.height ?? fallback.height)
  const cssPixelsPerViewBoxUnit = Math.min(width / 1000, height / 700)
  return 1 / cssPixelsPerViewBoxUnit
}

function preferredDirection(
  techKey: string,
  territory: TerritoryType,
  star: WorldCoord,
  viewport: Viewport,
): WorldCoord {
  const anchor = anchorFor(viewport, territory)
  return normalize(
    { x: star.x - anchor.x, y: star.y - anchor.y },
    fallbackDirection(techKey),
  )
}

function uniqueDirections(directions: WorldCoord[]): WorldCoord[] {
  const seen = new Set<string>()
  const out: WorldCoord[] = []
  for (const direction of directions) {
    const normalized = normalize(direction, { x: 1, y: 0 })
    const key = `${Math.round(normalized.x * 10)}:${Math.round(normalized.y * 10)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out
}

function candidatePositions(input: {
  techKey: string
  territory: TerritoryType
  star: WorldCoord
  viewport: Viewport
  labelWidth: number
  labelHeight: number
  distanceScale: number
}): Candidate[] {
  const preferred = preferredDirection(input.techKey, input.territory, input.star, input.viewport)
  const perpendicular = { x: -preferred.y, y: preferred.x }
  const horizontalSign = Math.abs(preferred.x) < 0.2 ? 1 : Math.sign(preferred.x)
  const verticalSign = Math.abs(preferred.y) < 0.2 ? -1 : Math.sign(preferred.y)
  const baseDistance = (input.viewport === 'mobile' ? 18 : 22) * input.distanceScale
  const verticalBias = (input.viewport === 'mobile' ? -7 : -9) * input.distanceScale
  const directions = uniqueDirections([
    preferred,
    rotate(preferred, 0.45),
    rotate(preferred, -0.45),
    rotate(preferred, 0.9),
    rotate(preferred, -0.9),
    perpendicular,
    { x: -perpendicular.x, y: -perpendicular.y },
    { x: horizontalSign, y: 0 },
    { x: 0, y: verticalSign },
    { x: -preferred.x, y: -preferred.y },
  ])
  const rings = input.viewport === 'mobile' ? [1, 1.45, 1.9, 2.35] : [1, 1.35, 1.75, 2.15]
  const candidates: Candidate[] = []

  directions.forEach((direction, directionIndex) => {
    rings.forEach((ring, ringIndex) => {
      const directionDistance =
        baseDistance +
        Math.abs(direction.x) * input.labelWidth * 0.34 +
        Math.abs(direction.y) * input.labelHeight * 0.72
      const rawPosition = {
        x: input.star.x + direction.x * directionDistance * ring,
        y: input.star.y + direction.y * directionDistance * ring + verticalBias,
      }
      const position = clampPosition(rawPosition, input.labelWidth, input.labelHeight)
      const rect = rectForCenter(position, input.labelWidth, input.labelHeight)
      const preferredX =
        input.star.x + preferred.x * directionDistance + (directionIndex === 0 ? 0 : 0)
      const preferredY = input.star.y + preferred.y * directionDistance + verticalBias
      candidates.push({
        position,
        rect,
        distanceFromPreferred: Math.hypot(position.x - preferredX, position.y - preferredY),
        ring: ringIndex,
        directionPenalty: directionIndex === 0 ? 0 : directionIndex * 2.5,
      })
    })
  })

  return candidates
}

function labelCandidateCost(
  candidate: Candidate,
  placedRects: LabelRect[],
  protectedRects: LabelRect[],
  starRects: LabelRect[],
): number {
  let cost = candidate.distanceFromPreferred + candidate.ring * 10 + candidate.directionPenalty

  for (const rect of placedRects) {
    const area = overlapArea(paddedRect(candidate.rect, 2), paddedRect(rect, 2))
    if (area > 0) cost += 12000 + area * 28
  }

  for (const rect of protectedRects) {
    const area = overlapArea(paddedRect(candidate.rect, 3), rect)
    if (area > 0) cost += 5000 + area * 12
  }

  for (const rect of starRects) {
    const area = overlapArea(candidate.rect, rect)
    if (area > 0) cost += 2600 + area * 14
  }

  return cost
}

export function resolveTechLabelLayouts(input: {
  data: ConstellationData
  viewport: Viewport
  semanticProfile?: SemanticConstellationScaleProfile
  canvasSize?: CanvasSize
}): TechLabelLayout[] {
  const semanticProfile = input.semanticProfile ?? DEFAULT_SEMANTIC_SCALE_PROFILE
  const unitsPerCssPixel = viewBoxUnitsPerCssPixel(input.viewport, input.canvasSize)
  const persistent = selectPersistentLabels({
    landmarks: input.data.landmarks,
    territories: input.data.territories,
  })
  const labeled = input.data.landmarks
    .filter(
      (landmark) =>
        persistent.persistent.has(landmark.tech_key) &&
        landmark.firstUnlockedAt !== null &&
        landmark.weight >= 5,
    )
    .sort((a, b) => b.weight - a.weight || a.tech_key.localeCompare(b.tech_key))

  const starRects = labeled.map((landmark) => {
    const star = resolveStarViewBoxPosition(landmark.tech_key, landmark.territory, input.viewport)
    const radius = input.viewport === 'mobile' ? 9 : 7
    return rectForCenter(star, radius * 2, radius * 2)
  })
  const protectedRects = resolveClusterLabelProtectionRects(input.viewport, input.canvasSize)
  const placedRects: LabelRect[] = []

  return labeled.map((landmark) => {
    const label = techDisplayName(landmark.tech_key)
    const fontSize = techLabelFontSize(
      landmark.weight,
      input.viewport,
      semanticProfile.techLabelScale,
    )
    const labelWidth = estimateTechLabelWidth(label, fontSize) * unitsPerCssPixel
    const labelHeight = labelHeightForFontSize(fontSize) * unitsPerCssPixel
    const star = resolveStarViewBoxPosition(landmark.tech_key, landmark.territory, input.viewport)
    const candidates = candidatePositions({
      techKey: landmark.tech_key,
      territory: landmark.territory,
      star,
      viewport: input.viewport,
      labelWidth,
      labelHeight,
      distanceScale: semanticProfile.techLabelDistanceScale,
    })
    const best = candidates.reduce((bestCandidate, candidate) => {
      const bestCost = labelCandidateCost(bestCandidate, placedRects, protectedRects, starRects)
      const candidateCost = labelCandidateCost(candidate, placedRects, protectedRects, starRects)
      return candidateCost < bestCost ? candidate : bestCandidate
    })

    placedRects.push(best.rect)
    return {
      tech_key: landmark.tech_key,
      label,
      landmark,
      star,
      position: best.position,
      rect: best.rect,
      fontSize,
      labelWidth,
      labelHeight,
    }
  })
}
