import 'server-only'

import { render } from '@react-email/components'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { weeklyRecaps } from '@/lib/db/schema/weekly-recaps'
import { emailSends } from '@/lib/db/schema/email-sends'
import { resend } from '@/lib/email/client'
import { WeeklyRecap } from '@/lib/email/templates/WeeklyRecap'
import { WeeklyRecapEmpty } from '@/lib/email/templates/WeeklyRecapEmpty'
import type { RecapHighlights } from './generate'

export async function sendRecapEmail(opts: {
  userId: string
  recapId: string
  hasActivity: boolean
}): Promise<void> {
  const { userId, recapId, hasActivity } = opts

  const [user] = await db
    .select({
      displayUsername: users.displayUsername,
      email: users.email,
      timezone: users.timezone,
      emailRecapEnabled: users.emailRecapEnabled,
    })
    .from(users)
    .where(eq(users.id, userId))

  if (!user || !user.emailRecapEnabled) return

  const [recap] = await db
    .select()
    .from(weeklyRecaps)
    .where(eq(weeklyRecaps.id, recapId))

  if (!recap) return

  const emailType = hasActivity ? 'weekly_recap_active' : 'weekly_recap_empty'
  const subject = 'Your DevAstra — this week'

  let html: string
  if (hasActivity) {
    html = await render(
      WeeklyRecap({
        recapId,
        username: user.displayUsername,
        highlights: recap.highlights as RecapHighlights,
      }),
    )
  } else {
    html = await render(
      WeeklyRecapEmpty({
        recapId,
        username: user.displayUsername,
      }),
    )
  }

  const response = await resend.emails.send({
    from: 'recap@devatlas.app',
    to: user.email,
    subject,
    html,
    headers: {
      'List-Unsubscribe': '<https://devatlas.app/settings#email>',
    },
  })

  const externalMessageId = response.data?.id ?? null

  await db.insert(emailSends).values({
    userId,
    emailType,
    relatedId: recapId,
    externalMessageId,
    bounced: false,
  })

  await db
    .update(weeklyRecaps)
    .set({ emailSentAt: new Date() })
    .where(eq(weeklyRecaps.id, recapId))
}
