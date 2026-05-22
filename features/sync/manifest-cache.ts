import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { repositories } from '@/lib/db/schema/repositories'
import type { ClassificationContext } from '@/features/territories/classifier'
import { serializeManifestContext, type CacheableManifestRepo } from './manifest-context'

export { getValidatedCachedManifestContext, serializeManifestContext } from './manifest-context'

type CacheableRepo = CacheableManifestRepo & {
  id: string
}

export async function cacheManifestContextForRepo(params: {
  userId: string
  repo: CacheableRepo
  context: ClassificationContext
}): Promise<void> {
  const sourcePushedAt = toDateOrNull(params.repo.sourcePushedAt)

  await db
    .update(repositories)
    .set({
      manifestContext: serializeManifestContext(params.context),
      manifestSourcePushedAt: sourcePushedAt,
      manifestCachedAt: new Date(),
    })
    .where(and(eq(repositories.id, params.repo.id), eq(repositories.userId, params.userId)))
}

function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
