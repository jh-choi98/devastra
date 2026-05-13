import 'server-only'

import { ImageResponse } from 'next/og'
import { OG_TERRITORY_COLORS, OG_TERRITORY_NAMES } from './shared'
import type { TerritoryType } from '@/features/territories/registry'

export type RecapHighlights = {
  top_growth: { territory: string; pct: number } | null
  new_landmarks: string[]
  stage_ups: Array<{ territory: string; from: number; to: number }>
  stats: { active_days: number; prs_shipped: number }
}

export type RecapImageData = {
  displayUsername: string
  avatarUrl: string | null
  weekStart: string
  highlights: RecapHighlights
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
        <span style={{ color: '#64748b', fontSize: '32px', fontWeight: 600 }}>DevAtlas</span>
        <span style={{ color: '#475569', fontSize: '20px' }}>Weekly Recap</span>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}

export function renderRecapImage(data: RecapImageData): ImageResponse {
  const { displayUsername, avatarUrl, weekStart, highlights } = data
  const topGrowth = highlights.top_growth
  const topGrowthColor = topGrowth
    ? (OG_TERRITORY_COLORS[topGrowth.territory as TerritoryType] ?? '#7C9DFF')
    : '#7C9DFF'
  const topGrowthName = topGrowth
    ? (OG_TERRITORY_NAMES[topGrowth.territory as TerritoryType] ?? topGrowth.territory)
    : null

  const weekLabel = new Date(weekStart).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

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
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '32px',
          }}
        >
          <span style={{ color: '#64748b', fontSize: '22px', fontWeight: 600 }}>
            DevAtlas Weekly Recap
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                width={48}
                height={48}
                style={{ borderRadius: '50%' }}
                alt=""
              />
            )}
            <span style={{ color: '#f1f5f9', fontSize: '28px', fontWeight: 700 }}>
              @{displayUsername}
            </span>
          </div>
        </div>

        {/* Week label */}
        <div style={{ display: 'flex', marginBottom: '28px' }}>
          <span style={{ color: '#94a3b8', fontSize: '18px' }}>Week of {weekLabel}</span>
        </div>

        {/* Main highlight */}
        {topGrowthName && topGrowth && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              marginBottom: '32px',
              backgroundColor: topGrowthColor + '1A',
              border: `2px solid ${topGrowthColor}44`,
              borderRadius: '16px',
              padding: '24px 32px',
            }}
          >
            <span style={{ color: topGrowthColor, fontSize: '64px', fontWeight: 800 }}>
              +{topGrowth.pct}%
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: 600 }}>
                {topGrowthName} grew this week
              </span>
              <span style={{ color: '#94a3b8', fontSize: '16px' }}>Top territory growth</span>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '24px', marginTop: 'auto' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              padding: '16px 32px',
              border: '1px solid #334155',
            }}
          >
            <span style={{ color: '#7C9DFF', fontSize: '40px', fontWeight: 800 }}>
              {highlights.stats.active_days}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>Active days</span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              padding: '16px 32px',
              border: '1px solid #334155',
            }}
          >
            <span style={{ color: '#10B981', fontSize: '40px', fontWeight: 800 }}>
              {highlights.stats.prs_shipped}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>PRs shipped</span>
          </div>
          {highlights.new_landmarks.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: '#1e293b',
                borderRadius: '12px',
                padding: '16px 32px',
                border: '1px solid #334155',
              }}
            >
              <span style={{ color: '#A78BFA', fontSize: '40px', fontWeight: 800 }}>
                {highlights.new_landmarks.length}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>New landmarks</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <span style={{ color: '#475569', fontSize: '14px' }}>devatlas.app</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
