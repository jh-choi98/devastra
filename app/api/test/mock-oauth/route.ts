import { notFound } from 'next/navigation'
import { NextResponse } from 'next/server'

const TEST_GITHUB_ID = 999999999
const TEST_GITHUB_LOGIN = 'test-e2e-user'
const TEST_PASSWORD = 'test-e2e-password-devonly'

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') notFound()

  // Double-gated: must be non-production AND ALLOW_MOCK_OAUTH must be explicitly set.
  // Both conditions required — a single env var is not sufficient protection.
  if (process.env.ALLOW_MOCK_OAUTH !== '1') {
    return new NextResponse('Not Found', { status: 404 })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const { createAdminClient } = await import('@/lib/auth/supabase-server')
  const { db } = await import('@/lib/db/client')
  const { users } = await import('@/lib/db/schema/users')
  const { eq } = await import('drizzle-orm')

  const adminClient = createAdminClient()
  const testEmail = `${TEST_GITHUB_LOGIN}+${Date.now()}@test.devastra.local`
  await db.delete(users).where(eq(users.githubLogin, TEST_GITHUB_LOGIN))

  const { error: createError } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      provider_id: String(TEST_GITHUB_ID),
      user_name: TEST_GITHUB_LOGIN,
      avatar_url: null,
    },
  })
  if (createError) {
    return new NextResponse(`Failed to create test user: ${createError.message}`, {
      status: 500,
    })
  }

  // Sign in to get a session token
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
    email: testEmail,
    password: TEST_PASSWORD,
  })

  if (signInError || !signInData.session) {
    return new NextResponse(`Failed to sign in test user: ${signInError?.message}`, { status: 500 })
  }

  const userId = signInData.session.user.id

  // Upsert the test user row in public.users
  await db
    .insert(users)
    .values({
      id: userId,
      githubId: TEST_GITHUB_ID,
      githubLogin: TEST_GITHUB_LOGIN,
      displayUsername: TEST_GITHUB_LOGIN,
      email: testEmail,
      avatarUrl: null,
      isPublic: false,
      emailRecapEnabled: true,
      timezone: 'UTC',
      lastEventId: null,
    })
    .onConflictDoNothing()

  // Set cookies and redirect to onboarding
  const redirectUrl = new URL('/onboarding/repos', request.url)
  const response = NextResponse.redirect(redirectUrl)

  const projectRef =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1] ?? 'local'
  const cookieValue = `base64-${Buffer.from(JSON.stringify(signInData.session)).toString('base64url')}`
  response.cookies.set(`sb-${projectRef}-auth-token`, cookieValue, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  })

  return response
}
