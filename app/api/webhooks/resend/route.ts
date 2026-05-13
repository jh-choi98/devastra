import { NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { emailSends } from '@/lib/db/schema/email-sends'
import { users } from '@/lib/db/schema/users'

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (secret) {
    const signature = req.headers.get('svix-signature') ?? req.headers.get('x-resend-signature')
    if (!signature || signature !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.type !== 'email.bounced') {
    return NextResponse.json({ ok: true })
  }

  const emailData = body.data as Record<string, unknown> | undefined
  const externalMessageId = emailData?.email_id as string | undefined

  if (!externalMessageId) {
    return NextResponse.json({ ok: true })
  }

  // Find the email_sends row
  const [send] = await db
    .select()
    .from(emailSends)
    .where(eq(emailSends.externalMessageId, externalMessageId))

  if (!send) {
    return NextResponse.json({ ok: true })
  }

  // Mark as bounced
  await db
    .update(emailSends)
    .set({ bounced: true })
    .where(eq(emailSends.id, send.id))

  // Count consecutive bounces (no non-bounced send after the earliest bounce)
  const recentSends = await db
    .select({ bounced: emailSends.bounced })
    .from(emailSends)
    .where(eq(emailSends.userId, send.userId))
    .orderBy(desc(emailSends.sentAt))
    .limit(10)

  let consecutiveBounces = 0
  for (const s of recentSends) {
    if (s.bounced) {
      consecutiveBounces++
    } else {
      break
    }
  }

  if (consecutiveBounces >= 3) {
    await db
      .update(users)
      .set({ emailRecapEnabled: false })
      .where(eq(users.id, send.userId))
  }

  return NextResponse.json({ ok: true })
}
