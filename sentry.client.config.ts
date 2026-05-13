import * as Sentry from '@sentry/nextjs'

function scrubSensitive(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const tokenPattern = /gho_[A-Za-z0-9]+|ghu_[A-Za-z0-9]+|ghs_[A-Za-z0-9]+|ghp_[A-Za-z0-9]+/g
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

  function scrubValue(val: unknown): unknown {
    if (typeof val === 'string') {
      return val.replace(tokenPattern, '[REDACTED]').replace(emailPattern, '[REDACTED]')
    }
    if (val && typeof val === 'object') {
      const scrubbed: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        scrubbed[k] = scrubValue(v)
      }
      return scrubbed
    }
    return val
  }

  if (event.extra) event.extra = scrubValue(event.extra) as typeof event.extra
  if (event.contexts) event.contexts = scrubValue(event.contexts) as typeof event.contexts
  return event
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
  beforeSend(event) {
    if (event.request?.cookies) delete event.request.cookies
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
    }
    return scrubSensitive(event)
  },
})
