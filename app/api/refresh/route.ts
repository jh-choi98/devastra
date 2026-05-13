import { NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import { requireUser } from '@/lib/auth/session'
import { EVENTS } from '@/features/sync/events'

export async function POST() {
  const user = await requireUser()

  await inngest.send({
    name: EVENTS.SYNC_MANUAL_REQUESTED,
    data: { userId: user.id },
  })

  return NextResponse.json({ dispatched: true })
}
