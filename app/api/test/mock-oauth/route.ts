import { notFound } from 'next/navigation'
import { NextResponse } from 'next/server'

const TEST_GITHUB_ID = 999999999
const TEST_GITHUB_LOGIN = 'test-e2e-user'
const TEST_EMAIL = `${TEST_GITHUB_LOGIN}@test.devastra.local`
const TEST_PASSWORD = 'test-e2e-password-devonly'

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') notFound()

  // Double-gated: must be non-production AND ALLOW_MOCK_OAUTH must be explicitly set.
  // Both conditions required — a single env var is not sufficient protection.
  if (process.env.ALLOW_MOCK_OAUTH !== '1') {
    return new NextResponse('Not Found', { status: 404 })
  }

  const { createAdminClient } = await import('@/lib/auth/supabase-server')
  const { db } = await import('@/lib/db/client')
  const { users } = await import('@/lib/db/schema/users')
  const { createBrowserClient } = await import('@/lib/auth/supabase-browser')

  const adminClient = createAdminClient()

  // Ensure test user exists in Supabase Auth
  const { data: listData } = await adminClient.auth.admin.listUsers()
  const existingAuthUser = listData?.users?.find((u) => u.email === TEST_EMAIL)

  if (!existingAuthUser) {
    await adminClient.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
  } else if (!existingAuthUser.email_confirmed_at) {
    await adminClient.auth.admin.updateUserById(existingAuthUser.id, {
      email_confirm: true,
      password: TEST_PASSWORD,
    })
  }

  // Sign in to get a session token
  const anonClient = createBrowserClient()
  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
    email: TEST_EMAIL,
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
      email: TEST_EMAIL,
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

  // Supabase SSR uses these cookie names
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1] ?? 'local'
  response.cookies.set(`sb-${projectRef}-auth-token`, JSON.stringify(signInData.session), {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  })

  return response
}
