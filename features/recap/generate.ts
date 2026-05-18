import 'server-only'

import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { weeklyRecaps } from '@/lib/db/schema/weekly-recaps'
import { users } from '@/lib/db/schema/users'
import { computeWeekAggregations } from './diff'
import { buildHighlights } from './slot-builder'

export async function generateWeeklyRecapForUser(opts: {
  userId: string
  weekStart: Date
}): Promise<{ recapId: string; kind: 'active' | 'empty' | 'first_week'; shouldSend: boolean }> {
  const aggregations = await computeWeekAggregations({ userId: opts.userId, weekStart: opts.weekStart })

  const isEmpty =
    aggregations.stageUps.length === 0 &&
    aggregations.newStars.length === 0 &&
    aggregations.brightenedStars.length === 0 &&
    aggregations.activity.commits === 0 &&
    aggregations.activity.prs_shipped === 0

  const [user] = await db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, opts.userId))
    .limit(1)
  if (!user) throw new Error('user not found')

  const firstMondayAfterSignup = nextMondayUtc(user.createdAt)
  const isFirstWeek = +opts.weekStart === +firstMondayAfterSignup

  const highlights = buildHighlights({ aggregations, isFirstWeek, isEmptyWeek: isEmpty })

  const weekStartStr = opts.weekStart.toISOString().split('T')[0]

  const [inserted] = await db
    .insert(weeklyRecaps)
    .values({
      userId: opts.userId,
      weekStart: weekStartStr,
      highlights,
    })
    .onConflictDoUpdate({
      target: [weeklyRecaps.userId, weeklyRecaps.weekStart],
      set: { highlights },
    })
    .returning({ id: weeklyRecaps.id })

  // Skip-after-2-empty policy (ADR-32):
  // First empty week → send. Second consecutive empty week → skip send (still UPSERT).
  let shouldSend = true
  if (isEmpty) {
    const previousMonday = new Date(opts.weekStart)
    previousMonday.setUTCDate(previousMonday.getUTCDate() - 7)
    const previousMondayStr = previousMonday.toISOString().split('T')[0]

    const [prev] = await db
      .select({ highlights: weeklyRecaps.highlights })
      .from(weeklyRecaps)
      .where(
        and(
          eq(weeklyRecaps.userId, opts.userId),
          eq(weeklyRecaps.weekStart, previousMondayStr),
        ),
      )
      .limit(1)

    const prevHighlights = prev?.highlights as { kind?: string } | undefined
    if (prevHighlights?.kind === 'empty') {
      shouldSend = false
    }
  }

  return { recapId: inserted.id, kind: highlights.kind, shouldSend }
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
    .where(
      and(
        eq(users.emailRecapEnabled, true),
        isNotNull(users.githubAccessTokenEnc),
      ),
    )
}

function nextMondayUtc(date: Date): Date {
  const d = new Date(date)
  const dow = d.getUTCDay()
  // Days until next Monday strictly after date
  const daysUntilMonday = dow === 0 ? 1 : (8 - dow) % 7 || 7
  d.setUTCDate(d.getUTCDate() + daysUntilMonday)
  d.setUTCHours(0, 0, 0, 0)
  return d
}
