import 'server-only'

import { failStaleActiveSyncJobs } from './stale-jobs'
import type { GetStepTools } from 'inngest'
import type { inngest } from '@/lib/inngest/client'

type StepTools = GetStepTools<typeof inngest>

export async function run(step: StepTools): Promise<{ updated: number }> {
  const updated = await step.run('cleanup-stuck-jobs', () => failStaleActiveSyncJobs())
  return { updated }
}
