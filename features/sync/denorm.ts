import 'server-only'

import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { territories } from '@/lib/db/schema/territories'
import { activityTerritories } from '@/lib/db/schema/activity-territories'
import { activities } from '@/lib/db/schema/activities'
import { computeStage } from '@/features/territories/rules'
import { ALL_TERRITORY_TYPES } from '@/features/territories/registry'

export async function recomputeUserDenorm(userId: string): Promise<void> {
  const aggs = await db
    .select({
      territoryType: activityTerritories.territoryType,
      totalWeight:
        sql<string>`COALESCE(SUM(${activityTerritories.weight}), 0)::text`.as('total_weight'),
      growth30d:
        sql<string>`COALESCE(SUM(CASE WHEN ${activities.occurredAt} > NOW() - INTERVAL '30 days' THEN ${activityTerritories.weight} ELSE 0 END), 0)::text`.as(
          'growth_30d',
        ),
      lastGrownAt: sql<Date | null>`MAX(${activities.occurredAt})`.as('last_grown_at'),
    })
    .from(activityTerritories)
    .innerJoin(activities, eq(activities.id, activityTerritories.activityId))
    .where(eq(activities.userId, userId))
    .groupBy(activityTerritories.territoryType)

  const currentTerritories = await db
    .select({
      type: territories.type,
      stage: territories.stage,
      stageChangedAt: territories.stageChangedAt,
    })
    .from(territories)
    .where(eq(territories.userId, userId))

  const currentMap = new Map(currentTerritories.map((t) => [t.type, t]))
  const aggMap = new Map(aggs.map((a) => [a.territoryType, a]))
  const now = new Date()

  await db.transaction(async (tx) => {
    for (const type of ALL_TERRITORY_TYPES) {
      const agg = aggMap.get(type)
      const totalWeight = agg ? parseFloat(agg.totalWeight) : 0
      const growth30d = agg ? parseFloat(agg.growth30d) : 0
      const lastGrownAt = agg?.lastGrownAt ?? null
      const newStage = computeStage(totalWeight)

      const current = currentMap.get(type)
      const oldStage = current?.stage ?? null
      const stageChangedAt =
        oldStage !== null && newStage !== oldStage ? now : (current?.stageChangedAt ?? null)

      await tx
        .insert(territories)
        .values({
          userId,
          type,
          totalWeight: totalWeight.toString(),
          stage: newStage,
          stageChangedAt,
          lastGrownAt,
          growth30d: growth30d.toString(),
        })
        .onConflictDoUpdate({
          target: [territories.userId, territories.type],
          set: {
            totalWeight: totalWeight.toString(),
            stage: newStage,
            stageChangedAt: sql`CASE WHEN ${territories.stage} != ${newStage} THEN NOW() ELSE ${territories.stageChangedAt} END`,
            lastGrownAt,
            growth30d: growth30d.toString(),
          },
        })
    }
  })
}
