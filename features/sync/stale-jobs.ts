import 'server-only'

import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { syncJobs } from '@/lib/db/schema/sync-jobs'
import { withUserScopeAnd } from '@/lib/db/queries/_helpers'
import type { DbSyncJob } from '@/lib/db/queries/sync-jobs'

export const SYNC_JOB_TIMEOUT_MS = 30 * 60 * 1000
export const SYNC_JOB_TIMEOUT_ERROR = 'timeout (>30min running)'

const ACTIVE_SYNC_STATUSES = ['pending', 'running']

type SyncJobStalenessInput = Pick<DbSyncJob, 'status' | 'startedAt' | 'createdAt'>

export function isStaleActiveSyncJob(job: SyncJobStalenessInput, now: Date = new Date()): boolean {
  if (!ACTIVE_SYNC_STATUSES.includes(job.status)) return false
  const anchor = job.startedAt ?? job.createdAt
  return now.getTime() - anchor.getTime() > SYNC_JOB_TIMEOUT_MS
}

function staleActiveJobCondition(cutoff: Date) {
  return or(
    and(eq(syncJobs.status, 'pending'), lt(syncJobs.createdAt, cutoff)),
    and(eq(syncJobs.status, 'running'), lt(syncJobs.startedAt, cutoff)),
    and(eq(syncJobs.status, 'running'), isNull(syncJobs.startedAt), lt(syncJobs.createdAt, cutoff)),
  )
}

export async function failStaleActiveSyncJobs(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SYNC_JOB_TIMEOUT_MS)
  const result = await db
    .update(syncJobs)
    .set({
      status: 'failed',
      error: SYNC_JOB_TIMEOUT_ERROR,
      completedAt: now,
    })
    .where(staleActiveJobCondition(cutoff))
    .returning({ id: syncJobs.id })
  return result.length
}

export async function failStaleActiveSyncJobsForUser(
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - SYNC_JOB_TIMEOUT_MS)
  const result = await db
    .update(syncJobs)
    .set({
      status: 'failed',
      error: SYNC_JOB_TIMEOUT_ERROR,
      completedAt: now,
    })
    .where(withUserScopeAnd(userId, syncJobs.userId, staleActiveJobCondition(cutoff)))
    .returning({ id: syncJobs.id })
  return result.length
}
