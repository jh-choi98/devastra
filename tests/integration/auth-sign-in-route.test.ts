import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/supabase-server', () => ({
  createServerClient: vi.fn(),
}))

import { GET } from '@/app/api/auth/sign-in/route'
import { createServerClient } from '@/lib/auth/supabase-server'

const mockSignInWithOAuth = vi.fn()

describe('GET /api/auth/sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('APP_HOSTNAME_ALLOWLIST', 'localhost:3000,devastra.app')
    vi.stubEnv('PLAYWRIGHT_USE_MOCK_OAUTH', '')
    vi.stubEnv('ALLOW_MOCK_OAUTH', '')
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://github.com/login/oauth/authorize?client_id=test' },
      error: null,
    })
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        signInWithOAuth: mockSignInWithOAuth,
      },
    } as unknown as ReturnType<typeof createServerClient>)
  })

  it('starts GitHub OAuth with the callback URL for the current origin', async () => {
    const response = await GET(
      new Request('http://localhost:3000/api/auth/sign-in', {
        headers: { origin: 'http://localhost:3000' },
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://github.com/login/oauth/authorize?client_id=test',
    )
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: {
        scopes: 'read:user user:email',
        redirectTo: 'http://localhost:3000/auth/callback',
      },
    })
  })

  it('redirects to a safe error when the host is not allowlisted', async () => {
    const response = await GET(
      new Request('https://evil.example/api/auth/sign-in', {
        headers: { host: 'evil.example' },
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://evil.example/?auth_error=disallowed_host',
    )
    expect(mockSignInWithOAuth).not.toHaveBeenCalled()
  })

  it('redirects to the gated mock OAuth route in local Playwright mode', async () => {
    vi.stubEnv('PLAYWRIGHT_USE_MOCK_OAUTH', '1')
    vi.stubEnv('ALLOW_MOCK_OAUTH', '1')

    const response = await GET(new Request('http://localhost:3000/api/auth/sign-in'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/api/test/mock-oauth')
    expect(mockSignInWithOAuth).not.toHaveBeenCalled()
  })

  it('surfaces an OAuth start failure as the existing landing error', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({
      data: { url: null },
      error: { message: 'provider unavailable' },
    })

    const response = await GET(new Request('http://localhost:3000/api/auth/sign-in'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/?auth_error=oauth_failed',
    )
  })
})
