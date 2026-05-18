import * as Sentry from '@sentry/nextjs'
import { scrubEvent, TOKEN_PATTERN } from '@/lib/sentry-scrub'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
  beforeSend(event) {
    return scrubEvent(event)
  },
})

// Re-export for consumers that import TOKEN_PATTERN from this file directly.
export { TOKEN_PATTERN }
