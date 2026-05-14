'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): JSX.Element {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0b1020',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f1f5f9',
        fontFamily: 'system-ui',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>
          Something went wrong on our end.
        </h1>
        <p style={{ color: '#94a3b8', marginTop: 12 }}>
          We&apos;ve been notified. Please try again in a moment.
        </p>
        <div
          style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 12 }}
        >
          <button
            onClick={reset}
            style={{
              background: '#3b82f6',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Retry
          </button>
          <Link
            href="/"
            style={{ color: '#94a3b8', padding: '8px 16px', textDecoration: 'none' }}
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  )
}
