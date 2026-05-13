import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'

export type DbUser = typeof users.$inferSelect

export async function getUserById(id: string): Promise<DbUser | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id))
  return user ?? null
}
