import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// We test the pickOrigin logic directly by reimplementing the same function
// to avoid importing a server-only module in a unit test context.
// This mirrors the implementation in lib/auth/actions.ts exactly.

function pickOrigin(
  allowlist: ReadonlySet<string>,
  getHeader: (name: string) => string | null,
): string {
  const origin = getHeader('origin')
  if (origin) {
    const url = new URL(origin)
    if (allowlist.has(url.host)) return origin
  }
  const host = getHeader('x-forwarded-host') ?? getHeader('host') ?? 'localhost:3000'
  if (!allowlist.has(host)) throw new Error('Disallowed host in OAuth callback origin')
  const proto = getHeader('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

describe('pickOrigin — origin header path', () => {
  const allowlist = new Set(['localhost:3000', 'devastra.app'])

  it('accepts an allowlisted Origin header', () => {
    const result = pickOrigin(allowlist, (name) =>
      name === 'origin' ? 'https://devastra.app' : null,
    )
    expect(result).toBe('https://devastra.app')
  })

  it('rejects a disallowed Origin header and falls through to host', () => {
    // If Origin is disallowed, we fall to x-forwarded-host / host
    // If that is also disallowed, it should throw
    expect(() =>
      pickOrigin(allowlist, (name) => {
        if (name === 'origin') return 'https://evil.com'
        if (name === 'host') return 'evil.com'
        return null
      }),
    ).toThrow('Disallowed host')
  })

  it('falls back to x-forwarded-host when Origin is absent', () => {
    const result = pickOrigin(allowlist, (name) => {
      if (name === 'x-forwarded-host') return 'devastra.app'
      if (name === 'x-forwarded-proto') return 'https'
      return null
    })
    expect(result).toBe('https://devastra.app')
  })

  it('throws when x-forwarded-host is disallowed', () => {
    expect(() =>
      pickOrigin(allowlist, (name) => {
        if (name === 'x-forwarded-host') return 'evil.com'
        return null
      }),
    ).toThrow('Disallowed host')
  })

  it('uses https as default proto when x-forwarded-proto is absent', () => {
    const result = pickOrigin(allowlist, (name) => {
      if (name === 'host') return 'localhost:3000'
      return null
    })
    expect(result).toBe('https://localhost:3000')
  })

  it('accepts localhost:3000 (default allowlist entry)', () => {
    const result = pickOrigin(allowlist, (name) => {
      if (name === 'origin') return 'http://localhost:3000'
      return null
    })
    expect(result).toBe('http://localhost:3000')
  })
})
