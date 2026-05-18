import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { weeklyRecaps } from '@/lib/db/schema/weekly-recaps'
import { users } from '@/lib/db/schema/users'
import { emailSends } from '@/lib/db/schema/email-sends'
import { resend } from '@/lib/email/client'
import { signUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { ogVersionParam } from '@/lib/og/version'
import { WeeklyRecapActive } from '@/lib/email/templates/WeeklyRecapActive'
import { WeeklyRecapEmpty } from '@/lib/email/templates/WeeklyRecapEmpty'
import { WeeklyRecapFirstWeek } from '@/lib/email/templates/WeeklyRecapFirstWeek'
import { buildSubjectLine } from './subject-line'
import type { HighlightsPayload } from './slot-builder'

export async function sendWeeklyRecapEmail(opts: { recapId: string }): Promise<void> {
  const [recap] = await db
    .select()
    .from(weeklyRecaps)
    .where(eq(weeklyRecaps.id, opts.recapId))
    .limit(1)
  if (!recap) throw new Error('recap not found')

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, recap.userId))
    .limit(1)
  if (!user) throw new Error('user not found')
  if (!user.emailRecapEnabled) return
  if (!user.email) return

  const highlights = recap.highlights as HighlightsPayload
  const subject = buildSubjectLine(highlights)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://devastra.app'
  const ogUrl = `${baseUrl}/api/og/recap/${recap.id}?${ogVersionParam()}`

  const emailType =
    highlights.kind === 'empty'
      ? ('weekly_recap_empty' as const)
      : highlights.kind === 'first_week'
        ? ('weekly_recap_first_week' as const)
        : ('weekly_recap_active' as const)

  const unsubscribeToken = await signUnsubscribeToken(user.id, emailType)
  const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${unsubscribeToken}`
  const weekParam = typeof recap.weekStart === 'string' ? recap.weekStart : recap.weekStart
  const ctaUrl = `${baseUrl}/?from=recap&week=${weekParam}`

  const templateProps = {
    ogUrl,
    highlights,
    ctaUrl,
    unsubscribeUrl,
    displayUsername: user.displayUsername,
  }

  const Template =
    highlights.kind === 'empty'
      ? WeeklyRecapEmpty
      : highlights.kind === 'first_week'
        ? WeeklyRecapFirstWeek
        : WeeklyRecapActive

  const result = await resend.emails.send({
    from: 'DevAstra <hello@devastra.app>',
    to: user.email,
    subject,
    react: Template(templateProps),
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })

  await db.insert(emailSends).values({
    userId: user.id,
    emailType,
    relatedId: recap.id,
    externalMessageId: result.data?.id ?? null,
    bounced: false,
  })

  await db
    .update(weeklyRecaps)
    .set({ emailSentAt: new Date() })
    .where(eq(weeklyRecaps.id, recap.id))
}
