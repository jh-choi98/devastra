import { NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import { requireUser } from '@/lib/auth/session'
import { EVENTS } from '@/features/sync/events'
import {
  createSyncJob,
  failSyncJob,
  getLatestStartedSyncJobForUser,
  getLatestSyncJobForUser,
} from '@/lib/db/queries/sync-jobs'
import { getManualRefreshGate } from '@/features/sync/manual-refresh-gate'
import { failStaleActiveSyncJobsForUser, isStaleActiveSyncJob } from '@/features/sync/stale-jobs'

export async function POST() {
  const user = await requireUser()
  if (!user.githubAccessTokenEnc) {
    return NextResponse.json({ status: 'github_disconnected' }, { status: 409 })
  }

  let latestJob = await getLatestSyncJobForUser(user.id)
  if (latestJob && isStaleActiveSyncJob(latestJob)) {
    await failStaleActiveSyncJobsForUser(user.id)
    latestJob = await getLatestSyncJobForUser(user.id)
  }
  const latestStartedJob = await getLatestStartedSyncJobForUser(user.id)
  const gate = getManualRefreshGate({ latestJob, latestStartedJob })

  if (gate.status === 'already_syncing') {
    return NextResponse.json(
      {
        status: gate.status,
        jobId: gate.jobId,
        kind: gate.kind,
        jobStatus: gate.jobStatus,
        startedAt: gate.startedAt?.toISOString() ?? null,
      },
      { status: 409 },
    )
  }

  if (gate.status === 'cooldown') {
    return NextResponse.json(
      {
        status: gate.status,
        retryAfterSeconds: gate.retryAfterSeconds,
        cooldownUntil: gate.cooldownUntil.toISOString(),
      },
      {
        status: 429,
        headers: { 'Retry-After': String(gate.retryAfterSeconds) },
      },
    )
  }

  const job = await createSyncJob({ userId: user.id, kind: 'manual' })

  try {
    await inngest.send({
      name: EVENTS.SYNC_MANUAL_REQUESTED,
      data: { userId: user.id, jobId: job.id },
    })
  } catch (err) {
    await failSyncJob(job.id, err instanceof Error ? err.message : String(err))
    return NextResponse.json({ status: 'dispatch_failed' }, { status: 502 })
  }

  return NextResponse.json({ status: 'queued', jobId: job.id })
}
