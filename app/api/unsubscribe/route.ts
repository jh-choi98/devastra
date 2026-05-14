import 'server-only'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'

const bodySchema = z.object({
  token: z.string().min(10),
  action: z.enum(['unsubscribe', 'undo']),
})

export async function POST(req: Request) {
  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ ok: false }, { status: 400 })

  const verification = await verifyUnsubscribeToken(body.data.token)
  if (!verification.ok) {
    return NextResponse.json({ ok: false, reason: verification.reason }, { status: 401 })
  }

  const enabled = body.data.action === 'undo'
  await db
    .update(users)
    .set({ emailRecapEnabled: enabled })
    .where(eq(users.id, verification.payload.user_id))

  return NextResponse.json({ ok: true })
}
