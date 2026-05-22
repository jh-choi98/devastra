import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/auth/supabase-server'

function getAllowedHosts(): ReadonlySet<string> {
  return new Set(
    (process.env.APP_HOSTNAME_ALLOWLIST ?? 'localhost:3000').split(',').map((s) => s.trim()),
  )
}

function pickOrigin(request: Request): string {
  const origin = request.headers.get('origin')
  if (origin) {
    const url = new URL(origin)
    if (getAllowedHosts().has(url.host)) return origin
  }

  const requestUrl = new URL(request.url)
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? requestUrl.host
  if (!getAllowedHosts().has(host)) throw new Error('Disallowed host in OAuth callback origin')

  const proto = request.headers.get('x-forwarded-proto') ?? requestUrl.protocol.replace(':', '')
  return `${proto}://${host}`
}

export async function GET(request: Request) {
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.PLAYWRIGHT_USE_MOCK_OAUTH === '1' &&
    process.env.ALLOW_MOCK_OAUTH === '1'
  ) {
    return NextResponse.redirect(new URL('/api/test/mock-oauth', request.url))
  }

  let origin: string
  try {
    origin = pickOrigin(request)
  } catch {
    return NextResponse.redirect(new URL('/?auth_error=disallowed_host', request.url))
  }

  const supabase = createServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      scopes: 'read:user user:email',
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect(new URL('/?auth_error=oauth_failed', request.url))
  }

  return NextResponse.redirect(data.url)
}
