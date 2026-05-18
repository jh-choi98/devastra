import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { repositories } from '@/lib/db/schema/repositories'

export type DbRepository = typeof repositories.$inferSelect

function formatDbError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = error.cause
  if (cause instanceof Error && cause.message) return cause.message
  return error.message
}

export async function upsertRepository(params: {
  userId: string
  source: string
  externalRepoId: string
  owner: string
  name: string
  primaryLanguage?: string | null
  sourcePushedAt?: Date | null
  isIncluded?: boolean
}): Promise<DbRepository> {
  try {
    const [existing] = await db
      .select({ id: repositories.id })
      .from(repositories)
      .where(
        and(
          eq(repositories.userId, params.userId),
          eq(repositories.source, params.source),
          eq(repositories.externalRepoId, params.externalRepoId),
        ),
      )
      .limit(1)

    if (existing) {
      const [repo] = await db
        .update(repositories)
        .set({
          owner: params.owner,
          name: params.name,
          primaryLanguage: params.primaryLanguage ?? null,
          sourcePushedAt: params.sourcePushedAt ?? null,
          isIncluded: params.isIncluded ?? true,
        })
        .where(eq(repositories.id, existing.id))
        .returning()
      return repo
    }

    const [repo] = await db
      .insert(repositories)
      .values({
        userId: params.userId,
        source: params.source,
        externalRepoId: params.externalRepoId,
        owner: params.owner,
        name: params.name,
        primaryLanguage: params.primaryLanguage ?? null,
        sourcePushedAt: params.sourcePushedAt ?? null,
        isIncluded: params.isIncluded ?? true,
      })
      .returning()
    return repo
  } catch (error) {
    throw new Error(`Repository save failed: ${formatDbError(error)}`)
  }
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
