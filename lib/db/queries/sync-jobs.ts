import 'server-only'

import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { syncJobs } from '@/lib/db/schema/sync-jobs'

export type DbSyncJob = typeof syncJobs.$inferSelect

export async function createSyncJob(params: {
  userId: string
  kind: 'initial' | 'incremental' | 'manual' | 'backfill'
}): Promise<DbSyncJob> {
  const [job] = await db
    .insert(syncJobs)
    .values({ userId: params.userId, kind: params.kind, status: 'pending' })
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

export async function getLatestSyncJobForUser(userId: string): Promise<DbSyncJob | null> {
  const [job] = await db
    .select()
    .from(syncJobs)
    .where(eq(syncJobs.userId, userId))
    .orderBy(desc(syncJobs.startedAt))
    .limit(1)
  return job ?? null
}
