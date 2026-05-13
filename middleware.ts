import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Known social crawlers that should be allowed through to OG image routes without rate limiting
const CRAWLER_UA = /Twitterbot|LinkedInBot|Discordbot|facebookexternalhit|Slackbot/i

// In-memory token bucket per IP for edge middleware.
// TODO: Phase 12 — replace with @vercel/kv rate limiter for true distributed rate limiting.
// This in-memory map resets on every cold start (Vercel Edge = per-region, per-instance).
// Acceptable for MVP; does not protect against distributed abuse across regions.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return false
  }

  if (entry.count >= limit) return true

  entry.count++
  return false
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const userAgent = request.headers.get('user-agent') ?? ''
  const isCrawler = CRAWLER_UA.test(userAgent)

  // Rate limit /{username} routes — 60 req/min/IP
  const isProfileRoute =
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/settings') &&
    !pathname.startsWith('/onboarding') &&
    !pathname.startsWith('/auth') &&
    !pathname.startsWith('/dev') &&
    pathname !== '/' &&
    pathname.split('/').length === 2 &&
    pathname.split('/')[1] !== ''

  if (isProfileRoute && !isCrawler) {
    const ip = getClientIp(request)
    if (isRateLimited(ip, 60, 60_000)) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': '60' },
      })
    }
  }

  // Rate limit /api/og/* routes — 60 req/min/IP; crawlers bypass
  if (pathname.startsWith('/api/og/') && !isCrawler) {
    const ip = getClientIp(request)
    if (isRateLimited(ip + ':og', 60, 60_000)) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': '60' },
      })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and Next.js internals.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
