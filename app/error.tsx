'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalErrorBoundary({
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">This part of the map is uncharted.</h1>
      <p className="text-neutral-500">An unexpected error occurred. We&apos;ve been notified.</p>
      <button
        onClick={reset}
        className="mt-2 rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 transition-colors"
      >
        Try again
      </button>
    </main>
  )
}
