import { render } from '@react-email/components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HighlightsPayload } from '@/features/recap/slot-builder'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => {
  const selectResults: unknown[][] = []
  const resendSend = vi.fn()
  const insertValues = vi.fn(async () => undefined)
  const updateWhere = vi.fn(async () => undefined)
  const updateSet = vi.fn(() => ({ where: updateWhere }))

  const db = {
    select: vi.fn(() => {
      const rows = selectResults.shift() ?? []
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => rows),
          })),
        })),
      }
    }),
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({ set: updateSet })),
  }

  return { db, selectResults, resendSend, insertValues, updateSet, updateWhere }
})

vi.mock('@/lib/db/client', () => ({ db: mocks.db }))
vi.mock('@/lib/email/client', () => ({
  resend: { emails: { send: mocks.resendSend } },
}))
vi.mock('@/lib/email/unsubscribe-token', () => ({
  signUnsubscribeToken: vi.fn(async () => 'signed-unsubscribe-token'),
}))
vi.mock('@/lib/og/version', () => ({
  ogVersionParam: () => 'v=email-test',
}))

import { sendWeeklyRecapEmail } from '@/features/recap/send'

const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL

const activeHighlights: HighlightsPayload = {
  kind: 'active',
  slot_1: {
    kind: 'stage_up',
    cluster_type: 'backend_fortress',
    from_stage: 1,
    to_stage: 2,
  },
  slot_2: { kind: 'new_stars', tech_keys: ['docker', 'postgres'] },
  slot_3: { kind: 'activity', active_days: 5, commits: 12, prs_shipped: 3 },
  subject_pick: 'stage_up_backend_fortress',
  preview_text: 'Backend expanded · 2 new stars · 12 commits',
}

describe('weekly recap send e2e', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectResults.length = 0
    process.env.NEXT_PUBLIC_BASE_URL = 'https://example.test'
  })

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_URL
    } else {
      process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl
    }
  })

  it('builds a Resend delivery with the active recap content and records the send', async () => {
    const recapId = '00000000-0000-4000-8000-000000000001'
    const userId = '00000000-0000-4000-8000-000000000002'

    mocks.selectResults.push(
      [{ id: recapId, userId, weekStart: '2026-05-11', highlights: activeHighlights }],
      [
        {
          id: userId,
          email: 'recipient@example.test',
          displayUsername: 'tester',
          emailRecapEnabled: true,
        },
      ],
    )
    mocks.resendSend.mockResolvedValueOnce({ data: { id: 'resend-message-123' } })

    await sendWeeklyRecapEmail({ recapId })

    expect(mocks.resendSend).toHaveBeenCalledTimes(1)
    const payload = mocks.resendSend.mock.calls[0][0]
    expect(payload).toMatchObject({
      from: 'DevAstra <hello@devastra.app>',
      to: 'recipient@example.test',
      subject: 'Backend cluster expanded',
      headers: {
        'List-Unsubscribe': '<https://example.test/unsubscribe?token=signed-unsubscribe-token>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
    expect(payload.react).toBeTruthy()

    const html = await render(payload.react)
    expect(html).toContain('Backend expanded · 2 new stars · 12 commits')
    expect(html).toContain('Backend cluster expanded')
    expect(html).toContain('Docker, Postgres are new this week')
    expect(html).toContain('5 active days')
    expect(html).toContain('12 commits')
    expect(html).toContain('3 PRs shipped')
    expect(html).toContain('https://example.test/api/og/recap/00000000-0000-4000-8000-000000000001?v=email-test')
    expect(html).toContain('https://example.test/?from=recap&amp;week=2026-05-11')
    expect(html).toContain('https://example.test/unsubscribe?token=signed-unsubscribe-token')

    expect(mocks.insertValues).toHaveBeenCalledWith({
      userId,
      emailType: 'weekly_recap_active',
      relatedId: recapId,
      externalMessageId: 'resend-message-123',
      bounced: false,
    })
    expect(mocks.updateSet).toHaveBeenCalledWith({ emailSentAt: expect.any(Date) })
  })

  it('does not send when the user disabled weekly recaps before delivery time', async () => {
    mocks.selectResults.push(
      [
        {
          id: '00000000-0000-4000-8000-000000000003',
          userId: '00000000-0000-4000-8000-000000000004',
          weekStart: '2026-05-11',
          highlights: activeHighlights,
        },
      ],
      [
        {
          id: '00000000-0000-4000-8000-000000000004',
          email: 'recipient@example.test',
          displayUsername: 'tester',
          emailRecapEnabled: false,
        },
      ],
    )

    await sendWeeklyRecapEmail({ recapId: '00000000-0000-4000-8000-000000000003' })

    expect(mocks.resendSend).not.toHaveBeenCalled()
    expect(mocks.insertValues).not.toHaveBeenCalled()
    expect(mocks.updateSet).not.toHaveBeenCalled()
  })

  it('throws and does not record a send when Resend rejects the delivery', async () => {
    mocks.selectResults.push(
      [
        {
          id: '00000000-0000-4000-8000-000000000005',
          userId: '00000000-0000-4000-8000-000000000006',
          weekStart: '2026-05-11',
          highlights: activeHighlights,
        },
      ],
      [
        {
          id: '00000000-0000-4000-8000-000000000006',
          email: 'recipient@example.test',
          displayUsername: 'tester',
          emailRecapEnabled: true,
        },
      ],
    )
    mocks.resendSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'domain is not verified' },
    })

    await expect(
      sendWeeklyRecapEmail({ recapId: '00000000-0000-4000-8000-000000000005' }),
    ).rejects.toThrow('Resend email send failed: domain is not verified')

    expect(mocks.insertValues).not.toHaveBeenCalled()
    expect(mocks.updateSet).not.toHaveBeenCalled()
  })
})
