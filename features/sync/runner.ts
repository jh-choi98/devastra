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

// Phase 10 stubs: registered here so the route compiles
export const weeklyRecapGenerate = inngest.createFunction(
  { id: 'recap-generate', name: 'Generate weekly recap' },
  { cron: '0 9 * * 0' },
  async () => {
    throw new Error('Implemented in Phase 10')
  },
)

export const weeklyRecapSend = inngest.createFunction(
  { id: 'recap-send', name: 'Send recap email' },
  { event: EVENTS.RECAP_EMAIL_SEND },
  async () => {
    throw new Error('Implemented in Phase 10')
  },
)
