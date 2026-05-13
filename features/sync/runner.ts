import 'server-only'

import { inngest } from '@/lib/inngest/client'
import { EVENTS } from './events'
import * as initial from './initial'
import * as incremental from './incremental'
import * as manual from './manual'
import * as backfill_ from './backfill'
import * as cleanup from './cleanup'

export const initialSync = inngest.createFunction(
  { id: 'sync-initial', name: 'Initial sync' },
  { event: EVENTS.SYNC_INITIAL_REQUESTED },
  async ({ event, step }) =>
    initial.run(event as { data: { userId: string; includedRepoIds?: string[] } }, step),
)

export const incrementalSync = inngest.createFunction(
  { id: 'sync-incremental', name: 'Incremental sync (daily)' },
  { cron: '0 6 * * *' },
  async ({ step }) => incremental.run(step),
)

export const manualRefresh = inngest.createFunction(
  {
    id: 'sync-manual',
    name: 'Manual refresh',
    concurrency: { key: 'event.data.userId', limit: 1 },
  },
  { event: EVENTS.SYNC_MANUAL_REQUESTED },
  async ({ event, step }) =>
    manual.run(event as { data: { userId: string } }, step),
)

export const syncCleanup = inngest.createFunction(
  { id: 'sync-cleanup', name: 'Stuck-job cleanup' },
  { cron: '*/5 * * * *' },
  async ({ step }) => cleanup.run(step),
)

export const backfill = inngest.createFunction(
  { id: 'sync-backfill', name: 'Reclassify activities' },
  { event: EVENTS.SYNC_BACKFILL_REQUESTED },
  async ({ event, step }) =>
    backfill_.run(event as { data: { userId?: string } }, step),
)

import { generateRecapForUser, listUsersForRecap } from '@/features/recap/generate'
import { sendRecapEmail } from '@/features/recap/send'
import { computeLastFullWeekUtcMonday, computeSendAtSundayLocal } from '@/features/recap/time'

export const weeklyRecapGenerate = inngest.createFunction(
  { id: 'recap-generate', name: 'Generate weekly recap' },
  { cron: '0 9 * * 0' },
  async ({ step }) => {
    const users = await step.run('list-eligible-users', () => listUsersForRecap())
    const weekStart = computeLastFullWeekUtcMonday()
    for (const u of users) {
      const recap = await step.run(`generate-${u.id}`, () =>
        generateRecapForUser(u.id, weekStart),
      )
      const sendAt = computeSendAtSundayLocal(u.timezone)
      await step.sendEvent(`recap/email.send-${u.id}`, {
        name: EVENTS.RECAP_EMAIL_SEND,
        data: { userId: u.id, recapId: recap.recapId, hasActivity: recap.hasActivity },
        ts: sendAt.getTime(),
      })
    }
  },
)

export const weeklyRecapSend = inngest.createFunction(
  { id: 'recap-send', name: 'Send recap email' },
  { event: EVENTS.RECAP_EMAIL_SEND },
  async ({ event }) => sendRecapEmail(event.data as { userId: string; recapId: string; hasActivity: boolean }),
)
