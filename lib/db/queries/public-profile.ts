import 'server-only'

import { isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { territories } from '@/lib/db/schema/territories'
import { landmarks } from '@/lib/db/schema/landmarks'
import { withUserScope, withUserScopeAnd } from '@/lib/db/queries/_helpers'
import type { ConstellationData } from '@/app/_components/Constellation/Constellation'
import type { TerritoryType } from '@/features/territories/registry'

export type PublicProfileResult =
  | { isPublic: true; username: string; avatarUrl: string | null; map: ConstellationData }
  | null

export async function getPublicProfileByUsername(
  username: string,
): Promise<PublicProfileResult> {
  // users_public_view filters is_public = true — not found means private or nonexistent
  const rows = await db.execute(
    sql`SELECT id, display_username, avatar_url FROM users_public_view WHERE display_username = ${username} LIMIT 1`,
  )

  const row = rows[0] as
    | { id: string; display_username: string; avatar_url: string | null }
    | undefined

  if (!row) return null

  const [territoriesData, landmarksData] = await Promise.all([
    db.select().from(territories).where(withUserScope(row.id, territories.userId)),
    db
      .select()
      .from(landmarks)
      .where(withUserScopeAnd(row.id, landmarks.userId, isNotNull(landmarks.firstUnlockedAt))),
  ])
  const litLandmarksData = landmarksData.filter((l) => l.firstUnlockedAt !== null)

  return {
    isPublic: true,
    username: row.display_username,
    avatarUrl: row.avatar_url,
    map: {
      userId: row.id,
      territories: territoriesData.map((t) => ({
        type: t.type as TerritoryType,
        stage: t.stage,
        totalWeight: Number(t.totalWeight),
        growth30d: Number(t.growth30d),
        stageChangedAt: t.stageChangedAt?.toISOString() ?? null,
      })),
      landmarks: litLandmarksData.map((l) => ({
        tech_key: l.techKey,
        territory: l.territoryType as TerritoryType,
        weight: Number(l.weight),
        firstUnlockedAt: l.firstUnlockedAt?.toISOString() ?? null,
      })),
    },
  }
}
