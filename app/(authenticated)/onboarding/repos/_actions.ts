'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { upsertRepository } from '@/lib/db/queries/repositories'
import { inngest } from '@/lib/inngest/client'
import { EVENTS } from '@/features/sync/events'
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

  const upserted = await Promise.all(
    repos.map((repo) =>
      upsertRepository({
        userId: user.id,
        source: 'github',
        externalRepoId: repo.externalRepoId,
        owner: repo.owner,
        name: repo.name,
        primaryLanguage: repo.primaryLanguage,
        isIncluded: includedSet.has(repo.externalRepoId),
      }),
    ),
  )

  const includedRepoIds = upserted
    .filter((r) => includedSet.has(r.externalRepoId))
    .map((r) => r.id)

  await inngest.send({
    name: EVENTS.SYNC_INITIAL_REQUESTED,
    data: { userId: user.id, includedRepoIds },
  })

  redirect('/')
}
