import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { landmarks } from '@/lib/db/schema/landmarks'

export type DbLandmark = typeof landmarks.$inferSelect

export async function getLandmarksForUser(userId: string): Promise<DbLandmark[]> {
  return db.select().from(landmarks).where(eq(landmarks.userId, userId))
}

export async function deleteUserLandmarks(userId: string): Promise<void> {
  await db.delete(landmarks).where(eq(landmarks.userId, userId))
}
