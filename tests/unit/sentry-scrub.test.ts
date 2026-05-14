import { describe, it, expect } from 'vitest'
import { scrubString, scrubHeaders, scrubEvent, TOKEN_PATTERN } from '@/lib/sentry-scrub'
import type { ErrorEvent } from '@sentry/nextjs'

describe('sentry-scrub scrubString', () => {
  it('redacts gho_ tokens', () => {
    const result = scrubString('token=gho_AbCdEfGhIjKlMnOp1234')
    expect(result).not.toContain('gho_')
    expect(result).toContain('[REDACTED]')
  })

  it('redacts ghu_ tokens', () => {
    const result = scrubString('Authorization: ghu_ABCDEFGHIJKLMNOP')
    expect(result).toContain('[REDACTED]')
    expect(result).not.toContain('ghu_')
  })

  it('redacts Bearer tokens', () => {
    const result = scrubString('Bearer AbCdEfGhIjKlMnOp1234')
    expect(result).toContain('[REDACTED]')
    expect(result).not.toContain('Bearer AbCdEfGh')
  })

  it('leaves non-sensitive strings unchanged', () => {
    const s = 'hello world, nothing sensitive here'
    expect(scrubString(s)).toBe(s)
  })

  it('handles undefined gracefully', () => {
    expect(scrubString(undefined)).toBeUndefined()
  })
})

describe('sentry-scrub scrubHeaders', () => {
  it('redacts authorization header', () => {
    const h = { Authorization: 'Bearer gho_secret123456789', 'Content-Type': 'application/json' }
    const out = scrubHeaders(h)!
    expect(out['Authorization']).toBe('[REDACTED]')
    expect(out['Content-Type']).toBe('application/json')
  })

  it('redacts cookie header case-insensitively', () => {
    const h = { Cookie: 'session=abc123', accept: 'text/html' }
    const out = scrubHeaders(h)!
    expect(out['Cookie']).toBe('[REDACTED]')
    expect(out['accept']).toBe('text/html')
  })

  it('redacts svix-signature header', () => {
    const h = { 'svix-signature': 'v1,abc123', other: 'value' }
    const out = scrubHeaders(h)!
    expect(out['svix-signature']).toBe('[REDACTED]')
    expect(out['other']).toBe('value')
  })

  it('handles undefined gracefully', () => {
    expect(scrubHeaders(undefined)).toBeUndefined()
  })

  it('also scrubs token patterns in non-sensitive header values', () => {
    const h = { 'x-debug': 'token=ghs_ABCDEFGHIJKLMNOP, user=alice' }
    const out = scrubHeaders(h)!
    expect(out['x-debug']).toContain('[REDACTED]')
    expect(out['x-debug']).not.toContain('ghs_')
  })
})

describe('sentry-scrub scrubEvent', () => {
  it('removes cookies from request', () => {
    const event: ErrorEvent = {
      type: undefined,
      request: { cookies: { session: 'abc' }, headers: {} },
    }
    const out = scrubEvent(event)
    expect(out.request?.cookies).toBeUndefined()
  })

  it('redacts authorization in request headers', () => {
    const event: ErrorEvent = {
      type: undefined,
      request: { headers: { authorization: 'Bearer gho_12345678901234', 'content-type': 'application/json' } },
    }
    const out = scrubEvent(event)
    expect(out.request?.headers?.['authorization']).toBe('[REDACTED]')
    expect(out.request?.headers?.['content-type']).toBe('application/json')
  })

  it('scrubs token from event message', () => {
    const event: ErrorEvent = {
      type: undefined,
      message: 'Error with token gho_ABCDEFGHIJKLMNOP in message',
    }
    const out = scrubEvent(event)
    expect(out.message).not.toContain('gho_')
    expect(out.message).toContain('[REDACTED]')
  })

  it('scrubs token from exception value', () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: {
        values: [{ value: 'Failed with ghu_ABCDEFGHIJKLMNOP', type: 'Error' }],
      },
    }
    const out = scrubEvent(event)
    expect(out.exception?.values?.[0].value).toContain('[REDACTED]')
  })
})

describe('TOKEN_PATTERN', () => {
  it('matches ghs_ prefix', () => {
    TOKEN_PATTERN.lastIndex = 0
    expect(TOKEN_PATTERN.test('ghs_ABCDEFGHIJKLMNOP')).toBe(true)
  })

  it('matches github_pat_ prefix', () => {
    TOKEN_PATTERN.lastIndex = 0
    expect(TOKEN_PATTERN.test('github_pat_ABCDEFGHIJKLMNOP')).toBe(true)
  })
})
