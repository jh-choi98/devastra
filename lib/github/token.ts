import 'server-only'

// GitHub OAuth access tokens expire in 8h when expiring tokens are enabled on the OAuth App.
// Refresh tokens are only issued if "Expiring user authorization tokens" is turned on in the
// GitHub OAuth App settings. If absent, the access token may be long-lived; we still check
// `github_token_expires_at` before deciding to refresh. If refresh fails due to missing
// GITHUB_OAUTH_CLIENT_ID/SECRET, the error message will indicate the missing env vars.

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { decryptToken, encryptToken } from '@/lib/db/encryption'
import { GITHUB_USER_AGENT } from './graphql'

export async function refreshAccessToken(userId: string): Promise<string> {
  const [user] = await db
    .select({ githubRefreshTokenEnc: users.githubRefreshTokenEnc })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user?.githubRefreshTokenEnc) {
    throw new Error('No refresh token available for user — cannot refresh access token')
  }

  const refreshToken = await decryptToken(user.githubRefreshTokenEnc)

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'GITHUB_OAUTH_CLIENT_ID / GITHUB_OAUTH_CLIENT_SECRET not set. ' +
        'If you see "Authorization: Basic" errors from GitHub, ensure these env vars are configured.',
    )
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': GITHUB_USER_AGENT,
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    throw new Error(`Token refresh HTTP error: ${response.status}`)
  }

  const data = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (data.error) {
    throw new Error(`Token refresh error: ${data.error} — ${data.error_description ?? ''}`)
  }

  if (!data.access_token) {
    throw new Error('Token refresh returned no access_token')
  }

  const newAccessTokenEnc = await encryptToken(data.access_token)
  const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null

  if (data.refresh_token) {
    const newRefreshTokenEnc = await encryptToken(data.refresh_token)
    await db
      .update(users)
      .set({
        githubAccessTokenEnc: newAccessTokenEnc,
        githubTokenExpiresAt: expiresAt,
        githubRefreshTokenEnc: newRefreshTokenEnc,
      })
      .where(eq(users.id, userId))
  } else {
    await db
      .update(users)
      .set({
        githubAccessTokenEnc: newAccessTokenEnc,
        githubTokenExpiresAt: expiresAt,
      })
      .where(eq(users.id, userId))
  }

  return data.access_token
}

export async function getUsableAccessToken(userId: string): Promise<string> {
  const [user] = await db
    .select({
      githubAccessTokenEnc: users.githubAccessTokenEnc,
      githubTokenExpiresAt: users.githubTokenExpiresAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user?.githubAccessTokenEnc) {
    throw new Error('No GitHub access token for user')
  }

  const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000)
  const needsRefresh =
    user.githubTokenExpiresAt != null && user.githubTokenExpiresAt < tenMinutesFromNow

  if (needsRefresh) {
    return refreshAccessToken(userId)
  }

  return decryptToken(user.githubAccessTokenEnc)
}
