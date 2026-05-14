import 'server-only'
import { and, eq, or, isNull, gt, desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { systemMessages } from '@/lib/db/schema/system-messages'

export type SystemMessageRow = typeof systemMessages.$inferSelect

export async function getActiveSystemMessage(): Promise<SystemMessageRow | null> {
  const now = new Date()
  const rows = await db
    .select()
    .from(systemMessages)
    .where(
      and(
        eq(systemMessages.active, true),
        or(isNull(systemMessages.expiresAt), gt(systemMessages.expiresAt, now)),
      ),
    )
    .orderBy(desc(systemMessages.createdAt))

  if (rows.length === 0) return null

  const SEV_RANK: Record<string, number> = { error: 3, warning: 2, info: 1 }
  rows.sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0))
  return rows[0]
}
