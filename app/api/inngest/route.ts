import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import {
  initialSync,
  incrementalSync,
  manualRefresh,
  weeklyRecapGenerate,
  weeklyRecapSend,
  syncCleanup,
  backfill,
} from '@/features/sync/runner'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    initialSync,
    incrementalSync,
    manualRefresh,
    weeklyRecapGenerate,
    weeklyRecapSend,
    syncCleanup,
    backfill,
  ],
})
