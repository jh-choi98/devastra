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

type OgMidStar = {
  pos: WorldCoord
  size: 2 | 3
  color: SpectralColor
  twinklePhase: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
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

function fieldStarRadius(size: number, scale: number): number {
  return (size * 0.36 * OG_BACKGROUND_STAR_SIZE_SCALE) / scale
}

function midStarRadius(size: number, scale: number): number {
  return (size * 0.56 * OG_BACKGROUND_STAR_SIZE_SCALE) / scale
}

function techStarPixelRadius(coreRadius: number, techKey: string): number {
  const zScale = 1 + zFor(techKey) * 0.24
  return coreRadius * 1.65 * zScale
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
}): JSX.Element {
  const { width, height, territories, landmarks, stageUpTerritories = [] } = props

  const litLandmarks = landmarks.filter((l) => l.firstUnlockedAt !== null && l.weight >= 5)

  const litWeights = litLandmarks.map((l) => l.weight)
  const threshold = topQuintileThreshold(litWeights)

  const cells = voronoiCells('og')
  const anchors = anchorsFor('og')

  const allMstEdges = ALL_TERRITORY_TYPES.flatMap((type) => {
    const clusterLit = litLandmarks.filter((l) => l.territory === type)
    const positions = clusterLit.map((l) => resolveOgStarPos(l.tech_key, l.territory))
    return mstEdges(positions)
  })

  const { persistent } = selectPersistentLabels({ landmarks: litLandmarks, territories })

  const fieldStars = generateFieldStarPool('og').slice(0, OG_FIELD_STAR_COUNT)
  const midStars = generateOgMidStars()

  const landmarkWithPos = litLandmarks.map((l) => ({
    ...l,
    pos: resolveOgStarPos(l.tech_key, l.territory),
  }))

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
            {fieldStars.map((star, index) => {
              const radius = fieldStarRadius(star.size, scale)
              return (
                <circle
                  key={`field-${index}`}
                  cx={star.pos.x}
                  cy={star.pos.y}
                  r={radius}
                  fill={spectralHex(star.color)}
                  opacity={star.size === 1 ? 0.56 : star.size === 2 ? 0.66 : 0.78}
                />
              )
            })}

            {/* Mid-depth stars */}
            {midStars.map((star, index) => {
              const radius = midStarRadius(star.size, scale)
              const color = spectralHex(star.color)
              return (
                <g key={`mid-${index}`}>
                  <circle
                    cx={star.pos.x}
                    cy={star.pos.y}
                    r={radius * 2.1}
                    fill={color}
                    opacity={0.055}
                  />
                  <circle cx={star.pos.x} cy={star.pos.y} r={radius} fill={color} opacity={0.72} />
                </g>
              )
            })}

            {/* Voronoi territory boundary lines */}
            {cells.map((cell) => (
              <polygon
                key={cell.type}
                points={cell.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#2a3a4d"
                strokeOpacity={0.05}
                strokeWidth={0.7 / scale}
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
                  strokeWidth={4.4 / scale}
                  strokeLinecap="round"
                  opacity={0.16}
                />
                <line
                  x1={e.a.x}
                  y1={e.a.y}
                  x2={e.b.x}
                  y2={e.b.y}
                  stroke="#8fa8cf"
                  strokeWidth={1.65 / scale}
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
                (techStarPixelRadius(mag.coreRadius, l.tech_key) / scale) *
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
                        strokeWidth={0.7 / scale}
                        opacity={0.76}
                      />
                      <line
                        x1={l.pos.x}
                        y1={l.pos.y - mag.spikeLength}
                        x2={l.pos.x}
                        y2={l.pos.y + mag.spikeLength}
                        stroke={color}
                        strokeWidth={0.7 / scale}
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
              fontSize: 12,
              fontFamily: 'system-ui',
              display: 'flex',
            }}
          >
            {TERRITORIES[a.type].name}
          </div>
        )
      })}

      {/* Persistent star labels */}
      {props.showHeroLabels !== false
        ? landmarkWithPos
            .filter((l) => persistent.has(l.tech_key))
            .map((l) => {
              const name = getPublicTech(l.tech_key)?.displayName ?? l.tech_key
              const px = vbPx(l.pos.x)
              const py = vbPy(l.pos.y) - 20
              return (
                <div
                  key={`label-${l.tech_key}`}
                  style={{
                    position: 'absolute',
                    left: px,
                    top: py,
                    transform: 'translateX(-50%)',
                    color: '#d8e0ec',
                    fontSize: 10,
                    fontFamily: 'system-ui',
                    display: 'flex',
                  }}
                >
                  {name}
                </div>
              )
            })
        : null}

      {/* Watermark */}
      <div
        style={{
          position: 'absolute',
          right: 16,
          bottom: 14,
          color: '#475569',
          fontSize: 12,
          fontFamily: 'system-ui',
          display: 'flex',
        }}
      >
        devastra.app
      </div>
    </div>
  )
}
