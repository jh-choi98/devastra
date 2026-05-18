import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/supabase-server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/db/queries/users', () => ({
  getUserById: vi.fn(),
}))

vi.mock('@/lib/db/encryption', () => ({
  encryptToken: vi.fn(async () => Buffer.from('encrypted-token')),
}))

vi.mock('@/lib/db/client', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(async () => undefined),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ githubAccessTokenEnc: Buffer.from('encrypted-token') }]),
        })),
      })),
    })),
  },
}))

import { GET } from '@/app/auth/callback/route'
import { createServerClient } from '@/lib/auth/supabase-server'
import { getUserById } from '@/lib/db/queries/users'

const mockExchangeCodeForSession = vi.fn()
const mockGetUser = vi.fn()

const mockSupabaseUser = {
  id: 'user-uuid',
  email: 'test@example.com',
  user_metadata: {
    provider_id: '12345',
    user_name: 'testuser',
    avatar_url: null,
  },
  identities: [
    {
      provider: 'github',
      identity_data: {
        provider_id: '12345',
        user_name: 'testuser',
      },
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createServerClient).mockReturnValue({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      getUser: mockGetUser,
    },
  } as unknown as ReturnType<typeof createServerClient>)
})

describe('GET /auth/callback', () => {
  it('redirects to /onboarding/repos when last_event_id is null', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: { provider_token: 'gho_test' } },
      error: null,
    })
    mockGetUser.mockResolvedValue({ data: { user: mockSupabaseUser }, error: null })
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
      clusterClickHintSeen: false,
      shareHintSeen: false,
      recapDiffHintSeen: false,
      firstStarCinematicSeen: false,
      firstStarCinematicPending: false,
      createdAt: new Date(),
    })

    const request = new Request('http://localhost/auth/callback?code=test-code')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/onboarding/repos')
  })

  it('redirects to / when last_event_id exists', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: { provider_token: 'gho_test' } },
      error: null,
    })
    mockGetUser.mockResolvedValue({ data: { user: mockSupabaseUser }, error: null })
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
      clusterClickHintSeen: false,
      shareHintSeen: false,
      recapDiffHintSeen: false,
      firstStarCinematicSeen: false,
      firstStarCinematicPending: false,
      createdAt: new Date(),
    })

    const request = new Request('http://localhost/auth/callback?code=test-code')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('redirects to /?auth_error=github_token_missing when provider token is absent', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: null })
    mockGetUser.mockResolvedValue({ data: { user: mockSupabaseUser }, error: null })

    const request = new Request('http://localhost/auth/callback?code=test-code')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost/?auth_error=github_token_missing',
    )
  })

  it('redirects to /?auth_error=cancelled on failed code exchange', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'invalid_grant', status: 400 },
    })

    const request = new Request('http://localhost/auth/callback?code=bad-code')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/?auth_error=cancelled')
  })

  it('redirects to /?auth_error=cancelled when no code is provided', async () => {
    const request = new Request('http://localhost/auth/callback')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/?auth_error=cancelled')
  })
})
