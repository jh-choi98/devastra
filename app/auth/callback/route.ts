import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createServerClient } from '@/lib/auth/supabase-server'
import { getUserById } from '@/lib/db/queries/users'
import { captureServerEvent } from '@/lib/posthog-server'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { encryptToken } from '@/lib/db/encryption'

async function persistProviderToken(userId: string, session: {
  provider_token?: string | null
  provider_refresh_token?: string | null
}): Promise<void> {
  if (!session.provider_token) return
  try {
    const accessTokenEnc = await encryptToken(session.provider_token)
    const refreshTokenEnc = session.provider_refresh_token
      ? await encryptToken(session.provider_refresh_token)
      : null
    await db
      .update(users)
      .set({
        githubAccessTokenEnc: accessTokenEnc,
        ...(refreshTokenEnc !== null ? { githubRefreshTokenEnc: refreshTokenEnc } : {}),
        // GitHub OAuth tokens are long-lived unless the app enables "Expiring user authorization tokens".
        // Supabase does not surface a provider-token expiry; leave null and let token.ts refresh on demand.
        githubTokenExpiresAt: null,
      })
      .where(eq(users.id, userId))
  } catch (e) {
    // Token persistence failure must not block sign-in (user can still log in; sync will surface
    // the missing-token error and prompt reconnect). Log via Sentry breadcrumb if available.
    console.error('persistProviderToken failed', e)
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/?auth_error=cancelled', request.url))
  }

  const supabase = createServerClient()
  const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/?auth_error=cancelled', request.url))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/?auth_error=cancelled', request.url))
  }

  // Persist the GitHub provider token so sync code can act as the user.
  // The handle_new_user trigger creates the public.users row from auth.users,
  // so by the time we reach here the row exists and we can UPDATE its token fields.
  await persistProviderToken(user.id, {
    provider_token: exchangeData.session?.provider_token ?? null,
    provider_refresh_token: exchangeData.session?.provider_refresh_token ?? null,
  })

  await captureServerEvent(user.id, 'oauth.completed')

  const dbUser = await getUserById(user.id)

  if (!dbUser?.lastEventId) {
    return NextResponse.redirect(new URL('/onboarding/repos', request.url))
  }

  return NextResponse.redirect(new URL('/', request.url))
}
