import 'server-only'

import { isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { territories } from '@/lib/db/schema/territories'
import { landmarks } from '@/lib/db/schema/landmarks'
import { withUserScope, withUserScopeAnd } from '@/lib/db/queries/_helpers'
import type { ConstellationData } from '@/app/_components/Constellation/Constellation'
import type { TerritoryType } from '@/features/territories/registry'

export async function getMapDataForUser(userId: string, lastLoginAt: Date | null): Promise<ConstellationData> {
  const [territoriesData, landmarksData] = await Promise.all([
    db.select().from(territories).where(withUserScope(userId, territories.userId)),
    db
      .select()
      .from(landmarks)
      .where(withUserScopeAnd(userId, landmarks.userId, isNotNull(landmarks.firstUnlockedAt))),
  ])
  const litLandmarksData = landmarksData.filter((l) => l.firstUnlockedAt !== null)

  return {
    userId,
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
    diffSince: lastLoginAt?.toISOString() ?? null,
  }
}
