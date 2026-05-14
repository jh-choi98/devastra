import { describe, it, expect, beforeEach } from 'vitest'
import { signUnsubscribeToken, verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'

describe('unsubscribe-token', () => {
  beforeEach(() => {
    process.env.UNSUBSCRIBE_TOKEN_SECRET = 'test-secret-32-bytes-minimum-for-hmac-sha256'
    process.env.UNSUBSCRIBE_TOKEN_VERSION = '1'
  })

  it('signs and verifies a token round-trip', async () => {
    const token = await signUnsubscribeToken('user-123', 'weekly_recap_active')
    const result = await verifyUnsubscribeToken(token)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.user_id).toBe('user-123')
      expect(result.payload.email_type).toBe('weekly_recap_active')
      expect(result.payload.version).toBe(1)
    }
  })

  it('rejects a token with mismatched version', async () => {
    const token = await signUnsubscribeToken('user-123', 'weekly_recap_empty')
    process.env.UNSUBSCRIBE_TOKEN_VERSION = '2'
    const result = await verifyUnsubscribeToken(token)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('version_mismatch')
  })

  it('rejects a tampered token', async () => {
    const token = await signUnsubscribeToken('user-123', 'weekly_recap_active')
    const tampered = token.slice(0, -5) + 'xxxxx'
    const result = await verifyUnsubscribeToken(tampered)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_signature')
  })
})
