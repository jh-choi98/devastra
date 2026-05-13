import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { territories } from '@/lib/db/schema/territories'

export type DbTerritory = typeof territories.$inferSelect

export async function getTerritoriesForUser(userId: string): Promise<DbTerritory[]> {
  return db.select().from(territories).where(eq(territories.userId, userId))
}
