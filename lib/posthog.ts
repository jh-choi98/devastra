'use client'

import posthog from 'posthog-js'

let initialized = false

export function initPosthog() {
  if (initialized || typeof window === 'undefined') return
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
    capture_pageview: true,
    disable_session_recording: true,
  })
  initialized = true
}

export { posthog }
