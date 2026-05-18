'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { upsertRepository } from '@/lib/db/queries/repositories'
import { createSyncJob, failSyncJob } from '@/lib/db/queries/sync-jobs'
import { inngest } from '@/lib/inngest/client'
import { EVENTS } from '@/features/sync/events'
import { captureServerEvent } from '@/lib/posthog-server'
import type { OnboardingRepo } from '@/lib/github/onboarding-fetch'

const SaveRepoSelectionSchema = z.object({
  includedIds: z.array(z.string()),
  repos: z.array(
    z.object({
      externalRepoId: z.string(),
      owner: z.string(),
      name: z.string(),
      primaryLanguage: z.string().nullable(),
    }),
  ),
})

export async function saveRepoSelectionAndStartSync(input: unknown): Promise<void> {
  const { includedIds, repos } = SaveRepoSelectionSchema.parse(input)
  const user = await requireUser()

  const includedSet = new Set(includedIds)

  const upserted = []
  for (const repo of repos) {
    upserted.push(
      await upsertRepository({
        userId: user.id,
        source: 'github',
        externalRepoId: repo.externalRepoId,
        owner: repo.owner,
        name: repo.name,
        primaryLanguage: repo.primaryLanguage,
        isIncluded: includedSet.has(repo.externalRepoId),
      }),
    )
  }

  // The initial sync filters by externalRepoId (GitHub node_id), NOT by DB UUID.
  // Sending r.id (UUID) here would silently fail to match anything and trigger the
  // fallback that syncs every repo. Pass externalRepoId explicitly.
  const includedExternalRepoIds = upserted
    .filter((r) => includedSet.has(r.externalRepoId))
    .map((r) => r.externalRepoId)

  const job = await createSyncJob({
    userId: user.id,
    kind: 'initial',
    progress: {
      repos_analyzed: 0,
      total: includedExternalRepoIds.length,
      current_step: 'Starting your constellation build...',
    },
  })

  try {
    await inngest.send({
      name: EVENTS.SYNC_INITIAL_REQUESTED,
      data: { userId: user.id, includedExternalRepoIds, jobId: job.id },
    })
  } catch (err) {
    await failSyncJob(job.id, err instanceof Error ? err.message : String(err))
    throw err
  }

  await captureServerEvent(user.id, 'repo_selection.completed', {
    repo_count: repos.length,
    included_count: includedExternalRepoIds.length,
  })

  redirect('/')
}
