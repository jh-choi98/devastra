'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <main
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            This part of the map is uncharted.
          </h1>
          <p style={{ color: '#737373' }}>An unexpected error occurred. We&apos;ve been notified.</p>
          <button
            onClick={reset}
            style={{
              marginTop: '0.5rem',
              borderRadius: '0.25rem',
              background: '#4f46e5',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
