import 'server-only'

import { ImageResponse } from 'next/og'
import { ConstellationOG } from './ConstellationImage'
import type { TerritoryType } from '@/features/territories/registry'

export type OgMapData = {
  territories: Array<{
    type: TerritoryType
    stage: number
    totalWeight: number
    growth30d: number
    stageChangedAt: string | null
  }>
  landmarks: Array<{
    tech_key: string
    territory: TerritoryType
    weight: number
    firstUnlockedAt: string | null
  }>
}

export type ProfileImageData = {
  displayUsername: string
  avatarUrl: string | null
  map: OgMapData
}

export function renderProfileImage(opts: ProfileImageData): ImageResponse {
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
        }}
      >
        <ConstellationOG
          width={width}
          height={height}
          territories={opts.map.territories}
          landmarks={opts.map.landmarks}
          showHeroLabels={true}
        />
      </div>
    ),
    { width, height },
  )
}

export function renderPrivatePlaceholder(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: '#0b1020',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span
            style={{
              color: '#94a3b8',
              fontSize: 32,
              fontWeight: 600,
              fontFamily: 'system-ui',
            }}
          >
            Private constellation
          </span>
          <span style={{ color: '#64748b', fontSize: 20, marginTop: 8, fontFamily: 'system-ui' }}>
            devastra.app
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
