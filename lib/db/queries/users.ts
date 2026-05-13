import 'server-only'

import { eq, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'

export type DbUser = typeof users.$inferSelect

export async function getUserById(id: string): Promise<DbUser | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id))
  return user ?? null
}

export async function getUsersWithTokens(): Promise<Pick<DbUser, 'id' | 'githubLogin' | 'lastEventId' | 'lastIncrementalSyncAt'>[]> {
  return db
    .select({
      id: users.id,
      githubLogin: users.githubLogin,
      lastEventId: users.lastEventId,
      lastIncrementalSyncAt: users.lastIncrementalSyncAt,
    })
    .from(users)
    .where(isNotNull(users.githubAccessTokenEnc))
}

export async function updateUserSyncState(
  userId: string,
  params: { lastEventId?: string | null; lastIncrementalSyncAt?: Date },
): Promise<void> {
  await db
    .update(users)
    .set({
      ...(params.lastEventId !== undefined && { lastEventId: params.lastEventId }),
      ...(params.lastIncrementalSyncAt !== undefined && {
        lastIncrementalSyncAt: params.lastIncrementalSyncAt,
      }),
    })
    .where(eq(users.id, userId))
}
