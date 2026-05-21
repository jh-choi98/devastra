import 'server-only'
import type { TerritoryType } from '@/features/territories/registry'
import { TERRITORIES, ALL_TERRITORY_TYPES } from '@/features/territories/registry'
import { getStarPositions } from '@/features/territories/star-positions'
import { getPublicTech } from '@/features/territories/tech-catalog-public'
import { anchorsFor, anchorFor } from '@/features/constellation/render/anchors'
import { spectralColorFor, spectralHex } from '@/features/constellation/render/palette'
import { voronoiCells } from '@/features/constellation/render/voronoi'
import { magnitudeFor, topQuintileThreshold } from '@/features/constellation/render/magnitude'
import { selectPersistentLabels } from '@/features/constellation/render/labels'
import { mstEdges } from '@/features/constellation/render/mst'
import { generateFieldStarPool } from '@/features/constellation/render/field-stars'
import type { SpectralColor, WorldCoord } from '@/features/constellation/render/types'

const OG_BACKGROUND_STAR_SIZE_SCALE = 1.1
const OG_FIELD_STAR_COUNT = 1500
const OG_MID_STAR_COUNT = 280
const OG_TECH_LABEL_FONT_SIZE = 10
const OG_CLUSTER_LABEL_FONT_SIZE = 12
const OG_LABEL_BOUNDS = {
  minX: 18,
  maxX: 982,
  minY: 16,
  maxY: 684,
}

type OgMidStar = {
  pos: WorldCoord
  size: 2 | 3
  color: SpectralColor
  twinklePhase: number
}

type CircleGlyph = {
  x: number
  y: number
  r: number
}

type SvgPathGroup = {
  key: string
  d: string
  fill: string
  opacity: number
}

type LabelRect = {
  x: number
  y: number
  width: number
  height: number
}

type LabelCandidate = {
  position: WorldCoord
  rect: LabelRect
  distanceFromPreferred: number
  ring: number
  directionPenalty: number
}

type OgResolvedLandmarkInput = OgLandmarkInput & { pos: WorldCoord }

export type OgTechLabelLayout = {
  tech_key: string
  label: string
  position: WorldCoord
  rect: LabelRect
  fontSize: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
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

function clampLabelPosition(position: WorldCoord, width: number, height: number): WorldCoord {
  const halfWidth = width / 2
  const halfHeight = height / 2
  return {
    x: clamp(position.x, OG_LABEL_BOUNDS.minX + halfWidth, OG_LABEL_BOUNDS.maxX - halfWidth),
    y: clamp(position.y, OG_LABEL_BOUNDS.minY + halfHeight, OG_LABEL_BOUNDS.maxY - halfHeight),
  }
}

function pathNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return String(Number(value.toFixed(3)))
}

export function ogPixelScale(width: number, height: number): number {
  return Math.max(1, Math.min(width / 1200, height / 630))
}

export function circlePathCommands(glyphs: CircleGlyph[]): string {
  return glyphs
    .filter((glyph) => glyph.r > 0)
    .map((glyph) => {
      const x = pathNumber(glyph.x)
      const y = pathNumber(glyph.y)
      const r = pathNumber(glyph.r)
      const diameter = pathNumber(glyph.r * 2)
      return `M ${x} ${y} m -${r} 0 a ${r} ${r} 0 1 0 ${diameter} 0 a ${r} ${r} 0 1 0 -${diameter} 0`
    })
    .join(' ')
}

function cyrb53(str: string): number {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function jitter(techKey: string): { dx: number; dy: number } {
  let h = 2166136261 >>> 0
  for (let i = 0; i < techKey.length; i += 1) {
    h ^= techKey.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const a = ((h >>> 0) % 1000) / 1000
  const b = ((h >>> 10) % 1000) / 1000
  return { dx: (a - 0.5) * 28, dy: (b - 0.5) * 28 }
}

function zFor(techKey: string): number {
  let h = 0x9e3779b9
  for (let i = 0; i < techKey.length; i += 1) {
    h ^= techKey.charCodeAt(i)
    h = Math.imul(h, 0x85ebca6b)
    h ^= h >>> 13
  }
  return (h >>> 0) / 4294967296 - 0.5
}

function generateOgMidStars(): OgMidStar[] {
  const seed = cyrb53('devastra:mid-stars:v1:og')
  const rng = mulberry32(seed >>> 0)
  return Array.from({ length: OG_MID_STAR_COUNT }, () => {
    const x = -400 + rng() * 1800
    const y = -250 + rng() * 1200
    const size = rng() < 0.7 ? 2 : 3
    const cv = rng()
    const color: SpectralColor =
      cv < 0.55 ? 'white' : cv < 0.85 ? 'blue-white' : cv < 0.95 ? 'yellow-white' : 'orange'

    return {
      pos: { x, y },
      size,
      color,
      twinklePhase: rng(),
    }
  })
}

const OG_FIELD_STARS = generateFieldStarPool('og').slice(0, OG_FIELD_STAR_COUNT)
const OG_MID_STARS = generateOgMidStars()
const OG_VORONOI_CELLS = voronoiCells('og')
const OG_ANCHORS = anchorsFor('og')

function fieldStarRadius(size: number, scale: number, pixelScale: number): number {
  return (size * 0.36 * OG_BACKGROUND_STAR_SIZE_SCALE * pixelScale) / scale
}

function midStarRadius(size: number, scale: number, pixelScale: number): number {
  return (size * 0.56 * OG_BACKGROUND_STAR_SIZE_SCALE * pixelScale) / scale
}

function techStarPixelRadius(coreRadius: number, techKey: string, pixelScale: number): number {
  const zScale = 1 + zFor(techKey) * 0.24
  return coreRadius * 1.65 * zScale * pixelScale
}

function estimateLabelWidth(label: string, fontSize: number, pixelScale: number): number {
  return Math.max(28 * pixelScale, label.length * fontSize * 0.56 + 12 * pixelScale)
}

function labelHeightForFontSize(fontSize: number, pixelScale: number): number {
  return Math.max(11 * pixelScale, fontSize * 1.28 + 5 * pixelScale)
}

function labelMetricsInViewBox(input: {
  label: string
  fontSize: number
  pixelScale: number
  scale: number
}): { width: number; height: number } {
  return {
    width: estimateLabelWidth(input.label, input.fontSize, input.pixelScale) / input.scale,
    height: labelHeightForFontSize(input.fontSize, input.pixelScale) / input.scale,
  }
}

function preferredLabelDirection(
  techKey: string,
  territory: TerritoryType,
  star: WorldCoord,
): WorldCoord {
  const anchor = anchorFor('og', territory)
  return normalize({ x: star.x - anchor.x, y: star.y - anchor.y }, fallbackDirection(techKey))
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

function labelCandidatePositions(input: {
  techKey: string
  territory: TerritoryType
  star: WorldCoord
  labelWidth: number
  labelHeight: number
}): LabelCandidate[] {
  const preferred = preferredLabelDirection(input.techKey, input.territory, input.star)
  const perpendicular = { x: -preferred.y, y: preferred.x }
  const horizontalSign = Math.abs(preferred.x) < 0.2 ? 1 : Math.sign(preferred.x)
  const verticalSign = Math.abs(preferred.y) < 0.2 ? -1 : Math.sign(preferred.y)
  const baseDistance = 22
  const verticalBias = -9
  const directions = uniqueDirections([
    preferred,
    rotate(preferred, 0.35),
    rotate(preferred, -0.35),
    rotate(preferred, 0.7),
    rotate(preferred, -0.7),
    rotate(preferred, 1.05),
    rotate(preferred, -1.05),
    perpendicular,
    { x: -perpendicular.x, y: -perpendicular.y },
    { x: horizontalSign, y: 0 },
    { x: 0, y: verticalSign },
    { x: -preferred.x, y: -preferred.y },
  ])
  const rings = [1, 1.35, 1.75, 2.15, 2.65, 3.2]
  const candidates: LabelCandidate[] = []

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
      const position = clampLabelPosition(rawPosition, input.labelWidth, input.labelHeight)
      const rect = rectForCenter(position, input.labelWidth, input.labelHeight)
      const preferredX = input.star.x + preferred.x * directionDistance
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
  candidate: LabelCandidate,
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

function resolveOgClusterLabelProtectionRects(input: {
  landmarks: OgResolvedLandmarkInput[]
  scale: number
  pixelScale: number
}): LabelRect[] {
  const activeTypes = new Set(input.landmarks.map((landmark) => landmark.territory))
  const fontSize = OG_CLUSTER_LABEL_FONT_SIZE * input.pixelScale

  return OG_ANCHORS.filter((anchor) => activeTypes.has(anchor.type)).map((anchor) => {
    const label = TERRITORIES[anchor.type].name
    const metrics = labelMetricsInViewBox({
      label,
      fontSize,
      pixelScale: input.pixelScale,
      scale: input.scale,
    })
    return rectForCenter(
      { x: anchor.x, y: anchor.y + anchor.spread + 16 },
      metrics.width,
      metrics.height,
    )
  })
}

function resolveOgTechLabelLayoutsForResolved(input: {
  landmarks: OgResolvedLandmarkInput[]
  territories: OgTerritoryInput[]
  width: number
  height: number
  pixelScale: number
}): OgTechLabelLayout[] {
  const scale = Math.min(input.width / 1000, input.height / 700)
  const persistent = selectPersistentLabels({
    landmarks: input.landmarks,
    territories: input.territories,
  })
  const labeled = input.landmarks
    .filter((landmark) => persistent.persistent.has(landmark.tech_key))
    .sort((a, b) => b.weight - a.weight || a.tech_key.localeCompare(b.tech_key))
  const starRects = labeled.map((landmark) => rectForCenter(landmark.pos, 14, 14))
  const protectedRects = resolveOgClusterLabelProtectionRects({
    landmarks: labeled,
    scale,
    pixelScale: input.pixelScale,
  })
  const placedRects: LabelRect[] = []
  const fontSize = OG_TECH_LABEL_FONT_SIZE * input.pixelScale

  return labeled.map((landmark) => {
    const label = getPublicTech(landmark.tech_key)?.displayName ?? landmark.tech_key
    const metrics = labelMetricsInViewBox({
      label,
      fontSize,
      pixelScale: input.pixelScale,
      scale,
    })
    const candidates = labelCandidatePositions({
      techKey: landmark.tech_key,
      territory: landmark.territory,
      star: landmark.pos,
      labelWidth: metrics.width,
      labelHeight: metrics.height,
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
      position: best.position,
      rect: best.rect,
      fontSize,
    }
  })
}

export function resolveOgTechLabelLayouts(input: {
  landmarks: OgLandmarkInput[]
  territories: OgTerritoryInput[]
  width: number
  height: number
  pixelScale?: number
}): OgTechLabelLayout[] {
  const litLandmarks = input.landmarks
    .filter((landmark) => landmark.firstUnlockedAt !== null && landmark.weight >= 5)
    .map((landmark) => ({
      ...landmark,
      pos: resolveOgStarPos(landmark.tech_key, landmark.territory),
    }))

  return resolveOgTechLabelLayoutsForResolved({
    landmarks: litLandmarks,
    territories: input.territories,
    width: input.width,
    height: input.height,
    pixelScale: input.pixelScale ?? ogPixelScale(input.width, input.height),
  })
}

function buildFieldStarPathGroups(scale: number, pixelScale: number): SvgPathGroup[] {
  const groups = new Map<string, { fill: string; opacity: number; glyphs: CircleGlyph[] }>()

  for (const star of OG_FIELD_STARS) {
    const fill = spectralHex(star.color)
    const opacity = star.size === 1 ? 0.56 : star.size === 2 ? 0.66 : 0.78
    const key = `${star.color}-${star.size}`
    const group = groups.get(key) ?? { fill, opacity, glyphs: [] }
    group.glyphs.push({
      x: star.pos.x,
      y: star.pos.y,
      r: fieldStarRadius(star.size, scale, pixelScale),
    })
    groups.set(key, group)
  }

  return Array.from(groups.entries()).map(([key, group]) => ({
    key,
    fill: group.fill,
    opacity: group.opacity,
    d: circlePathCommands(group.glyphs),
  }))
}

function buildMidStarPathGroups(scale: number, pixelScale: number): SvgPathGroup[] {
  const groups = new Map<string, { fill: string; opacity: number; glyphs: CircleGlyph[] }>()

  for (const star of OG_MID_STARS) {
    const fill = spectralHex(star.color)
    const radius = midStarRadius(star.size, scale, pixelScale)
    const haloKey = `mid-halo-${star.color}-${star.size}`
    const coreKey = `mid-core-${star.color}-${star.size}`
    const halo = groups.get(haloKey) ?? { fill, opacity: 0.055, glyphs: [] }
    const core = groups.get(coreKey) ?? { fill, opacity: 0.72, glyphs: [] }
    halo.glyphs.push({ x: star.pos.x, y: star.pos.y, r: radius * 2.1 })
    core.glyphs.push({ x: star.pos.x, y: star.pos.y, r: radius })
    groups.set(haloKey, halo)
    groups.set(coreKey, core)
  }

  return Array.from(groups.entries()).map(([key, group]) => ({
    key,
    fill: group.fill,
    opacity: group.opacity,
    d: circlePathCommands(group.glyphs),
  }))
}

// Maps catalog 0-1 position to viewBox (1000x700) space via anchor spread,
// matching the current WebGL renderer's jitter and safe-area clamp.
function resolveOgStarPos(tech_key: string, territory: TerritoryType): { x: number; y: number } {
  const catalog = getStarPositions()
  const pos = catalog.find((p) => p.tech_key === tech_key)
  const anchor = anchorFor('og', territory)
  const j = jitter(tech_key)
  const nx = pos?.x ?? 0.5
  const ny = pos?.y ?? 0.5
  return {
    x: clamp(anchor.x + (nx - 0.5) * anchor.spread * 2 + j.dx, 34, 966),
    y: clamp(anchor.y + (ny - 0.5) * anchor.spread * 2 + j.dy, 42, 664),
  }
}

export type OgTerritoryInput = {
  type: TerritoryType
  stage: number
  growth30d: number
  totalWeight: number
}

export type OgLandmarkInput = {
  tech_key: string
  territory: TerritoryType
  weight: number
  firstUnlockedAt: string | null
}

export function ConstellationOG(props: {
  width: number
  height: number
  territories: OgTerritoryInput[]
  landmarks: OgLandmarkInput[]
  diffSince?: string | null
  showHeroLabels?: boolean
  stageUpTerritories?: TerritoryType[]
  baseUrl?: string
  pixelScale?: number
}): JSX.Element {
  const {
    width,
    height,
    territories,
    landmarks,
    stageUpTerritories = [],
    pixelScale = ogPixelScale(width, height),
  } = props

  const litLandmarks = landmarks.filter((l) => l.firstUnlockedAt !== null && l.weight >= 5)

  const litWeights = litLandmarks.map((l) => l.weight)
  const threshold = topQuintileThreshold(litWeights)

  const cells = OG_VORONOI_CELLS
  const anchors = OG_ANCHORS

  const landmarkWithPos = litLandmarks.map((l) => ({
    ...l,
    pos: resolveOgStarPos(l.tech_key, l.territory),
  }))

  const allMstEdges = ALL_TERRITORY_TYPES.flatMap((type) => {
    const positions = landmarkWithPos.filter((l) => l.territory === type).map((l) => l.pos)
    return mstEdges(positions)
  })

  // Meet-mode scale matches the current WebGL camera: the full semantic
  // constellation remains visible, and the expanded background field fills the
  // horizontal/vertical dark-sky margins.
  const scaleX = width / 1000
  const scaleY = height / 700
  const scale = Math.min(scaleX, scaleY)
  const tx = (width - 1000 * scale) / 2
  const ty = (height - 700 * scale) / 2
  const vbPx = (vx: number) => tx + vx * scale
  const vbPy = (vy: number) => ty + vy * scale
  const fieldStarPathGroups = buildFieldStarPathGroups(scale, pixelScale)
  const midStarPathGroups = buildMidStarPathGroups(scale, pixelScale)
  const labelLayouts =
    props.showHeroLabels !== false
      ? resolveOgTechLabelLayoutsForResolved({
          landmarks: landmarkWithPos,
          territories,
          width,
          height,
          pixelScale,
        })
      : []

  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(180deg, #010104 0%, #020204 100%)',
      }}
    >
      {/* Constellation vector layer — Satori does not support SVG <text> */}
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <linearGradient id="og-vignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#020207" stopOpacity="0.4" />
            <stop offset="1" stopColor="#050307" stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id="og-haze" cx="50%" cy="48%" r="66%">
            <stop offset="0" stopColor="#516480" stopOpacity="0.045" />
            <stop offset="0.58" stopColor="#314058" stopOpacity="0.018" />
            <stop offset="1" stopColor="#020204" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Faint cool haze and vignette to match the current dark-sky canvas. */}
        <rect width={width} height={height} fill="url(#og-haze)" />
        <rect width={width} height={height} fill="url(#og-vignette)" />

        <g>
          <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>
            {/* Background field stars */}
            {fieldStarPathGroups.map((group) => (
              <path
                key={`field-${group.key}`}
                d={group.d}
                fill={group.fill}
                opacity={group.opacity}
              />
            ))}

            {/* Mid-depth stars */}
            {midStarPathGroups.map((group) => (
              <path key={group.key} d={group.d} fill={group.fill} opacity={group.opacity} />
            ))}

            {/* Voronoi territory boundary lines */}
            {cells.map((cell) => (
              <polygon
                key={cell.type}
                points={cell.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#2a3a4d"
                strokeOpacity={0.05}
                strokeWidth={(0.7 * pixelScale) / scale}
              />
            ))}

            {/* MST connection lines */}
            {allMstEdges.map((e, i) => (
              <g key={i}>
                <line
                  x1={e.a.x}
                  y1={e.a.y}
                  x2={e.b.x}
                  y2={e.b.y}
                  stroke="#7890b5"
                  strokeWidth={(4.4 * pixelScale) / scale}
                  strokeLinecap="round"
                  opacity={0.16}
                />
                <line
                  x1={e.a.x}
                  y1={e.a.y}
                  x2={e.b.x}
                  y2={e.b.y}
                  stroke="#8fa8cf"
                  strokeWidth={(1.65 * pixelScale) / scale}
                  strokeLinecap="round"
                  opacity={0.74}
                />
              </g>
            ))}

            {/* Recap-only: aura for stage-up clusters */}
            {stageUpTerritories.map((type) => {
              const anchor = anchorFor('og', type)
              const color = TERRITORIES[type].color
              return (
                <circle
                  key={`aura-${type}`}
                  cx={anchor.x}
                  cy={anchor.y}
                  r={anchor.spread * 0.8}
                  fill={color}
                  opacity={0.08}
                />
              )
            })}

            {/* (5) Tech stars — multi-ring glow approximates UnrealBloom */}
            {landmarkWithPos.map((l) => {
              const mag = magnitudeFor(l.weight, threshold)
              const color = spectralHex(spectralColorFor(l.tech_key))
              const isHighlighted =
                props.diffSince != null &&
                l.firstUnlockedAt != null &&
                l.firstUnlockedAt > props.diffSince
              const r =
                (techStarPixelRadius(mag.coreRadius, l.tech_key, pixelScale) / scale) *
                (isHighlighted ? 1.3 : 1.0)
              return (
                <g key={l.tech_key}>
                  {/* Glow layers */}
                  <circle cx={l.pos.x} cy={l.pos.y} r={r * 2.8} fill={color} opacity={0.05} />
                  <circle cx={l.pos.x} cy={l.pos.y} r={r * 1.7} fill={color} opacity={0.12} />
                  <circle cx={l.pos.x} cy={l.pos.y} r={r * 1.05} fill={color} opacity={0.32} />
                  {/* Core */}
                  <circle cx={l.pos.x} cy={l.pos.y} r={r * 0.34} fill="#ffffff" opacity={0.9} />
                  {/* Diffraction spikes for top-quintile stars */}
                  {mag.showSpikes ? (
                    <g>
                      <line
                        x1={l.pos.x - mag.spikeLength}
                        y1={l.pos.y}
                        x2={l.pos.x + mag.spikeLength}
                        y2={l.pos.y}
                        stroke={color}
                        strokeWidth={(0.7 * pixelScale) / scale}
                        opacity={0.76}
                      />
                      <line
                        x1={l.pos.x}
                        y1={l.pos.y - mag.spikeLength}
                        x2={l.pos.x}
                        y2={l.pos.y + mag.spikeLength}
                        stroke={color}
                        strokeWidth={(0.7 * pixelScale) / scale}
                        opacity={0.76}
                      />
                    </g>
                  ) : null}
                </g>
              )
            })}
          </g>
        </g>
      </svg>

      {/* (8) Text labels — HTML divs (SVG <text> not supported in Satori) */}

      {/* Cluster labels — blue-white, rendered for active clusters */}
      {anchors.map((a) => {
        const hasLit = litLandmarks.some((l) => l.territory === a.type)
        if (!hasLit) return null
        const px = vbPx(a.x)
        const py = vbPy(a.y + a.spread + 16)
        return (
          <div
            key={a.type}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              transform: 'translateX(-50%)',
              color: '#8aa0b8',
              fontSize: 12 * pixelScale,
              fontFamily: 'system-ui',
              display: 'flex',
            }}
          >
            {TERRITORIES[a.type].name}
          </div>
        )
      })}

      {/* Persistent star labels */}
      {labelLayouts.map((layout) => {
        const px = vbPx(layout.position.x)
        const py = vbPy(layout.position.y)
        return (
          <div
            key={`label-${layout.tech_key}`}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              transform: 'translate(-50%, -50%)',
              color: '#d8e0ec',
              fontSize: layout.fontSize,
              fontFamily: 'system-ui',
              display: 'flex',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
            }}
          >
            {layout.label}
          </div>
        )
      })}

      {/* Watermark */}
      <div
        style={{
          position: 'absolute',
          right: 16 * pixelScale,
          bottom: 14 * pixelScale,
          color: '#475569',
          fontSize: 12 * pixelScale,
          fontFamily: 'system-ui',
          display: 'flex',
        }}
      >
        devastra.app
      </div>
    </div>
  )
}
