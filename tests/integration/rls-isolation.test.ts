import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
const TEST_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY

const canRun = Boolean(
  TEST_SUPABASE_URL && TEST_SUPABASE_SERVICE_ROLE_KEY && TEST_SUPABASE_ANON_KEY,
)

const describeIf = canRun ? describe : describe.skip

describeIf('RLS isolation', () => {
  const adminClient = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_SERVICE_ROLE_KEY!)

  let userAId: string
  let userBId: string
  let userAEmail: string
  let userBEmail: string
  const testPassword = 'Test1234!RLS'

  beforeAll(async () => {
    userAEmail = `rls-test-a-${Date.now()}@example.com`
    userBEmail = `rls-test-b-${Date.now()}@example.com`

    const { data: a, error: aErr } = await adminClient.auth.admin.createUser({
      email: userAEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        provider_id: String(Date.now()),
        user_name: `user_a_${Date.now()}`,
        avatar_url: null,
      },
    })
    if (aErr) throw new Error(`Failed to create user A: ${aErr.message}`)
    userAId = a.user!.id

    const { data: b, error: bErr } = await adminClient.auth.admin.createUser({
      email: userBEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        provider_id: String(Date.now() + 1),
        user_name: `user_b_${Date.now()}`,
        avatar_url: null,
      },
    })
    if (bErr) throw new Error(`Failed to create user B: ${bErr.message}`)
    userBId = b.user!.id

    // Insert sample data owned by user A via service role
    await adminClient.from('territories').upsert({
      user_id: userAId,
      type: 'frontend_land',
      total_weight: '100',
      stage: 2,
      growth_30d: '50',
    })

    await adminClient.from('landmarks').upsert({
      user_id: userAId,
      tech_key: 'react',
      territory_type: 'frontend_land',
      weight: '10',
    })

    await adminClient.from('sync_jobs').insert({
      user_id: userAId,
      kind: 'initial',
      status: 'completed',
    })

    await adminClient.from('weekly_recaps').upsert(
      {
        user_id: userAId,
        week_start: '2026-05-05',
        highlights: { top_growth: null, new_landmarks: [], stage_ups: [], stats: {} },
      },
      { onConflict: 'user_id,week_start' },
    )

    await adminClient.from('email_sends').insert({
      user_id: userAId,
      email_type: 'weekly_recap_active',
    })
  })

  afterAll(async () => {
    await adminClient.auth.admin.deleteUser(userAId)
    await adminClient.auth.admin.deleteUser(userBId)
  })

  async function signInAsUserB() {
    const client = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_ANON_KEY!)
    const { error } = await client.auth.signInWithPassword({
      email: userBEmail,
      password: testPassword,
    })
    if (error) throw new Error(`Failed to sign in as user B: ${error.message}`)
    return client
  }

  it('user B cannot read user A territories when A is private', async () => {
    const clientB = await signInAsUserB()
    const { data } = await clientB.from('territories').select('*').eq('user_id', userAId)
    expect(data).toHaveLength(0)
  })

  it('user B cannot read user A landmarks when A is private', async () => {
    const clientB = await signInAsUserB()
    const { data } = await clientB.from('landmarks').select('*').eq('user_id', userAId)
    expect(data).toHaveLength(0)
  })

  it('user B cannot read user A sync_jobs', async () => {
    const clientB = await signInAsUserB()
    const { data } = await clientB.from('sync_jobs').select('*').eq('user_id', userAId)
    expect(data).toHaveLength(0)
  })

  it('user B cannot read user A weekly_recaps', async () => {
    const clientB = await signInAsUserB()
    const { data } = await clientB.from('weekly_recaps').select('*').eq('user_id', userAId)
    expect(data).toHaveLength(0)
  })

  it('user B cannot read user A email_sends', async () => {
    const clientB = await signInAsUserB()
    const { data } = await clientB.from('email_sends').select('*').eq('user_id', userAId)
    expect(data).toHaveLength(0)
  })

  it('user B CAN read user A territories and landmarks when A is public', async () => {
    // Make user A public
    await adminClient.from('users').update({ is_public: true }).eq('id', userAId)

    const clientB = await signInAsUserB()

    const { data: territories } = await clientB
      .from('territories')
      .select('*')
      .eq('user_id', userAId)
    expect(territories).not.toHaveLength(0)

    const { data: landmarks } = await clientB
      .from('landmarks')
      .select('*')
      .eq('user_id', userAId)
    expect(landmarks).not.toHaveLength(0)

    // Restore private
    await adminClient.from('users').update({ is_public: false }).eq('id', userAId)
  })
})
