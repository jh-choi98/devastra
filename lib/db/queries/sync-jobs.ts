import 'server-only'

import { desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { syncJobs } from '@/lib/db/schema/sync-jobs'
import { withUserScope, withUserScopeAnd } from './_helpers'

export type DbSyncJob = typeof syncJobs.$inferSelect
export type SyncJobKind = 'initial' | 'incremental' | 'manual' | 'backfill'
export type SyncJobProgress = {
  repos_analyzed: number
  total: number
  current_step: string
}

export async function createSyncJob(params: {
  userId: string
  kind: SyncJobKind
  progress?: SyncJobProgress
}): Promise<DbSyncJob> {
  const [job] = await db
    .insert(syncJobs)
    .values({
      userId: params.userId,
      kind: params.kind,
      status: 'pending',
      progress: params.progress,
    })
    .returning()
  return job
}

export async function startSyncJob(id: string): Promise<void> {
  await db
    .update(syncJobs)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(syncJobs.id, id))
}

export async function completeSyncJob(id: string): Promise<void> {
  await db
    .update(syncJobs)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(syncJobs.id, id))
}

export async function failSyncJob(id: string, error: string): Promise<void> {
  await db
    .update(syncJobs)
    .set({ status: 'failed', completedAt: new Date(), error })
    .where(eq(syncJobs.id, id))
}

export async function updateSyncJobProgress(
  id: string,
  progress: SyncJobProgress,
): Promise<void> {
  await db
    .update(syncJobs)
    .set({ progress })
    .where(eq(syncJobs.id, id))
}

export async function getLatestSyncJobForUser(userId: string): Promise<DbSyncJob | null> {
  const [job] = await db
    .select()
    .from(syncJobs)
    .where(withUserScope(userId, syncJobs.userId))
    .orderBy(desc(syncJobs.createdAt))
    .limit(1)
  return job ?? null
}

export async function getLatestStartedSyncJobForUser(
  userId: string,
): Promise<DbSyncJob | null> {
  const [job] = await db
    .select()
    .from(syncJobs)
    .where(withUserScopeAnd(userId, syncJobs.userId, isNotNull(syncJobs.startedAt)))
    .orderBy(desc(syncJobs.startedAt))
    .limit(1)
  return job ?? null
}
