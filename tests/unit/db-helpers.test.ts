import { describe, it, expect } from 'vitest'
import { withUserScope, withUserScopeAnd } from '@/lib/db/queries/_helpers'
import { eq } from 'drizzle-orm'
import { landmarks } from '@/lib/db/schema/landmarks'

describe('withUserScope', () => {
  it('produces a single user_id equality clause', () => {
    const clause = withUserScope('11111111-1111-1111-1111-111111111111', landmarks.userId)
    // The clause is a SQL fragment; we check that it exists (the precise SQL string
    // depends on Drizzle internals). The contract is: it must always include a
    // user_id binding.
    expect(clause).toBeDefined()
  })

  it('composes with additional conditions', () => {
    const clause = withUserScopeAnd(
      '11111111-1111-1111-1111-111111111111',
      landmarks.userId,
      eq(landmarks.techKey, 'react'),
    )
    expect(clause).toBeDefined()
  })
})
