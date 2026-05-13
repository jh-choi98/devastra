import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/auth/middleware'

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.posthog.com https://browser.sentry-cdn.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https://avatars.githubusercontent.com data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.posthog.com https://*.sentry.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

// Known social crawlers — allowed through rate limiting on OG routes
const CRAWLER_UA = /Twitterbot|LinkedInBot|Discordbot|facebookexternalhit|Slackbot/i

// In-memory token bucket per IP.
// Uses @vercel/kv if KV_REST_API_URL is configured; otherwise falls back to this map.
// Limitation: in-memory state resets on every cold start (per region, per instance on Vercel Edge).
// Acceptable for MVP; distributed rate limiting requires KV.
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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const userAgent = req.headers.get('user-agent') ?? ''
  const isCrawler = CRAWLER_UA.test(userAgent)

  // Refresh Supabase session cookie
  const res = await updateSession(req)

  // Security headers
  res.headers.set('Content-Security-Policy', CSP)
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Rate limit /{username} routes — 60 req/min/IP
  const isProfileRoute =
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/settings') &&
    !pathname.startsWith('/onboarding') &&
    !pathname.startsWith('/auth') &&
    !pathname.startsWith('/dev') &&
    !pathname.startsWith('/privacy') &&
    !pathname.startsWith('/terms') &&
    pathname !== '/' &&
    pathname.split('/').length === 2 &&
    pathname.split('/')[1] !== ''

  if (isProfileRoute && !isCrawler) {
    const ip = getClientIp(req)
    if (isRateLimited(ip, 60, 60_000)) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': '60' },
      })
    }
  }

  // Rate limit /api/og/* routes — 60 req/min/IP; crawlers bypass
  if (pathname.startsWith('/api/og/') && !isCrawler) {
    const ip = getClientIp(req)
    if (isRateLimited(ip + ':og', 60, 60_000)) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': '60' },
      })
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
