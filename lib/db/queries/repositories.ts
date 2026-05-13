import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { repositories } from '@/lib/db/schema/repositories'

export type DbRepository = typeof repositories.$inferSelect

export async function upsertRepository(params: {
  userId: string
  source: string
  externalRepoId: string
  owner: string
  name: string
  primaryLanguage?: string | null
  isIncluded?: boolean
}): Promise<DbRepository> {
  const [repo] = await db
    .insert(repositories)
    .values({
      userId: params.userId,
      source: params.source,
      externalRepoId: params.externalRepoId,
      owner: params.owner,
      name: params.name,
      primaryLanguage: params.primaryLanguage ?? null,
      isIncluded: params.isIncluded ?? true,
    })
    .onConflictDoUpdate({
      target: [repositories.userId, repositories.source, repositories.externalRepoId],
      set: {
        owner: params.owner,
        name: params.name,
        primaryLanguage: params.primaryLanguage ?? null,
      },
    })
    .returning()
  return repo
}

export async function getIncludedRepositoriesForUser(userId: string): Promise<DbRepository[]> {
  return db
    .select()
    .from(repositories)
    .where(and(eq(repositories.userId, userId), eq(repositories.isIncluded, true)))
}

export async function getAllRepositoriesForUser(userId: string): Promise<DbRepository[]> {
  return db.select().from(repositories).where(eq(repositories.userId, userId))
}
