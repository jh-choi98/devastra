'use server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { requireUser } from '@/lib/auth/session'

export async function markClusterClickHintSeen(): Promise<void> {
  const user = await requireUser()
  await db.update(users).set({ clusterClickHintSeen: true }).where(eq(users.id, user.id))
}

export async function markShareHintSeen(): Promise<void> {
  const user = await requireUser()
  await db.update(users).set({ shareHintSeen: true }).where(eq(users.id, user.id))
}

export async function markRecapDiffHintSeen(): Promise<void> {
  const user = await requireUser()
  await db.update(users).set({ recapDiffHintSeen: true }).where(eq(users.id, user.id))
}

export async function markFirstStarCinematicCompleted(): Promise<void> {
  const user = await requireUser()
  await db
    .update(users)
    .set({
      firstStarCinematicPending: false,
      firstStarCinematicSeen: true,
    })
    .where(eq(users.id, user.id))
}

export async function touchLastLoginAt(): Promise<void> {
  const user = await requireUser()
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))
}
