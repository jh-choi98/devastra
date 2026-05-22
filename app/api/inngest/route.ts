import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { isEmailRecapFeatureEnabled } from '@/features/recap/feature-flag'
import {
  initialSync,
  incrementalSync,
  manualRefresh,
  weeklyRecapGenerate,
  weeklyRecapSend,
  syncCleanup,
  backfill,
} from '@/features/sync/runner'

const functions = [
  initialSync,
  incrementalSync,
  manualRefresh,
  syncCleanup,
  backfill,
  ...(isEmailRecapFeatureEnabled() ? [weeklyRecapGenerate, weeklyRecapSend] : []),
]

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
})
