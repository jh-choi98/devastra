import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock server-only and DB deps
vi.mock('@/lib/db/client', () => ({ db: {} }))
vi.mock('@/lib/auth/supabase-browser', () => ({
  createBrowserClient: vi.fn(),
}))

import {
  mergeTerritoryUpdate,
  mergeLandmarkUpdate,
} from '@/lib/realtime/use-realtime-map-data'
import {
  computeRevealDuration,
  formatSyncProgressText,
} from '@/app/(authenticated)/_use-reveal-sequence'
import type { ConstellationData } from '@/app/_components/Constellation/Constellation'

const BASE_MAP_DATA: ConstellationData = {
  userId: 'user-1',
  territories: [],
  landmarks: [],
  diffSince: null,
}

// ---------------------------------------------------------------------------
// Territory merge logic
// ---------------------------------------------------------------------------
describe('reveal-flow — territory UPSERT events', () => {
  it('inserts new territory into empty state', () => {
    const row = {
      type: 'frontend_land',
      stage: 2,
      total_weight: '120',
      growth_30d: '40',
      stage_changed_at: '2026-05-01T00:00:00Z',
    }
    const result = mergeTerritoryUpdate(BASE_MAP_DATA.territories, row)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('frontend_land')
    expect(result[0].stage).toBe(2)
    expect(result[0].totalWeight).toBe(120)
    expect(result[0].growth30d).toBe(40)
    expect(result[0].stageChangedAt).toBe('2026-05-01T00:00:00Z')
  })

  it('updates existing territory on UPDATE event', () => {
    const existing = [
      {
        type: 'frontend_land' as const,
        stage: 1,
        totalWeight: 30,
        growth30d: 10,
        stageChangedAt: null,
      },
    ]
    const row = {
      type: 'frontend_land',
      stage: 2,
      total_weight: '120',
      growth_30d: '50',
      stage_changed_at: '2026-05-10T00:00:00Z',
    }
    const result = mergeTerritoryUpdate(existing, row)
    expect(result).toHaveLength(1)
    expect(result[0].stage).toBe(2)
    expect(result[0].totalWeight).toBe(120)
    expect(result[0].stageChangedAt).toBe('2026-05-10T00:00:00Z')
  })

  it('appends new territory without removing existing ones', () => {
    const existing = [
      {
        type: 'backend_fortress' as const,
        stage: 3,
        totalWeight: 300,
        growth30d: 80,
        stageChangedAt: null,
      },
    ]
    const row = {
      type: 'frontend_land',
      stage: 1,
      total_weight: '30',
      growth_30d: '30',
      stage_changed_at: null,
    }
    const result = mergeTerritoryUpdate(existing, row)
    expect(result).toHaveLength(2)
    expect(result.find((t) => t.type === 'backend_fortress')).toBeDefined()
    expect(result.find((t) => t.type === 'frontend_land')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Landmark merge logic
// ---------------------------------------------------------------------------
describe('reveal-flow — landmark UPSERT events', () => {
  it('inserts new landmark', () => {
    const row = {
      tech_key: 'react',
      territory_type: 'frontend_land',
      weight: '8',
      first_unlocked_at: '2026-05-01T00:00:00Z',
    }
    const result = mergeLandmarkUpdate(BASE_MAP_DATA.landmarks, row)
    expect(result).toHaveLength(1)
    expect(result[0].tech_key).toBe('react')
    expect(result[0].weight).toBe(8)
    expect(result[0].territory).toBe('frontend_land')
  })

  it('updates existing landmark weight on growth', () => {
    const existing = [
      {
        tech_key: 'react',
        territory: 'frontend_land' as const,
        weight: 5,
        firstUnlockedAt: '2026-04-01T00:00:00Z',
      },
    ]
    const row = {
      tech_key: 'react',
      territory_type: 'frontend_land',
      weight: '12',
      first_unlocked_at: '2026-04-01T00:00:00Z',
    }
    const result = mergeLandmarkUpdate(existing, row)
    expect(result).toHaveLength(1)
    expect(result[0].weight).toBe(12)
    expect(result[0].firstUnlockedAt).toBe('2026-04-01T00:00:00Z')
  })
})

// ---------------------------------------------------------------------------
// Sync progress text
// ---------------------------------------------------------------------------
describe('reveal-flow — sync progress text', () => {
  it('returns null when status is not running', () => {
    expect(formatSyncProgressText(null, null)).toBeNull()
    expect(formatSyncProgressText(null, 'completed')).toBeNull()
    expect(formatSyncProgressText(null, 'pending')).toBeNull()
  })

  it('returns generic "Syncing..." when running with no progress', () => {
    expect(formatSyncProgressText(null, 'running')).toBe('Syncing...')
  })

  it('formats progress with repos_analyzed and total', () => {
    const progress = { repos_analyzed: 12, total: 20, current_step: '' }
    const text = formatSyncProgressText(progress, 'running')
    expect(text).toContain('12')
    expect(text).toContain('20')
  })

  it('uses current_step when provided', () => {
    const progress = { repos_analyzed: 5, total: 10, current_step: 'Fetching commits...' }
    expect(formatSyncProgressText(progress, 'running')).toBe('Fetching commits...')
  })
})

// ---------------------------------------------------------------------------
// Reveal sequence timing
// ---------------------------------------------------------------------------
describe('reveal-flow — reveal sequence timing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('firstReveal uses 45-second cinematic duration', () => {
    expect(computeRevealDuration(true)).toBe(45_000)
  })

  it('returning user uses 3-second short duration', () => {
    expect(computeRevealDuration(false)).toBe(3_000)
  })

  it('revealComplete becomes true after cinematic timeout', () => {
    const duration = computeRevealDuration(true)
    let complete = false

    const timer = setTimeout(() => {
      complete = true
    }, duration)

    expect(complete).toBe(false)
    vi.advanceTimersByTime(duration)
    expect(complete).toBe(true)

    clearTimeout(timer)
  })

  it('revealComplete becomes true after short timeout for returning user', () => {
    const duration = computeRevealDuration(false)
    let complete = false

    const timer = setTimeout(() => {
      complete = true
    }, duration)

    vi.advanceTimersByTime(duration - 1)
    expect(complete).toBe(false)
    vi.advanceTimersByTime(1)
    expect(complete).toBe(true)

    clearTimeout(timer)
  })
})
