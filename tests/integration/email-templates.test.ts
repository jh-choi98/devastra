import { render } from '@react-email/components'
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { WeeklyRecapActive } from '@/lib/email/templates/WeeklyRecapActive'
import { WeeklyRecapEmpty } from '@/lib/email/templates/WeeklyRecapEmpty'
import { WeeklyRecapFirstWeek } from '@/lib/email/templates/WeeklyRecapFirstWeek'

const mockHighlights = {
  active: {
    kind: 'active' as const,
    slot_1: { kind: 'stage_up' as const, cluster_type: 'backend_fortress' as const, from_stage: 1, to_stage: 2 },
    slot_2: { kind: 'new_stars' as const, tech_keys: ['docker', 'postgres'] },
    slot_3: { kind: 'activity' as const, active_days: 5, commits: 12, prs_shipped: 3 },
    subject_pick: 'stage_up_backend_fortress',
    preview_text: 'Backend expanded · 2 new stars · 12 commits',
  },
  empty: {
    kind: 'empty' as const,
    subject_pick: 'empty',
    preview_text: 'Steady week — your constellation is the same.',
  },
  firstWeek: {
    kind: 'first_week' as const,
    slot_2: { kind: 'new_stars' as const, tech_keys: ['typescript'] },
    subject_pick: 'first_week',
    preview_text: 'Your first star: TypeScript',
  },
}

describe('email templates', () => {
  const baseProps = {
    ogUrl: 'https://example.test/og.png',
    ctaUrl: 'https://example.test/?from=recap',
    unsubscribeUrl: 'https://example.test/unsubscribe?token=xxx',
    displayUsername: 'tester',
  }

  it('renders active variant', async () => {
    const html = await render(WeeklyRecapActive({ ...baseProps, highlights: mockHighlights.active }))
    expect(html).toMatchSnapshot()
  })

  it('renders empty variant', async () => {
    const html = await render(WeeklyRecapEmpty({ ...baseProps, highlights: mockHighlights.empty }))
    expect(html).toMatchSnapshot()
  })

  it('renders first-week variant with a first star', async () => {
    const html = await render(WeeklyRecapFirstWeek({ ...baseProps, highlights: mockHighlights.firstWeek }))
    expect(html).toMatchSnapshot()
  })
})
