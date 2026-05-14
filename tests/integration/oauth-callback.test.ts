import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/supabase-server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/db/queries/users', () => ({
  getUserById: vi.fn(),
}))

import { GET } from '@/app/auth/callback/route'
import { createServerClient } from '@/lib/auth/supabase-server'
import { getUserById } from '@/lib/db/queries/users'

const mockExchangeCodeForSession = vi.fn()
const mockGetUser = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createServerClient).mockReturnValue({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      getUser: mockGetUser,
    },
  } as unknown as ReturnType<typeof createServerClient>)
})

describe('GET /api/auth/callback', () => {
  it('redirects to /onboarding/repos when last_event_id is null', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid' } }, error: null })
    vi.mocked(getUserById).mockResolvedValue({
      id: 'user-uuid',
      lastEventId: null,
      githubId: 12345,
      githubLogin: 'testuser',
      displayUsername: 'testuser',
      email: 'test@example.com',
      avatarUrl: null,
      timezone: 'UTC',
      isPublic: false,
      emailRecapEnabled: true,
      githubAccessTokenEnc: null,
      githubRefreshTokenEnc: null,
      githubTokenExpiresAt: null,
      lastIncrementalSyncAt: null,
      lastLoginAt: null,
      createdAt: new Date(),
    })

    const request = new Request('http://localhost/api/auth/callback?code=test-code')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/onboarding/repos')
  })

  it('redirects to / when last_event_id exists', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid' } }, error: null })
    vi.mocked(getUserById).mockResolvedValue({
      id: 'user-uuid',
      lastEventId: 'evt-123',
      githubId: 12345,
      githubLogin: 'testuser',
      displayUsername: 'testuser',
      email: 'test@example.com',
      avatarUrl: null,
      timezone: 'UTC',
      isPublic: false,
      emailRecapEnabled: true,
      githubAccessTokenEnc: null,
      githubRefreshTokenEnc: null,
      githubTokenExpiresAt: null,
      lastIncrementalSyncAt: null,
      lastLoginAt: null,
      createdAt: new Date(),
    })

    const request = new Request('http://localhost/api/auth/callback?code=test-code')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('redirects to /?auth_error=cancelled on failed code exchange', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'invalid_grant', status: 400 },
    })

    const request = new Request('http://localhost/api/auth/callback?code=bad-code')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/?auth_error=cancelled')
  })

  it('redirects to /?auth_error=cancelled when no code is provided', async () => {
    const request = new Request('http://localhost/api/auth/callback')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/?auth_error=cancelled')
  })
})
