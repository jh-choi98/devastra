import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { repositories } from '@/lib/db/schema/repositories'

type CacheableHistoricalRepo = {
  id?: string
  sourcePushedAt?: Date | string | null
}

export async function markHistoricalBootstrapChecked(params: {
  userId: string
  repos: CacheableHistoricalRepo[]
}): Promise<void> {
  const checkedAt = new Date()

  for (const repo of params.repos) {
    if (!repo.id) continue

    await db
      .update(repositories)
      .set({
        historicalBootstrapSourcePushedAt: toDateOrNull(repo.sourcePushedAt),
        historicalBootstrapCheckedAt: checkedAt,
      })
      .where(and(eq(repositories.id, repo.id), eq(repositories.userId, params.userId)))
  }
}

function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
