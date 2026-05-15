'use server'
import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { requireUser } from '@/lib/auth/session'

/**
 * Idempotent — marks the first-ever star cinematic as seen.
 * Sets first_star_cinematic_pending = false, first_star_cinematic_seen = true.
 * Safe to call multiple times (subsequent calls are no-ops in effect).
 */
export async function acknowledgeFirstEverCinematic(): Promise<void> {
  const user = await requireUser()
  await db
    .update(users)
    .set({
      firstStarCinematicPending: false,
      firstStarCinematicSeen: true,
    })
    .where(eq(users.id, user.id))
}
