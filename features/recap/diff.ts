import 'server-only'
import { and, gte, lt, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { territories } from '@/lib/db/schema/territories'
import { landmarks } from '@/lib/db/schema/landmarks'
import { activities } from '@/lib/db/schema/activities'
import { withUserScopeAnd } from '@/lib/db/queries/_helpers'
import type { TerritoryType } from '@/features/territories/registry'

export type WeekAggregations = {
  weekStart: Date
  stageUps: Array<{ territory: TerritoryType; from_stage: number; to_stage: number }>
  newStars: Array<{ tech_key: string; territory: TerritoryType }>
  brightenedStars: Array<{ tech_key: string; territory: TerritoryType }>
  brightestCluster: { territory: TerritoryType; growthPct: number } | null
  activity: { active_days: number; commits: number; prs_shipped: number }
}

export async function computeWeekAggregations(opts: {
  userId: string
  weekStart: Date
}): Promise<WeekAggregations> {
  const { userId, weekStart } = opts
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

  // 1. Stage-ups: territories with stage_changed_at in [weekStart, weekEnd)
  const stageUpRows = await db
    .select()
    .from(territories)
    .where(
      withUserScopeAnd(
        userId,
        territories.userId,
        gte(territories.stageChangedAt, weekStart),
        lt(territories.stageChangedAt, weekEnd),
      ),
    )

  const stageUps = stageUpRows
    .filter((t) => t.stage > 1)
    .map((t) => ({
      territory: t.type as TerritoryType,
      from_stage: t.stage - 1,
      to_stage: t.stage,
    }))

  // 2. New stars: landmarks with first_unlocked_at in [weekStart, weekEnd)
  const newStarRows = await db
    .select({ techKey: landmarks.techKey, territoryType: landmarks.territoryType })
    .from(landmarks)
    .where(
      withUserScopeAnd(
        userId,
        landmarks.userId,
        gte(landmarks.firstUnlockedAt, weekStart),
        lt(landmarks.firstUnlockedAt, weekEnd),
      ),
    )

  const newStars = newStarRows.map((r) => ({
    tech_key: r.techKey,
    territory: r.territoryType as TerritoryType,
  }))

  // 3. Brightened stars: last_grown_at in [weekStart, weekEnd) AND first_unlocked_at < weekStart
  const brightenedRows = await db
    .select({ techKey: landmarks.techKey, territoryType: landmarks.territoryType })
    .from(landmarks)
    .where(
      withUserScopeAnd(
        userId,
        landmarks.userId,
        isNotNull(landmarks.firstUnlockedAt),
        gte(landmarks.lastGrownAt, weekStart),
        lt(landmarks.lastGrownAt, weekEnd),
        lt(landmarks.firstUnlockedAt, weekStart),
      ),
    )

  const brightenedStars = brightenedRows.map((r) => ({
    tech_key: r.techKey,
    territory: r.territoryType as TerritoryType,
  }))

  // 4. Brightest cluster: territory with highest growth_30d relative to prior weight
  const allTerritories = await db
    .select({
      type: territories.type,
      growth30d: territories.growth30d,
      totalWeight: territories.totalWeight,
    })
    .from(territories)
    .where(withUserScopeAnd(userId, territories.userId))

  let brightestCluster: WeekAggregations['brightestCluster'] = null
  let maxGrowthPct = 0
  for (const t of allTerritories) {
    const growth = parseFloat(t.growth30d as string)
    const total = parseFloat(t.totalWeight as string)
    if (growth <= 0) continue
    const prev = total - growth
    const pct = prev > 0 ? (growth / prev) * 100 : 100
    if (pct > maxGrowthPct) {
      maxGrowthPct = pct
      brightestCluster = {
        territory: t.type as TerritoryType,
        growthPct: Math.round(pct),
      }
    }
  }

  // 5. Activity: distinct days, commits, prs in [weekStart, weekEnd)
  const weekActivityRows = await db
    .select({ type: activities.type, occurredAt: activities.occurredAt })
    .from(activities)
    .where(
      withUserScopeAnd(
        userId,
        activities.userId,
        gte(activities.occurredAt, weekStart),
        lt(activities.occurredAt, weekEnd),
      ),
    )

  const activeDaySet = new Set(
    weekActivityRows.map((a) => {
      const d = new Date(a.occurredAt)
      return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
    }),
  )

  return {
    weekStart,
    stageUps,
    newStars,
    brightenedStars,
    brightestCluster,
    activity: {
      active_days: activeDaySet.size,
      commits: weekActivityRows.filter((a) => a.type === 'commit').length,
      prs_shipped: weekActivityRows.filter((a) => a.type === 'pr').length,
    },
  }
}
