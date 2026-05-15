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

// Maps catalog 0-1 position to viewBox (1000x700) space via anchor spread.
function resolveOgStarPos(
  tech_key: string,
  territory: TerritoryType,
): { x: number; y: number } {
  const catalog = getStarPositions()
  const pos = catalog.find((p) => p.tech_key === tech_key)
  const anchor = anchorFor('og', territory)
  const nx = pos?.x ?? 0.5
  const ny = pos?.y ?? 0.5
  return {
    x: anchor.x + (nx - 0.5) * anchor.spread * 2,
    y: anchor.y + (ny - 0.5) * anchor.spread * 2,
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
  /** Absolute base URL for loading /textures/milky-way-fallback.jpg */
  baseUrl?: string
}): JSX.Element {
  const { width, height, territories, landmarks, stageUpTerritories = [], baseUrl } = props
  const milkyWayUrl = baseUrl ? `${baseUrl}/textures/milky-way-fallback.jpg` : undefined

  const litLandmarks = landmarks.filter(
    (l) => l.firstUnlockedAt !== null && l.weight >= 5,
  )

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

  const landmarkWithPos = litLandmarks.map((l) => ({
    ...l,
    pos: resolveOgStarPos(l.tech_key, l.territory),
  }))

  // Slice-mode scale: largest uniform scale that fills the image.
  // Maps viewBox (1000x700) coords to pixel space.
  const scaleX = width / 1000
  const scaleY = height / 700
  const scale = Math.max(scaleX, scaleY)
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
        background: 'linear-gradient(180deg, #020207 0%, #050307 100%)',
      }}
    >
      {/* (1) Milky Way fallback texture — Satori requires absolute URL */}
      {milkyWayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={milkyWayUrl}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.85,
          }}
        />
      ) : null}

      {/* (3-5) Constellation vector layer — Satori does not support SVG <text> */}
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <defs>
          <linearGradient id="og-vignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#020207" stopOpacity="0.4" />
            <stop offset="1" stopColor="#050307" stopOpacity="0.55" />
          </linearGradient>
          <clipPath id="og-clip">
            <rect x="0" y="0" width={width} height={height} />
          </clipPath>
        </defs>

        {/* Subtle vignette to deepen sky feel */}
        <rect width={width} height={height} fill="url(#og-vignette)" />

        <g transform={`translate(${tx}, ${ty}) scale(${scale})`} clipPath="url(#og-clip)">
          {/* (3) Voronoi territory boundary lines */}
          {cells.map((cell) => (
            <polygon
              key={cell.type}
              points={cell.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#4a5566"
              strokeOpacity={0.1}
              strokeWidth={0.7 / scale}
            />
          ))}

          {/* (4) MST connection lines */}
          {allMstEdges.map((e, i) => (
            <line
              key={i}
              x1={e.a.x}
              y1={e.a.y}
              x2={e.b.x}
              y2={e.b.y}
              stroke="#5a6c80"
              strokeWidth={0.7 / scale}
              opacity={0.22}
            />
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
            const r = mag.coreRadius * (isHighlighted ? 1.3 : 1.0)
            return (
              <g key={l.tech_key}>
                {/* Glow layers */}
                <circle cx={l.pos.x} cy={l.pos.y} r={r * 5} fill={color} opacity={0.04} />
                <circle cx={l.pos.x} cy={l.pos.y} r={r * 2.5} fill={color} opacity={0.1} />
                <circle cx={l.pos.x} cy={l.pos.y} r={r * 1.5} fill={color} opacity={0.28} />
                {/* Core */}
                <circle cx={l.pos.x} cy={l.pos.y} r={r} fill={color} opacity={0.95} />
                {/* Diffraction spikes for top-quintile stars */}
                {mag.showSpikes ? (
                  <g>
                    <line
                      x1={l.pos.x - mag.spikeLength}
                      y1={l.pos.y}
                      x2={l.pos.x + mag.spikeLength}
                      y2={l.pos.y}
                      stroke={color}
                      strokeWidth={0.6 / scale}
                      opacity={0.7}
                    />
                    <line
                      x1={l.pos.x}
                      y1={l.pos.y - mag.spikeLength}
                      x2={l.pos.x}
                      y2={l.pos.y + mag.spikeLength}
                      stroke={color}
                      strokeWidth={0.6 / scale}
                      opacity={0.7}
                    />
                  </g>
                ) : null}
              </g>
            )
          })}
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
