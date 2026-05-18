'use client'

const ANON_ID_KEY = 'devastra_anon_id'

function getAnonymousId(): string {
  const next =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`
  try {
    const existing = localStorage.getItem(ANON_ID_KEY)
    if (existing) return existing
    localStorage.setItem(ANON_ID_KEY, next)
  } catch {
    return next
  }
  return next
}

function posthogCapture(payload: Record<string, unknown>): void {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!apiKey) return

  const body = JSON.stringify({ api_key: apiKey, ...payload })
  const url = `${process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'}/capture/`
  const blob = new Blob([body], { type: 'application/json' })
  if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, blob)) return
  try {
    void fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    })
  } catch {
    // Analytics must never block the product flow.
  }
}

export function captureClientEvent(
  event: string,
  options: { distinctId?: string; properties?: Record<string, unknown> } = {},
): void {
  posthogCapture({
    event,
    distinct_id: options.distinctId ?? getAnonymousId(),
    properties: options.properties ?? {},
  })
}

export function identifyClientUser(userId: string): void {
  posthogCapture({
    event: '$identify',
    distinct_id: userId,
    properties: {
      $anon_distinct_id: getAnonymousId(),
    },
  })
}
