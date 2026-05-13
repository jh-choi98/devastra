import 'server-only'

import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { activities } from '@/lib/db/schema/activities'
import { activityTerritories } from '@/lib/db/schema/activity-territories'
import { territories } from '@/lib/db/schema/territories'
import { landmarks } from '@/lib/db/schema/landmarks'
import { weeklyRecaps } from '@/lib/db/schema/weekly-recaps'
import { users } from '@/lib/db/schema/users'
import { TECH_CATALOG } from '@/features/territories/tech-catalog'
import type { TerritoryType } from '@/features/territories/registry'

export type RecapHighlights = {
  topGrowth: { territory: TerritoryType; pct: number } | null
  newLandmarks: Array<{ tech_key: string; landmarkName: string; territory: TerritoryType }>
  stageUps: Array<{ territory: TerritoryType; from: number; to: number }>
  stats: { activeDays: number; prsShipped: number; totalCommits: number }
}

export async function generateRecapForUser(
  userId: string,
  weekStart: Date,
): Promise<{ recapId: string; highlights: RecapHighlights; hasActivity: boolean }> {
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Activities in [weekStart, weekEnd)
  const weekActivities = await db
    .select({
      id: activities.id,
      type: activities.type,
      occurredAt: activities.occurredAt,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        gte(activities.occurredAt, weekStart),
        lt(activities.occurredAt, weekEnd),
      ),
    )

  // Per-territory weight gained this week via join
  const weekWeights = await db
    .select({
      territoryType: activityTerritories.territoryType,
      weekWeight: sql<string>`SUM(${activityTerritories.weight})`,
    })
    .from(activityTerritories)
    .innerJoin(activities, eq(activityTerritories.activityId, activities.id))
    .where(
      and(
        eq(activities.userId, userId),
        gte(activities.occurredAt, weekStart),
        lt(activities.occurredAt, weekEnd),
      ),
    )
    .groupBy(activityTerritories.territoryType)

  // Current territory state
  const userTerritories = await db
    .select()
    .from(territories)
    .where(eq(territories.userId, userId))

  // topGrowth: territory with highest pct growth relative to weight before this week
  let topGrowth: RecapHighlights['topGrowth'] = null
  let maxPct = 0
  for (const ww of weekWeights) {
    const territory = userTerritories.find((t) => t.type === ww.territoryType)
    if (!territory) continue
    const totalWeight = parseFloat(territory.totalWeight as string)
    const weekWeight = parseFloat(ww.weekWeight)
    if (weekWeight <= 0) continue
    const prevWeight = totalWeight - weekWeight
    const pct = prevWeight > 0 ? Math.round((weekWeight / prevWeight) * 100) : 100
    if (pct > maxPct) {
      maxPct = pct
      topGrowth = { territory: ww.territoryType as TerritoryType, pct }
    }
  }

  // newLandmarks: first_unlocked_at in [weekStart, weekEnd)
  const newLandmarkRows = await db
    .select()
    .from(landmarks)
    .where(
      and(
        eq(landmarks.userId, userId),
        gte(landmarks.firstUnlockedAt, weekStart),
        lt(landmarks.firstUnlockedAt, weekEnd),
      ),
    )

  const newLandmarks: RecapHighlights['newLandmarks'] = newLandmarkRows.map((lm) => {
    const catalogEntry = TECH_CATALOG.find((e) => e.tech_key === lm.techKey)
    return {
      tech_key: lm.techKey,
      landmarkName: catalogEntry?.landmarkName ?? lm.techKey,
      territory: lm.territoryType as TerritoryType,
    }
  })

  // stageUps: territories with stage_changed_at in [weekStart, weekEnd) and stage > 1
  const stageUps: RecapHighlights['stageUps'] = userTerritories
    .filter(
      (t) =>
        t.stageChangedAt !== null &&
        new Date(t.stageChangedAt) >= weekStart &&
        new Date(t.stageChangedAt) < weekEnd &&
        t.stage > 1,
    )
    .map((t) => ({
      territory: t.type as TerritoryType,
      from: t.stage - 1,
      to: t.stage,
    }))

  // stats
  const totalCommits = weekActivities.filter((a) => a.type === 'commit').length
  const prsShipped = weekActivities.filter((a) => a.type === 'pr').length

  // activeDays: distinct UTC dates
  const activeDaySet = new Set(
    weekActivities.map((a) => {
      const d = new Date(a.occurredAt)
      return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
    }),
  )
  const activeDays = activeDaySet.size

  const hasActivity = totalCommits + prsShipped > 0

  const highlights: RecapHighlights = {
    topGrowth,
    newLandmarks,
    stageUps,
    stats: { activeDays, prsShipped, totalCommits },
  }

  const dbHighlights = {
    top_growth: topGrowth ? { territory: topGrowth.territory, pct: topGrowth.pct } : null,
    new_landmarks: newLandmarks.map((l) => l.tech_key),
    stage_ups: stageUps.map((s) => ({ territory: s.territory, from: s.from, to: s.to })),
    stats: { active_days: activeDays, prs_shipped: prsShipped, total_commits: totalCommits },
  }

  const weekStartDate = weekStart.toISOString().split('T')[0]

  const [upserted] = await db
    .insert(weeklyRecaps)
    .values({
      userId,
      weekStart: weekStartDate,
      highlights: dbHighlights,
      ogImageUrl: '',
    })
    .onConflictDoUpdate({
      target: [weeklyRecaps.userId, weeklyRecaps.weekStart],
      set: { highlights: dbHighlights },
    })
    .returning({ id: weeklyRecaps.id })

  const recapId = upserted.id

  await db
    .update(weeklyRecaps)
    .set({ ogImageUrl: `/api/og/recap/${recapId}` })
    .where(eq(weeklyRecaps.id, recapId))

  return { recapId, highlights, hasActivity }
}

export async function listUsersForRecap(): Promise<
  Array<{ id: string; timezone: string; email: string; displayUsername: string }>
> {
  return db
    .select({
      id: users.id,
      timezone: users.timezone,
      email: users.email,
      displayUsername: users.displayUsername,
    })
    .from(users)
    .where(eq(users.emailRecapEnabled, true))
}
