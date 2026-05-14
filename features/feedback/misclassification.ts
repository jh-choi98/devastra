import 'server-only'
import { and, eq, gte, count } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { misclassificationFeedback } from '@/lib/db/schema/misclassification-feedback'
import { withUserScopeAnd } from '@/lib/db/queries/_helpers'

const RATE_LIMIT_COUNT = 5
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000

export type SubmitInput = {
  userId: string
  tech_key: string
  territory_type: string
  related_repo_id: string | null
  category: 'wrong_category' | 'shouldnt_be_lit' | 'not_mine' | 'other'
  note: string | null
}

export type SubmitResult =
  | { kind: 'ok' }
  | { kind: 'rate_limited' }
  | { kind: 'error'; message: string }

export async function submitMisclassificationFeedback(input: SubmitInput): Promise<SubmitResult> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)

  const [{ value: recentCount }] = await db
    .select({ value: count() })
    .from(misclassificationFeedback)
    .where(
      withUserScopeAnd(
        input.userId,
        misclassificationFeedback.userId,
        gte(misclassificationFeedback.createdAt, since),
      ),
    )

  if (recentCount >= RATE_LIMIT_COUNT) return { kind: 'rate_limited' }

  try {
    await db.insert(misclassificationFeedback).values({
      userId: input.userId,
      techKey: input.tech_key,
      territoryType: input.territory_type,
      relatedRepoId: input.related_repo_id,
      category: input.category,
      note: input.note,
    })
    return { kind: 'ok' }
  } catch (e) {
    return { kind: 'error', message: (e as Error).message }
  }
}
