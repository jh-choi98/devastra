import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { usernameHistory } from '@/lib/db/schema/username-history'

export type ResolveResult =
  | { kind: 'current'; userId: string; canonicalUsername: string }
  | { kind: 'redirect'; userId: string; canonicalUsername: string }
  | { kind: 'not_found' }

/**
 * Resolve a /{username} path segment to a current user.
 *
 * - kind = 'current' → username matches users.display_username; render the page.
 * - kind = 'redirect' → username matches username_history.old_username; the
 *   caller should issue a 301 redirect to /{canonicalUsername}.
 * - kind = 'not_found' → no user; render 404.
 *
 * Per ADR-30, old usernames are permanently mapped and the redirect is
 * permanent (301).
 */
export async function resolveUsername(rawUsername: string): Promise<ResolveResult> {
  // Normalize: lowercase. The display_username regex forbids upper-case, but
  // the URL may arrive with arbitrary casing.
  const username = rawUsername.toLowerCase()

  const currentRows = await db
    .select({ id: users.id, displayUsername: users.displayUsername })
    .from(users)
    .where(eq(sql`lower(${users.displayUsername})`, username))
    .limit(1)

  if (currentRows[0]) {
    return {
      kind: 'current',
      userId: currentRows[0].id,
      canonicalUsername: currentRows[0].displayUsername,
    }
  }

  const historyRows = await db
    .select({ userId: usernameHistory.userId })
    .from(usernameHistory)
    .where(eq(usernameHistory.oldUsername, username))
    .limit(1)

  if (historyRows[0]) {
    const ownerRows = await db
      .select({ id: users.id, displayUsername: users.displayUsername })
      .from(users)
      .where(eq(users.id, historyRows[0].userId))
      .limit(1)

    if (ownerRows[0]) {
      return {
        kind: 'redirect',
        userId: ownerRows[0].id,
        canonicalUsername: ownerRows[0].displayUsername,
      }
    }
  }

  return { kind: 'not_found' }
}
