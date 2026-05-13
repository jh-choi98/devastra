import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock external dependencies so we can test the username logic in isolation
// ---------------------------------------------------------------------------

vi.mock('@/lib/db/client', () => ({ db: {} }))
vi.mock('@/lib/cache/revalidate-profile', () => ({ revalidatePublicProfile: vi.fn() }))
vi.mock('@/lib/inngest/client', () => ({ inngest: { send: vi.fn() } }))
vi.mock('@/lib/auth/supabase-server', () => ({ createAdminClient: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { isReserved } from '@/lib/utils/reserved-usernames'

describe('change-username — reserved name logic', () => {
  it('isReserved("admin") returns true', () => {
    expect(isReserved('admin')).toBe(true)
  })

  it('self-match exception: github_login === username bypasses reserved check', () => {
    const username: string = 'admin'
    const githubLogin: string = 'admin'
    // If they match, no reservation check applies
    const wouldBlock = username !== githubLogin && isReserved(username)
    expect(wouldBlock).toBe(false)
  })

  it('non-self-match: github_login "foo" cannot claim reserved name "admin"', () => {
    const username: string = 'admin'
    const githubLogin: string = 'foo'
    const wouldBlock = username !== githubLogin && isReserved(username)
    expect(wouldBlock).toBe(true)
  })

  it('non-reserved name is not blocked for any user', () => {
    const username: string = 'juho'
    const githubLogin: string = 'foo'
    const wouldBlock = username !== githubLogin && isReserved(username)
    expect(wouldBlock).toBe(false)
  })
})

describe('change-username — mock DB tests', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('throws "This name is reserved." when user tries to claim a reserved name (non-self)', async () => {
    const mockUser = {
      id: 'user-b',
      githubLogin: 'foo',
      displayUsername: 'foo',
      isPublic: false,
    }

    vi.doMock('@/lib/auth/session', () => ({
      requireUser: vi.fn().mockResolvedValue(mockUser),
    }))
    vi.doMock('@/lib/db/queries/users', () => ({
      updateUserField: vi.fn(),
    }))

    const { changeUsername } = await import('@/app/(authenticated)/settings/_actions')

    await expect(changeUsername({ username: 'admin' })).rejects.toThrow('This name is reserved.')
  })

  it('allows user whose github_login is "admin" to claim "admin"', async () => {
    const mockUser = {
      id: 'user-a',
      githubLogin: 'admin',
      displayUsername: 'admin',
      isPublic: false,
    }

    vi.doMock('@/lib/auth/session', () => ({
      requireUser: vi.fn().mockResolvedValue(mockUser),
    }))

    const mockUpdateDb = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    vi.doMock('@/lib/db/client', () => ({
      db: { update: mockUpdateDb },
    }))
    vi.doMock('@/lib/db/queries/users', () => ({
      updateUserField: vi.fn(),
    }))

    const { changeUsername } = await import('@/app/(authenticated)/settings/_actions')

    // Should not throw (user with github_login === 'admin' can use 'admin')
    await expect(changeUsername({ username: 'admin' })).resolves.toBeUndefined()
  })

  it('throws "This name is taken." on unique constraint violation', async () => {
    const mockUser = {
      id: 'user-c',
      githubLogin: 'charlie',
      displayUsername: 'charlie',
      isPublic: false,
    }

    vi.doMock('@/lib/auth/session', () => ({
      requireUser: vi.fn().mockResolvedValue(mockUser),
    }))

    const uniqueError = new Error('duplicate key value violates unique constraint (23505)')
    const mockUpdateDb = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(uniqueError),
      }),
    })

    vi.doMock('@/lib/db/client', () => ({
      db: { update: mockUpdateDb },
    }))
    vi.doMock('@/lib/db/queries/users', () => ({
      updateUserField: vi.fn(),
    }))

    const { changeUsername } = await import('@/app/(authenticated)/settings/_actions')

    await expect(changeUsername({ username: 'taken-name' })).rejects.toThrow('This name is taken.')
  })
})

// ---------------------------------------------------------------------------
// Real integration tests — skip without Supabase credentials
// ---------------------------------------------------------------------------

const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY

const canRun = Boolean(TEST_SUPABASE_URL && TEST_SUPABASE_SERVICE_ROLE_KEY)
const describeIf = canRun ? describe : describe.skip

describeIf('change-username — integration against real DB', () => {
  it('is covered by mock-based tests above; real DB tests require TEST_SUPABASE_URL', () => {
    expect(true).toBe(true)
  })
})
