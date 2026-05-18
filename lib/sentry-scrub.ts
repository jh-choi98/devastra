import type { ErrorEvent } from '@sentry/nextjs'

export const TOKEN_PATTERN = /\b(?:gho_|ghu_|ghs_|github_pat_|Bearer\s+)[A-Za-z0-9_]{8,}\b/g
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-resend-signature', 'svix-signature']

export function scrubString(s: string | undefined): string | undefined {
  if (!s) return s
  return s.replace(TOKEN_PATTERN, '[REDACTED]')
}

export function scrubHeaders(h: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!h) return h
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(h)) {
    if (SENSITIVE_HEADERS.includes(k.toLowerCase())) out[k] = '[REDACTED]'
    else out[k] = typeof v === 'string' ? scrubString(v) : v
  }
  return out
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request.headers = scrubHeaders(event.request.headers as Record<string, unknown> | undefined) as
      | Record<string, string>
      | undefined
    event.request.cookies = undefined
    if (typeof event.request.data === 'string') event.request.data = scrubString(event.request.data)
  }
  if (event.message) event.message = scrubString(event.message) ?? event.message
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubString(ex.value)
    }
  }
  if (event.breadcrumbs) {
    const crumbs = Array.isArray(event.breadcrumbs)
      ? event.breadcrumbs
      : (event.breadcrumbs as { values?: { message?: string; data?: Record<string, unknown> }[] }).values ?? []
    for (const bc of crumbs) {
      if (bc.message) bc.message = scrubString(bc.message)
      if (bc.data) {
        for (const k of Object.keys(bc.data)) {
          const v = bc.data[k]
          if (typeof v === 'string') bc.data[k] = scrubString(v)
        }
      }
    }
  }
  return event
}
