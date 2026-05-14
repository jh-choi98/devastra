import 'server-only'
import { eq, and, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { landmarks } from '@/lib/db/schema/landmarks'

/**
 * Detect the 0→≥1 lit-star transition for a user and set the pending flag.
 * Called from sync at the end of the run after landmarks have been UPSERTed.
 *
 * - If first_star_cinematic_seen is already true: do nothing.
 * - If first_star_cinematic_pending is already true: do nothing (next visit consumes it).
 * - If lit_star_count went from 0 to ≥1 in this sync: set pending = true.
 *
 * Determining "went from 0 to ≥1" without explicit history: since this runs
 * AFTER UPSERT, we know the current count. The historic count is implied by
 * the seen + pending flags being both false AND current count ≥ 1.
 *
 * Per ADR-38: existing users at deploy time have pending = false (default),
 * so they will NOT trigger cinematic on the first visit post-pivot — even
 * if their lit_star_count is already ≥ 1. The cinematic is only intended
 * for the moment the user's first-ever star lights up.
 *
 * Strategy: cinematic-pending is set only when this sync run is responsible
 * for the user's first-ever lit star. To distinguish, we use a stored
 * `previous_lit_count` snapshot taken at the start of the sync run.
 */
export async function markFirstStarCinematicIfApplicable(opts: {
  userId: string
  previousLitCount: number  // captured at sync start
}): Promise<void> {
  const { userId, previousLitCount } = opts

  if (previousLitCount > 0) return  // not a 0→≥1 transition

  // Get current state of flags + lit count
  const [user] = await db
    .select({
      seen: users.firstStarCinematicSeen,
      pending: users.firstStarCinematicPending,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) return
  if (user.seen || user.pending) return

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(landmarks)
    .where(and(eq(landmarks.userId, userId), isNotNull(landmarks.firstUnlockedAt)))

  if (count >= 1) {
    await db
      .update(users)
      .set({ firstStarCinematicPending: true })
      .where(eq(users.id, userId))
  }
}

/**
 * Helper for sync code: get the user's current lit star count.
 * Call BEFORE running classification + UPSERTing landmarks.
 */
export async function getPreviousLitCount(userId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(landmarks)
    .where(and(eq(landmarks.userId, userId), isNotNull(landmarks.firstUnlockedAt)))
  return count
}
