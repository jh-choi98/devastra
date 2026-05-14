import { Webhook } from 'svix'
import { NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { emailSends } from '@/lib/db/schema/email-sends'
import { users } from '@/lib/db/schema/users'

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ ok: false, reason: 'no_secret' }, { status: 500 })

  const rawBody = await req.text()
  const svixHeaders = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  }

  let body: Record<string, unknown>
  try {
    const wh = new Webhook(secret)
    body = wh.verify(rawBody, svixHeaders) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_signature' }, { status: 401 })
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
