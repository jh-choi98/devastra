import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { getLatestSyncJobForUser } from '@/lib/db/queries/sync-jobs'
import { failStaleActiveSyncJobsForUser, isStaleActiveSyncJob } from '@/features/sync/stale-jobs'

export async function GET(): Promise<NextResponse> {
  const user = await requireUser()
  let job = await getLatestSyncJobForUser(user.id)
  if (job && isStaleActiveSyncJob(job)) {
    await failStaleActiveSyncJobsForUser(user.id)
    job = await getLatestSyncJobForUser(user.id)
  }
  if (!job) return NextResponse.json(null)

  const rawProgress = job.progress
  const progress =
    rawProgress && typeof rawProgress === 'object' && !Array.isArray(rawProgress)
      ? {
          repos_analyzed: Number((rawProgress as Record<string, unknown>).repos_analyzed ?? 0),
          total: Number((rawProgress as Record<string, unknown>).total ?? 0),
          current_step:
            typeof (rawProgress as Record<string, unknown>).current_step === 'string'
              ? String((rawProgress as Record<string, unknown>).current_step)
              : '',
        }
      : null

  return NextResponse.json({
    id: job.id,
    kind: job.kind,
    status: job.status,
    progress,
    startedAt: job.startedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
  })
}
