import 'server-only'

import { ImageResponse } from 'next/og'
import { getTopTerritories, OG_TERRITORY_COLORS, OG_TERRITORY_NAMES } from './shared'
import type { OgMapData } from './shared'
import type { TerritoryType } from '@/features/territories/registry'

export type ProfileImageData = {
  displayUsername: string
  avatarUrl: string | null
  map: OgMapData
}

export function renderProfileImage(data: ProfileImageData): ImageResponse {
  const { displayUsername, avatarUrl, map } = data
  const topTerritories = getTopTerritories(map, 3)
  const allTerritories = [...map.territories]
    .sort((a, b) => b.totalWeight - a.totalWeight)
    .slice(0, 6)

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          padding: '48px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          <span style={{ color: '#64748b', fontSize: '22px', fontWeight: 600 }}>DevAstra</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                width={52}
                height={52}
                style={{ borderRadius: '50%' }}
                alt=""
              />
            )}
            <span style={{ color: '#f1f5f9', fontSize: '30px', fontWeight: 700 }}>
              @{displayUsername}
            </span>
          </div>
        </div>

        {/* Territory cards */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            flex: 1,
            alignContent: 'flex-start',
          }}
        >
          {allTerritories.map((t) => {
            const type = t.type as TerritoryType
            const color = OG_TERRITORY_COLORS[type] ?? '#6B7280'
            const name = OG_TERRITORY_NAMES[type] ?? type
            return (
              <div
                key={type}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: color + '33',
                  border: `2px solid ${color}66`,
                  borderRadius: '12px',
                  padding: '18px 24px',
                  minWidth: '160px',
                  gap: '6px',
                }}
              >
                <span
                  style={{
                    color: color,
                    fontSize: '13px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Stage {t.stage}
                </span>
                <span style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 600 }}>
                  {name}
                </span>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '32px',
            paddingTop: '20px',
            borderTop: '1px solid #334155',
          }}
        >
          <div style={{ display: 'flex', gap: '16px' }}>
            {topTerritories.map((t) => (
              <span
                key={t.type}
                style={{
                  backgroundColor: t.color + '44',
                  color: t.color,
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '4px 12px',
                  borderRadius: '20px',
                  border: `1px solid ${t.color}66`,
                }}
              >
                {t.name} · S{t.stage}
              </span>
            ))}
          </div>
          <span style={{ color: '#475569', fontSize: '14px' }}>devatlas.app</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
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
          background: '#0f172a',
          fontFamily: 'system-ui, sans-serif',
          gap: '16px',
        }}
      >
        <span style={{ color: '#64748b', fontSize: '32px', fontWeight: 600 }}>DevAstra</span>
        <span style={{ color: '#475569', fontSize: '20px' }}>This DevAstra is private</span>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
