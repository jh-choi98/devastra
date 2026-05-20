import 'server-only'

import { isStaleActiveSyncJob } from './stale-jobs'
import type { DbSyncJob } from '@/lib/db/queries/sync-jobs'

export const MANUAL_REFRESH_COOLDOWN_MS = 5 * 60 * 1000

export type ManualRefreshGate =
  | { status: 'ready' }
  | {
      status: 'already_syncing'
      jobId: string
      kind: string
      jobStatus: string
      startedAt: Date | null
    }
  | {
      status: 'cooldown'
      retryAfterSeconds: number
      cooldownUntil: Date
    }

export function getManualRefreshGate(params: {
  latestJob: DbSyncJob | null
  latestStartedJob: DbSyncJob | null
  now?: Date
}): ManualRefreshGate {
  const { latestJob, latestStartedJob, now = new Date() } = params

  if (
    (latestJob?.status === 'pending' || latestJob?.status === 'running') &&
    !isStaleActiveSyncJob(latestJob, now)
  ) {
    return {
      status: 'already_syncing',
      jobId: latestJob.id,
      kind: latestJob.kind,
      jobStatus: latestJob.status,
      startedAt: latestJob.startedAt,
    }
  }

  if (latestStartedJob?.startedAt) {
    const cooldownUntil = new Date(
      latestStartedJob.startedAt.getTime() + MANUAL_REFRESH_COOLDOWN_MS,
    )
    if (cooldownUntil > now) {
      return {
        status: 'cooldown',
        retryAfterSeconds: Math.max(1, Math.ceil((cooldownUntil.getTime() - now.getTime()) / 1000)),
        cooldownUntil,
      }
    }
  }

  return { status: 'ready' }
}
