import 'server-only'

import { and, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { syncJobs } from '@/lib/db/schema/sync-jobs'
import type { GetStepTools } from 'inngest'
import type { inngest } from '@/lib/inngest/client'

type StepTools = GetStepTools<typeof inngest>

export async function run(step: StepTools): Promise<{ updated: number }> {
  const updated = await step.run('cleanup-stuck-jobs', async () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    const result = await db
      .update(syncJobs)
      .set({
        status: 'failed',
        error: 'timeout (>30min running)',
        completedAt: new Date(),
      })
      .where(
        and(
          sql`${syncJobs.status} = 'running'`,
          lt(syncJobs.startedAt, thirtyMinutesAgo),
        ),
      )
      .returning({ id: syncJobs.id })
    return result.length
  })
  return { updated }
}
