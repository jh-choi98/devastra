import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => {
  const createFunction = vi.fn(
    (
      options: unknown,
      trigger: unknown,
      handler: (args: { step: MockStep }) => Promise<void>,
    ) => ({ options, trigger, handler }),
  )
  const listUsersForRecap = vi.fn()
  const generateWeeklyRecapForUser = vi.fn()
  const sendWeeklyRecapEmail = vi.fn()

  return {
    createFunction,
    listUsersForRecap,
    generateWeeklyRecapForUser,
    sendWeeklyRecapEmail,
  }
})

type MockStep = {
  run: ReturnType<typeof vi.fn>
  sendEvent: ReturnType<typeof vi.fn>
}

vi.mock('@/lib/inngest/client', () => ({
  inngest: { createFunction: mocks.createFunction },
}))
vi.mock('@/features/recap/generate', () => ({
  listUsersForRecap: mocks.listUsersForRecap,
  generateWeeklyRecapForUser: mocks.generateWeeklyRecapForUser,
}))
vi.mock('@/features/recap/send', () => ({
  sendWeeklyRecapEmail: mocks.sendWeeklyRecapEmail,
}))

import { weeklyRecapGenerate } from '@/features/sync/runner'
import { EVENTS } from '@/features/sync/events'

describe('weekly recap fan-out', () => {
  it('generates recaps for eligible users and schedules sends at Sunday 6 PM local time', async () => {
    mocks.listUsersForRecap.mockResolvedValue([
      {
        id: 'eligible-utc',
        timezone: 'UTC',
        email: 'utc@example.test',
        displayUsername: 'utc-user',
      },
      {
        id: 'eligible-seoul',
        timezone: 'Asia/Seoul',
        email: 'seoul@example.test',
        displayUsername: 'seoul-user',
      },
      {
        id: 'eligible-quiet',
        timezone: 'America/Toronto',
        email: 'quiet@example.test',
        displayUsername: 'quiet-user',
      },
    ])
    mocks.generateWeeklyRecapForUser.mockImplementation(async ({ userId }: { userId: string }) => ({
      recapId: `recap-${userId}`,
      kind: userId === 'eligible-quiet' ? 'empty' : 'active',
      shouldSend: userId !== 'eligible-quiet',
    }))

    const sentEvents: Array<{ id: string; event: { name: string; data: unknown; ts: number } }> = []
    const step: MockStep = {
      run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
      sendEvent: vi.fn(async (id: string, event: { name: string; data: unknown; ts: number }) => {
        sentEvents.push({ id, event })
      }),
    }

    await (
      weeklyRecapGenerate as unknown as {
        handler(args: { step: MockStep }): Promise<void>
      }
    ).handler({ step })

    expect(mocks.listUsersForRecap).toHaveBeenCalledTimes(1)
    expect(mocks.generateWeeklyRecapForUser).toHaveBeenCalledTimes(3)
    expect(sentEvents).toHaveLength(2)
    expect(sentEvents.map((entry) => entry.id)).toEqual([
      'recap/email.send-eligible-utc',
      'recap/email.send-eligible-seoul',
    ])

    for (const entry of sentEvents) {
      expect(entry.event.name).toBe(EVENTS.RECAP_EMAIL_SEND)
      expect(entry.event.data).toEqual({
        recapId: entry.id.endsWith('eligible-utc')
          ? 'recap-eligible-utc'
          : 'recap-eligible-seoul',
      })
    }

    expectLocalSundayAtSix(sentEvents[0].event.ts, 'UTC')
    expectLocalSundayAtSix(sentEvents[1].event.ts, 'Asia/Seoul')
  })
})

function expectLocalSundayAtSix(timestamp: number, timezone: string): void {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp))
  const value = (type: string) => parts.find((part) => part.type === type)?.value

  expect(value('weekday')).toBe('Sun')
  expect(value('hour')).toBe('18')
  expect(value('minute')).toBe('00')
}
