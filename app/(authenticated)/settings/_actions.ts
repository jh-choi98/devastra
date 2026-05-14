'use server'

import { z } from 'zod'
import { eq, and, ne, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/session'
import { isReservedUsername } from '@/lib/utils/reserved-usernames'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { usernameHistory } from '@/lib/db/schema/username-history'
import { repositories } from '@/lib/db/schema/repositories'
import { inngest } from '@/lib/inngest/client'
import { EVENTS } from '@/features/sync/events'
import { createAdminClient } from '@/lib/auth/supabase-server'

// ── Public toggle ─────────────────────────────────────────────────────────────
export async function setPublicProfile(isPublic: boolean): Promise<void> {
  const user = await requireUser()
  await db.update(users).set({ isPublic }).where(eq(users.id, user.id))
  revalidatePath(`/${user.displayUsername}`)
  revalidatePath('/settings')
}

// @deprecated Use setPublicProfile
export async function togglePublic(input: unknown): Promise<void> {
  const { next } = z.object({ next: z.boolean() }).parse(input)
  await setPublicProfile(next)
}

// ── Email recap toggle ────────────────────────────────────────────────────────
export async function setEmailRecapEnabled(enabled: boolean): Promise<void> {
  const user = await requireUser()
  await db.update(users).set({ emailRecapEnabled: enabled }).where(eq(users.id, user.id))
}

// @deprecated Use setEmailRecapEnabled
export async function toggleEmailRecap(input: unknown): Promise<void> {
  const { next } = z.object({ next: z.boolean() }).parse(input)
  await setEmailRecapEnabled(next)
}

// ── Timezone ──────────────────────────────────────────────────────────────────
export async function setTimezone(tz: string): Promise<void> {
  const user = await requireUser()
  const parsed = z.string().min(3).max(60).parse(tz)
  const validTimezones = Intl.supportedValuesOf('timeZone')
  if (!validTimezones.includes(parsed)) throw new Error('Invalid timezone.')
  await db.update(users).set({ timezone: parsed }).where(eq(users.id, user.id))
}

// @deprecated Use setTimezone
export async function changeTimezone(input: unknown): Promise<void> {
  const { timezone } = z.object({ timezone: z.string() }).parse(input)
  await setTimezone(timezone)
}

// ── Username availability check ───────────────────────────────────────────────
export async function checkUsernameAvailable(draft: string): Promise<
  | { kind: 'available' }
  | { kind: 'taken' }
  | { kind: 'reserved' }
  | { kind: 'invalid'; reason: string }
> {
  const user = await requireUser()
  const lower = draft.toLowerCase()
  if (lower === user.displayUsername) return { kind: 'available' }
  if (!/^[a-z0-9-_]+$/.test(lower)) return { kind: 'invalid', reason: 'regex' }
  if (lower.length < 2) return { kind: 'invalid', reason: 'too_short' }
  if (lower.length > 30) return { kind: 'invalid', reason: 'too_long' }

  // Self-match exception (ADR-15): GitHub login can bypass reserved list
  if (isReservedUsername(lower) && lower !== user.githubLogin.toLowerCase()) {
    return { kind: 'reserved' }
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.displayUsername, lower), ne(users.id, user.id)))
    .limit(1)
  if (existing.length > 0) return { kind: 'taken' }

  // Also check username_history (reserved by another user) per ADR-30
  const histExisting = await db
    .select({ userId: usernameHistory.userId })
    .from(usernameHistory)
    .where(eq(usernameHistory.oldUsername, lower))
    .limit(1)
  if (histExisting.length > 0 && histExisting[0].userId !== user.id) return { kind: 'reserved' }

  return { kind: 'available' }
}

// ── Username change ───────────────────────────────────────────────────────────
export async function changeUsername(newUsername: string): Promise<void> {
  const user = await requireUser()
  const lower = newUsername.toLowerCase()
  const result = await checkUsernameAvailable(lower)
  if (result.kind !== 'available') {
    throw new Error(`Username change rejected: ${result.kind}`)
  }
  if (lower === user.displayUsername) return

  // Atomic: insert old username into history, then update users
  await db.transaction(async (tx) => {
    await tx.insert(usernameHistory).values({
      oldUsername: user.displayUsername,
      userId: user.id,
    })
    await tx.update(users).set({ displayUsername: lower }).where(eq(users.id, user.id))
  })

  revalidatePath(`/${user.displayUsername}`)
  revalidatePath(`/${lower}`)
  revalidatePath('/settings')
}

// ── Included repos ────────────────────────────────────────────────────────────
const reposSchema = z.array(z.object({ id: z.string().uuid(), isIncluded: z.boolean() }))
export async function updateIncludedRepos(
  updates: z.infer<typeof reposSchema>,
): Promise<void> {
  const user = await requireUser()
  const parsed = reposSchema.parse(updates)

  await db.transaction(async (tx) => {
    for (const u of parsed) {
      await tx
        .update(repositories)
        .set({ isIncluded: u.isIncluded })
        .where(and(eq(repositories.id, u.id), eq(repositories.userId, user.id)))
    }
  })

  await inngest.send({
    name: EVENTS.SYNC_BACKFILL_REQUESTED,
    data: { userId: user.id },
  })

  redirect('/')
}

// @deprecated - keep for backward compat with old section
export async function updateIncludedReposLegacy(input: unknown): Promise<void> {
  const { repoIds, includedIds } = z
    .object({ repoIds: z.array(z.string().uuid()), includedIds: z.array(z.string().uuid()) })
    .parse(input)
  const user = await requireUser()

  const owned = await db
    .select({ id: repositories.id })
    .from(repositories)
    .where(and(eq(repositories.userId, user.id), inArray(repositories.id, repoIds)))

  const ownedIds = new Set(owned.map((r) => r.id))
  if (!repoIds.every((id) => ownedIds.has(id))) {
    throw new Error('One or more repositories do not belong to you.')
  }

  const includedSet = new Set(includedIds)
  const updates = repoIds.map((id) => ({ id, isIncluded: includedSet.has(id) }))
  await updateIncludedRepos(updates)
}

// ── Disconnect GitHub ─────────────────────────────────────────────────────────
export async function disconnectGitHub(): Promise<void> {
  const user = await requireUser()
  await db
    .update(users)
    .set({
      githubAccessTokenEnc: null,
      githubRefreshTokenEnc: null,
      githubTokenExpiresAt: null,
      isPublic: false,
    })
    .where(eq(users.id, user.id))
  revalidatePath(`/${user.displayUsername}`)
  redirect('/')
}

// @deprecated Use disconnectGitHub
export async function disconnectGithub(): Promise<void> {
  await disconnectGitHub()
}

// ── Delete account ────────────────────────────────────────────────────────────
export async function deleteAccount(): Promise<void> {
  const user = await requireUser()
  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.deleteUser(user.id)
  if (error) throw new Error('Account deletion failed; please contact support.')
  redirect('/account-deleted')
}
