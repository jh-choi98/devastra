import 'server-only'

import { ImageResponse } from 'next/og'
import { ConstellationOG } from './ConstellationImage'
import type { OgMapData } from './ProfileImage'
import type { TerritoryType } from '@/features/territories/registry'

export type RecapHighlights = {
  top_growth: { territory: string; pct: number } | null
  new_landmarks: string[]
  stage_ups: Array<{ territory: string; from: number; to: number }>
  stats: { active_days: number; prs_shipped: number }
  slot_1?: {
    kind: 'stage_up' | 'brightest_cluster'
    territory: string
    pct?: number
  } | null
  slot_2?: {
    kind: 'new_landmarks' | 'brightened'
    tech_keys: string[]
  } | null
}

export type RecapImageData = {
  displayUsername: string
  avatarUrl: string | null
  weekStart: string
  highlights: RecapHighlights
  map?: OgMapData
}

function buildStatStripText(highlights: RecapHighlights): string {
  const parts: string[] = []

  const slot1 = highlights.slot_1
  const slot2 = highlights.slot_2

  if (slot1?.kind === 'stage_up') {
    const territory = slot1.territory.replace('_land', '').replace('_fortress', '').replace('_pipeline_zone', '').replace('_lab', '').replace('_harbor', '').replace('_library', '')
    const label = territory.charAt(0).toUpperCase() + territory.slice(1)
    parts.push(`${label} expanded`)
  }

  if (slot2?.kind === 'new_landmarks' && slot2.tech_keys.length > 0) {
    parts.push(`+${slot2.tech_keys.length} stars`)
  } else if (highlights.new_landmarks.length > 0) {
    parts.push(`+${highlights.new_landmarks.length} stars`)
  }

  if (slot1?.kind === 'brightest_cluster' && slot1.pct != null) {
    const territory = slot1.territory.replace('_land', '').replace('_fortress', '').replace('_pipeline_zone', '').replace('_lab', '').replace('_harbor', '').replace('_library', '')
    const label = territory.charAt(0).toUpperCase() + territory.slice(1)
    parts.push(`${label} +${slot1.pct}%`)
  } else if (highlights.top_growth) {
    const territory = highlights.top_growth.territory.replace('_land', '').replace('_fortress', '').replace('_pipeline_zone', '').replace('_lab', '').replace('_harbor', '').replace('_library', '')
    const label = territory.charAt(0).toUpperCase() + territory.slice(1)
    parts.push(`${label} +${highlights.top_growth.pct}%`)
  }

  return parts.join(' · ')
}

export function renderPrivatePlaceholder(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: '#0b1020',
          fontFamily: 'system-ui, sans-serif',
          gap: '16px',
        }}
      >
        <span style={{ color: '#64748b', fontSize: '32px', fontWeight: 600 }}>DevAstra</span>
        <span style={{ color: '#475569', fontSize: '20px' }}>Weekly Recap</span>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}

export function renderRecapImage(opts: {
  map: OgMapData
  weekStart: Date
  statStripText: string
  stageUpTerritories?: TerritoryType[]
  baseUrl?: string
}): ImageResponse {
  const width = 1200
  const height = 630
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: '#0b1020',
          position: 'relative',
        }}
      >
        <ConstellationOG
          width={width}
          height={height}
          territories={opts.map.territories}
          landmarks={opts.map.landmarks}
          diffSince={opts.weekStart.toISOString()}
          showHeroLabels={false}
          stageUpTerritories={opts.stageUpTerritories}
          baseUrl={opts.baseUrl}
        />
        {opts.statStripText && (
          <div
            style={{
              position: 'absolute',
              top: 24,
              right: 28,
              color: '#e2e8f0',
              fontFamily: 'system-ui',
              fontSize: 16,
              fontWeight: 600,
              display: 'flex',
            }}
          >
            {opts.statStripText}
          </div>
        )}
      </div>
    ),
    { width, height },
  )
}

export { buildStatStripText }
