import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { territories } from '@/lib/db/schema/territories'
import { landmarks } from '@/lib/db/schema/landmarks'
import { withUserScope } from './_helpers'

export type LandingDemoData = {
  user: { id: string; displayUsername: string; isPublic: boolean }
  territories: (typeof territories.$inferSelect)[]
  landmarks: (typeof landmarks.$inferSelect)[]
}

export async function getLandingDemoData(): Promise<LandingDemoData | null> {
  const demoLogin = process.env.LANDING_DEMO_GITHUB_LOGIN
  if (!demoLogin) return null

  const [user] = await db
    .select({ id: users.id, displayUsername: users.displayUsername, isPublic: users.isPublic })
    .from(users)
    .where(sql`lower(${users.githubLogin}) = lower(${demoLogin})`)
    .limit(1)

  if (!user || !user.isPublic) return null

  const [territoriesRows, landmarksRows] = await Promise.all([
    db.select().from(territories).where(withUserScope(user.id, territories.userId)),
    db.select().from(landmarks).where(withUserScope(user.id, landmarks.userId)),
  ])

  return { user, territories: territoriesRows, landmarks: landmarksRows }
}
