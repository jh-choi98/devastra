import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'

// ── server-only and DB mocks ──────────────────────────────────────────────────
vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/client', () => ({ db: {} }))

// ── territory/catalog imports (no DB) ────────────────────────────────────────
vi.mock('@/features/territories/tech-catalog', () => ({
  TECH_CATALOG: [
    { tech_key: 'typescript', landmarkName: 'TypeScript Pavilion', territory: 'frontend_land', rules: [] },
    { tech_key: 'rust', landmarkName: 'Rust Bastion', territory: 'backend_fortress', rules: [] },
  ],
}))

// ── Drizzle ORM mock ──────────────────────────────────────────────────────────
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}

// We'll override individual query chains per test
vi.mock('@/lib/db/client', () => ({ db: mockDb }))

// ── email/resend mocks ────────────────────────────────────────────────────────
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: vi.fn() } } }))

// ── time helpers ──────────────────────────────────────────────────────────────
import { computeLastFullWeekUtcMonday, computeSendAtSundayLocal } from '@/features/recap/time'

describe('computeLastFullWeekUtcMonday', () => {
  it('returns the Monday of the previous full UTC week', () => {
    // 2026-05-13 (Wednesday)
    const now = new Date('2026-05-13T12:00:00Z')
    const result = computeLastFullWeekUtcMonday(now)
    // Previous Monday: 2026-05-04
    expect(result.toISOString().startsWith('2026-05-04')).toBe(true)
    expect(result.getUTCHours()).toBe(0)
    expect(result.getUTCMinutes()).toBe(0)
  })

  it('returns the previous Monday when called on a Sunday', () => {
    // 2026-05-17 (Sunday)
    const now = new Date('2026-05-17T23:00:00Z')
    const result = computeLastFullWeekUtcMonday(now)
    // Previous Monday: 2026-05-04
    expect(result.toISOString().startsWith('2026-05-04')).toBe(true)
  })

  it('returns the correct Monday when called on a Monday', () => {
    // 2026-05-18 (Monday)
    const now = new Date('2026-05-18T09:00:00Z')
    const result = computeLastFullWeekUtcMonday(now)
    // Previous week Monday: 2026-05-11
    expect(result.toISOString().startsWith('2026-05-11')).toBe(true)
  })
})

describe('computeSendAtSundayLocal', () => {
  it('returns a date with Sunday in the given timezone', () => {
    // Use a known date: 2026-05-13 Wednesday
    const now = new Date('2026-05-13T12:00:00Z')
    const result = computeSendAtSundayLocal('UTC', now)
    expect(result.getUTCDay()).toBe(0) // 0 = Sunday
  })

  it('returns a future date for UTC timezone', () => {
    const now = new Date('2026-05-13T12:00:00Z')
    const result = computeSendAtSundayLocal('UTC', now)
    expect(result.getTime()).toBeGreaterThan(now.getTime())
  })
})

// ── summarizeForEmail ─────────────────────────────────────────────────────────
import { summarizeForEmail } from '@/features/recap/diff'
import type { RecapHighlights } from '@/features/recap/generate'

const sampleHighlights: RecapHighlights = {
  topGrowth: { territory: 'backend_fortress', pct: 18 },
  newLandmarks: [{ tech_key: 'rust', landmarkName: 'Rust Bastion', territory: 'backend_fortress' }],
  stageUps: [],
  stats: { activeDays: 5, prsShipped: 3, totalCommits: 12 },
}

describe('summarizeForEmail', () => {
  it('returns up to 3 lines for active week', () => {
    const { lines } = summarizeForEmail(sampleHighlights, true)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.length).toBeLessThanOrEqual(3)
  })

  it('includes growth info when topGrowth present', () => {
    const { lines } = summarizeForEmail(sampleHighlights, true)
    expect(lines.some((l) => l.includes('grew') && l.includes('18%'))).toBe(true)
  })

  it('includes new landmark name', () => {
    const { lines } = summarizeForEmail(sampleHighlights, true)
    expect(lines.some((l) => l.includes('Rust Bastion'))).toBe(true)
  })

  it('includes stats line', () => {
    const { lines } = summarizeForEmail(sampleHighlights, true)
    expect(lines.some((l) => l.includes('active day') || l.includes('PR'))).toBe(true)
  })

  it('returns steady week copy for inactive week', () => {
    const { lines } = summarizeForEmail(sampleHighlights, false)
    expect(lines).toEqual(['Steady week.', 'See you next Sunday.'])
  })
})

// ── React Email template smoke test ──────────────────────────────────────────
import { render } from '@react-email/components'
import { WeeklyRecap } from '@/lib/email/templates/WeeklyRecap'
import { WeeklyRecapEmpty } from '@/lib/email/templates/WeeklyRecapEmpty'

describe('WeeklyRecap template', () => {
  it('renders without throwing', async () => {
    const html = await render(
      WeeklyRecap({
        recapId: 'test-recap-id',
        username: 'testuser',
        highlights: sampleHighlights,
      }),
    )
    expect(html).toContain('See your full world')
  })
})

describe('WeeklyRecapEmpty template', () => {
  it('renders without throwing', async () => {
    const html = await render(
      WeeklyRecapEmpty({
        username: 'testuser',
      }),
    )
    expect(html).toContain('See your full world')
  })
})
