'use client'

import posthog from 'posthog-js'

let inited = false

export function initPosthog() {
  if (inited) return
  if (typeof window === 'undefined') return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    persistence: 'memory',
    disable_cookie: true,
    mask_all_text: true,
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    sanitize_properties: (properties, _eventName) => {
      if (typeof properties.$current_url === 'string') {
        properties.$current_url = sanitizeUrl(properties.$current_url)
      }
      if (typeof properties.$pathname === 'string') {
        properties.$pathname = sanitizePath(properties.$pathname)
      }
      delete properties.display_username
      return properties
    },
  })
  inited = true
}

export function sanitizePath(pathname: string): string {
  if (
    pathname === '/' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/unsubscribe') ||
    pathname.startsWith('/account-deleted') ||
    pathname.startsWith('/rate-limited') ||
    pathname.startsWith('/_next')
  ) {
    return pathname
  }
  if (/^\/[a-z0-9-_]+$/.test(pathname)) return '/[username]'
  return pathname
}

export function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.pathname = sanitizePath(u.pathname)
    return u.toString()
  } catch {
    return url
  }
}

export function capture(event: string, properties?: Record<string, unknown>) {
  if (!inited) return
  posthog.capture(event, properties)
}

export { posthog }
