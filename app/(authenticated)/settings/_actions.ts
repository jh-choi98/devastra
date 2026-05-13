'use server'

import { z } from 'zod'
import { eq, and, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { revalidatePublicProfile } from '@/lib/cache/revalidate-profile'
import { isReserved } from '@/lib/utils/reserved-usernames'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { repositories } from '@/lib/db/schema/repositories'
import { updateUserField } from '@/lib/db/queries/users'
import { inngest } from '@/lib/inngest/client'
import { EVENTS } from '@/features/sync/events'
import { captureServerEvent } from '@/lib/posthog-server'
import { createAdminClient } from '@/lib/auth/supabase-server'

const TogglePublicSchema = z.object({ next: z.boolean() })

export async function togglePublic(input: unknown): Promise<void> {
  const { next } = TogglePublicSchema.parse(input)
  const user = await requireUser()
  await updateUserField(user.id, 'isPublic', next)
  if (next) {
    revalidatePublicProfile(user.displayUsername)
    await captureServerEvent(user.id, 'public_toggle.enabled')
  }
}

const ToggleEmailRecapSchema = z.object({ next: z.boolean() })

export async function toggleEmailRecap(input: unknown): Promise<void> {
  const { next } = ToggleEmailRecapSchema.parse(input)
  const user = await requireUser()
  await updateUserField(user.id, 'emailRecapEnabled', next)
}

const ChangeTimezoneSchema = z.object({ timezone: z.string() })

export async function changeTimezone(input: unknown): Promise<void> {
  const { timezone } = ChangeTimezoneSchema.parse(input)
  const validTimezones = Intl.supportedValuesOf('timeZone')
  if (!validTimezones.includes(timezone)) {
    throw new Error('Invalid timezone.')
  }
  const user = await requireUser()
  await updateUserField(user.id, 'timezone', timezone)
}

const ChangeUsernameSchema = z.object({
  username: z.string().min(2).max(30).regex(/^[a-z0-9-_]+$/),
})

export async function changeUsername(input: unknown): Promise<void> {
  const { username } = ChangeUsernameSchema.parse(input)
  const user = await requireUser()

  // Self-match exception: GitHub login can always be used even if reserved
  if (username !== user.githubLogin && isReserved(username)) {
    throw new Error('This name is reserved.')
  }

  const oldUsername = user.displayUsername

  try {
    await db
      .update(users)
      .set({ displayUsername: username })
      .where(eq(users.id, user.id))
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
      throw new Error('This name is taken.')
    }
    throw err
  }

  if (user.isPublic) {
    revalidatePublicProfile(oldUsername)
    revalidatePublicProfile(username)
  }
}

const UpdateIncludedReposSchema = z.object({
  repoIds: z.array(z.string().uuid()),
  includedIds: z.array(z.string().uuid()),
})

export async function updateIncludedRepos(input: unknown): Promise<void> {
  const { repoIds, includedIds } = UpdateIncludedReposSchema.parse(input)
  const user = await requireUser()

  // Verify ownership of every id
  const owned = await db
    .select({ id: repositories.id })
    .from(repositories)
    .where(and(eq(repositories.userId, user.id), inArray(repositories.id, repoIds)))

  const ownedIds = new Set(owned.map((r) => r.id))
  const allOwned = repoIds.every((id) => ownedIds.has(id))
  if (!allOwned) {
    throw new Error('One or more repositories do not belong to you.')
  }

  const includedSet = new Set(includedIds)

  await Promise.all(
    repoIds.map((id) =>
      db
        .update(repositories)
        .set({ isIncluded: includedSet.has(id) })
        .where(and(eq(repositories.id, id), eq(repositories.userId, user.id))),
    ),
  )

  await inngest.send({
    name: EVENTS.SYNC_BACKFILL_REQUESTED,
    data: { userId: user.id },
  })
}

export async function disconnectGithub(): Promise<void> {
  const user = await requireUser()
  const wasPublic = user.isPublic

  await db
    .update(users)
    .set({
      githubAccessTokenEnc: null,
      githubRefreshTokenEnc: null,
      githubTokenExpiresAt: null,
      isPublic: false,
    })
    .where(eq(users.id, user.id))

  if (wasPublic) {
    revalidatePublicProfile(user.displayUsername)
  }
}

const DeleteAccountSchema = z.object({ confirmation: z.literal('DELETE') })

export async function deleteAccount(input: unknown): Promise<void> {
  DeleteAccountSchema.parse(input)
  const user = await requireUser()

  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.deleteUser(user.id)
  if (error) {
    throw new Error('Failed to delete account. Please try again.')
  }

  redirect('/')
}
