import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

// ---------------------------------------------------------------------------
// Mock-based unit tests — run without a real Supabase instance
// ---------------------------------------------------------------------------

vi.mock('@/lib/db/client', () => ({ db: {} }))

describe('public-profile-visibility — profile result shape', () => {
  it('returns null when no row is found (private or unknown user)', async () => {
    const { db } = await import('@/lib/db/client')
    const mockDb = db as unknown as Record<string, unknown>

    // Override execute to return empty rows
    mockDb['execute'] = vi.fn().mockResolvedValue([])
    mockDb['select'] = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    })

    const { getPublicProfileByUsername } = await import(
      '@/lib/db/queries/public-profile'
    )

    const result = await getPublicProfileByUsername('nonexistent_user')
    expect(result).toBeNull()
  })

  it('returns public profile with map data when user is found in the view', async () => {
    const { db } = await import('@/lib/db/client')
    const mockDb = db as unknown as Record<string, unknown>

    const fakeUserId = 'test-user-id'
    mockDb['execute'] = vi.fn().mockResolvedValue([
      { id: fakeUserId, display_username: 'testuser', avatar_url: null },
    ])
    mockDb['select'] = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn()
          .mockResolvedValueOnce([
            {
              userId: fakeUserId,
              type: 'frontend_land',
              stage: 2,
              totalWeight: '120',
              growth30d: '40',
              stageChangedAt: null,
            },
          ])
          .mockResolvedValueOnce([
            {
              userId: fakeUserId,
              techKey: 'react',
              territoryType: 'frontend_land',
              weight: '10',
              firstUnlockedAt: null,
            },
          ]),
      }),
    })

    const { getPublicProfileByUsername } = await import(
      '@/lib/db/queries/public-profile'
    )

    const result = await getPublicProfileByUsername('testuser')
    expect(result).not.toBeNull()
    expect(result?.isPublic).toBe(true)
    expect(result?.username).toBe('testuser')

    if (result && result.isPublic) {
      expect(result.map.territories).toHaveLength(1)
      expect(result.map.territories[0].type).toBe('frontend_land')
      expect(result.map.territories[0].stage).toBe(2)
      // email and sync state fields must NOT be present
      expect('email' in result).toBe(false)
      expect('lastEventId' in result).toBe(false)
      expect('githubAccessTokenEnc' in result).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Integration tests — skip without real Supabase credentials
// ---------------------------------------------------------------------------

const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY

const canRun = Boolean(TEST_SUPABASE_URL && TEST_SUPABASE_SERVICE_ROLE_KEY)
const describeIf = canRun ? describe : describe.skip

describeIf('public-profile-visibility — integration', () => {
  let adminClient: ReturnType<typeof createTestClient>
  let userAId: string
  let userAUsername: string
  let userBId: string
  let userBUsername: string

  function createTestClient() {
    const { createClient } = require('@supabase/supabase-js')
    return createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_SERVICE_ROLE_KEY!)
  }

  beforeAll(async () => {
    const { createClient } = await import('@supabase/supabase-js')
    adminClient = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_SERVICE_ROLE_KEY!)

    const ts = Date.now()
    userAUsername = `visibility_a_${ts}`
    userBUsername = `visibility_b_${ts}`

    // Create user A (will be made public)
    const { data: a, error: aErr } = await adminClient.auth.admin.createUser({
      email: `${userAUsername}@example.com`,
      password: 'Test1234!vis',
      email_confirm: true,
      user_metadata: {
        provider_id: String(ts),
        user_name: userAUsername,
        avatar_url: null,
      },
    })
    if (aErr) throw new Error(`Failed to create user A: ${aErr.message}`)
    userAId = a.user!.id

    // Create user B (stays private)
    const { data: b, error: bErr } = await adminClient.auth.admin.createUser({
      email: `${userBUsername}@example.com`,
      password: 'Test1234!vis',
      email_confirm: true,
      user_metadata: {
        provider_id: String(ts + 1),
        user_name: userBUsername,
        avatar_url: null,
      },
    })
    if (bErr) throw new Error(`Failed to create user B: ${bErr.message}`)
    userBId = b.user!.id

    // Insert territory data for user A
    await adminClient.from('territories').upsert({
      user_id: userAId,
      type: 'frontend_land',
      total_weight: '100',
      stage: 2,
      growth_30d: '50',
    })

    // Make user A public
    await adminClient.from('users').update({ is_public: true }).eq('id', userAId)
  })

  afterAll(async () => {
    if (userAId) await adminClient.auth.admin.deleteUser(userAId)
    if (userBId) await adminClient.auth.admin.deleteUser(userBId)
  })

  it('getPublicProfileByUsername returns map data for public user A', async () => {
    const { getPublicProfileByUsername } = await import('@/lib/db/queries/public-profile')
    const result = await getPublicProfileByUsername(userAUsername)

    expect(result).not.toBeNull()
    expect(result?.isPublic).toBe(true)
    if (result && result.isPublic) {
      expect(result.username).toBe(userAUsername)
      // email and sync-state fields must never appear in the public result
      expect('email' in result).toBe(false)
      expect('lastEventId' in result).toBe(false)
      expect('githubAccessTokenEnc' in result).toBe(false)
    }
  })

  it('getPublicProfileByUsername returns null for private user B', async () => {
    const { getPublicProfileByUsername } = await import('@/lib/db/queries/public-profile')
    const result = await getPublicProfileByUsername(userBUsername)
    expect(result).toBeNull()
  })
})
