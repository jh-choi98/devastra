import 'server-only'

import { eq, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { repositories } from '@/lib/db/schema/repositories'

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

export async function updateLastLoginAt(userId: string): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId))
}

export type UserSettings = Pick<
  DbUser,
  'isPublic' | 'displayUsername' | 'emailRecapEnabled' | 'timezone' | 'githubLogin'
>

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const [user] = await db
    .select({
      isPublic: users.isPublic,
      displayUsername: users.displayUsername,
      emailRecapEnabled: users.emailRecapEnabled,
      timezone: users.timezone,
      githubLogin: users.githubLogin,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user) throw new Error('User not found')
  return user
}

export type DbRepositoryRow = {
  id: string
  externalRepoId: string
  owner: string
  name: string
  primaryLanguage: string | null
  isIncluded: boolean
}

export async function listUserRepos(userId: string): Promise<DbRepositoryRow[]> {
  return db
    .select({
      id: repositories.id,
      externalRepoId: repositories.externalRepoId,
      owner: repositories.owner,
      name: repositories.name,
      primaryLanguage: repositories.primaryLanguage,
      isIncluded: repositories.isIncluded,
    })
    .from(repositories)
    .where(eq(repositories.userId, userId))
}

export async function updateUserField<K extends keyof typeof users.$inferSelect>(
  userId: string,
  field: K,
  value: (typeof users.$inferSelect)[K],
): Promise<void> {
  await db
    .update(users)
    .set({ [field]: value } as Partial<typeof users.$inferInsert>)
    .where(eq(users.id, userId))
}
