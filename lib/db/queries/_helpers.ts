import 'server-only'
import { eq, and, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

/**
 * RLS bypass guard rail (ADR-46).
 *
 * Drizzle's direct Postgres connection bypasses RLS. This helper produces
 * a WHERE clause that scopes a query to a single user. All reads against
 * activities, territories, landmarks, email_sends, weekly_recaps,
 * misclassification_feedback, sync_jobs MUST use this helper.
 *
 * Usage:
 *   const rows = await db.select().from(landmarks).where(withUserScope(userId, landmarks.userId))
 */
export function withUserScope(userId: string, userIdColumn: PgColumn): SQL {
  return eq(userIdColumn, userId)
}

/**
 * Compose user scope with additional conditions.
 *
 * Usage:
 *   const rows = await db.select().from(landmarks).where(
 *     withUserScopeAnd(userId, landmarks.userId, eq(landmarks.techKey, 'react'))
 *   )
 */
export function withUserScopeAnd(
  userId: string,
  userIdColumn: PgColumn,
  ...additional: (SQL | undefined)[]
): SQL {
  const conds = [eq(userIdColumn, userId), ...additional.filter(Boolean)] as SQL[]
  return and(...conds)!
}
