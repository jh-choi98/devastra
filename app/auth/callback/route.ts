import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import type { User } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/auth/supabase-server'
import { getUserById } from '@/lib/db/queries/users'
import { captureServerEvent } from '@/lib/posthog-server'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { encryptToken } from '@/lib/db/encryption'

function readString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

async function ensurePublicUser(user: User): Promise<void> {
  const metadata = user.user_metadata as Record<string, unknown>
  const githubIdentity = user.identities?.find((identity) => identity.provider === 'github')
  const identityData = githubIdentity?.identity_data as Record<string, unknown> | undefined

  const githubIdRaw = readString(
    metadata.provider_id,
    metadata.sub,
    identityData?.provider_id,
    identityData?.sub,
  )
  const githubId = githubIdRaw ? Number(githubIdRaw) : NaN
  const githubLogin = readString(
    metadata.user_name,
    metadata.preferred_username,
    identityData?.user_name,
    identityData?.preferred_username,
  )

  if (!Number.isSafeInteger(githubId) || !githubLogin) {
    throw new Error('GitHub profile metadata missing from Supabase user')
  }

  const email = user.email ?? readString(metadata.email, identityData?.email)
  if (!email) {
    throw new Error('GitHub email missing from Supabase user')
  }

  await db
    .insert(users)
    .values({
      id: user.id,
      githubId,
      githubLogin,
      displayUsername: githubLogin.toLowerCase(),
      email,
      avatarUrl: readString(metadata.avatar_url, identityData?.avatar_url),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        githubId,
        githubLogin,
        email,
        avatarUrl: readString(metadata.avatar_url, identityData?.avatar_url),
      },
    })
}

async function persistProviderToken(userId: string, session: {
  provider_token?: string | null
  provider_refresh_token?: string | null
}): Promise<boolean> {
  if (!session.provider_token) return false
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
    const [updatedUser] = await db
      .select({ githubAccessTokenEnc: users.githubAccessTokenEnc })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return Boolean(updatedUser?.githubAccessTokenEnc)
  } catch (e) {
    // Token persistence is required before onboarding because repo discovery calls GitHub.
    console.error('persistProviderToken failed', e)
    return false
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

  try {
    await ensurePublicUser(user)
  } catch (e) {
    console.error('ensurePublicUser failed', e)
    return NextResponse.redirect(new URL('/?auth_error=profile_sync_failed', request.url))
  }

  // Persist the GitHub provider token so sync code can act as the user.
  // ensurePublicUser creates or refreshes the public.users row first, so token
  // persistence can update it reliably even if the auth trigger did not fire.
  const tokenPersisted = await persistProviderToken(user.id, {
    provider_token: exchangeData.session?.provider_token ?? null,
    provider_refresh_token: exchangeData.session?.provider_refresh_token ?? null,
  })
  if (!tokenPersisted) {
    return NextResponse.redirect(new URL('/?auth_error=github_token_missing', request.url))
  }

  await captureServerEvent(user.id, 'oauth.completed')

  const dbUser = await getUserById(user.id)

  if (!dbUser?.lastEventId) {
    return NextResponse.redirect(new URL('/onboarding/repos', request.url))
  }

  return NextResponse.redirect(new URL('/', request.url))
}
