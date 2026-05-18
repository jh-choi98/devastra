import 'server-only'
import { isNotNull, gt, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { landmarks } from '@/lib/db/schema/landmarks'
import { territories } from '@/lib/db/schema/territories'
import { withUserScopeAnd } from './_helpers'

export async function getSinceLastVisitDiff(opts: {
  userId: string
  lastLoginAt: Date | null
}): Promise<{
  new_stars_count: number
  expanded_clusters: string[]
} | null> {
  if (!opts.lastLoginAt) return null
  const since = opts.lastLoginAt

  const [{ value: newCount }] = await db
    .select({ value: sql<number>`cast(count(*) as int)` })
    .from(landmarks)
    .where(
      withUserScopeAnd(
        opts.userId,
        landmarks.userId,
        isNotNull(landmarks.firstUnlockedAt),
        gt(landmarks.firstUnlockedAt, since),
      ),
    )

  const rows = await db
    .select({ type: territories.type })
    .from(territories)
    .where(
      withUserScopeAnd(
        opts.userId,
        territories.userId,
        isNotNull(territories.stageChangedAt),
        gt(territories.stageChangedAt, since),
      ),
    )

  return {
    new_stars_count: newCount,
    expanded_clusters: rows.map((r) => r.type),
  }
}
