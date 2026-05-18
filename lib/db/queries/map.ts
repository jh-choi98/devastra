import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { territories } from '@/lib/db/schema/territories'
import { landmarks } from '@/lib/db/schema/landmarks'
import type { ConstellationData } from '@/app/_components/Constellation/Constellation'
import type { TerritoryType } from '@/features/territories/registry'

export async function getMapDataForUser(userId: string, lastLoginAt: Date | null): Promise<ConstellationData> {
  const [territoriesData, landmarksData] = await Promise.all([
    db.select().from(territories).where(eq(territories.userId, userId)),
    db.select().from(landmarks).where(eq(landmarks.userId, userId)),
  ])

  return {
    userId,
    territories: territoriesData.map((t) => ({
      type: t.type as TerritoryType,
      stage: t.stage,
      totalWeight: Number(t.totalWeight),
      growth30d: Number(t.growth30d),
      stageChangedAt: t.stageChangedAt?.toISOString() ?? null,
    })),
    landmarks: landmarksData.map((l) => ({
      tech_key: l.techKey,
      territory: l.territoryType as TerritoryType,
      weight: Number(l.weight),
      firstUnlockedAt: l.firstUnlockedAt?.toISOString() ?? null,
    })),
    diffSince: lastLoginAt?.toISOString() ?? null,
  }
}
