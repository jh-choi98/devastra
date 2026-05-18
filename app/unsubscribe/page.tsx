import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema/users'
import { UndoButton } from './_undo-button'

type Status = 'success' | 'expired' | 'invalid'

interface PageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const params = await searchParams
  const token = params.token
  let status: Status = 'invalid'

  if (token) {
    const result = await verifyUnsubscribeToken(token)
    if (result.ok) {
      // Idempotent: update email_recap_enabled = false
      await db
        .update(users)
        .set({ emailRecapEnabled: false })
        .where(eq(users.id, result.payload.user_id))
      status = 'success'
    } else if (result.reason === 'version_mismatch') {
      status = 'expired'
    } else {
      status = 'invalid'
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1020] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {status === 'success' ? (
          <>
            <h1 className="text-xl font-semibold text-white mb-3">
              You&apos;ve been unsubscribed from weekly recaps.
            </h1>
            <p className="text-sm text-zinc-400 mb-6">
              You&apos;ll no longer receive Sunday recap emails. Your constellation and account remain.
            </p>
            {token && <UndoButton token={token} />}
            <p className="mt-6">
              <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
                Sign in to manage your email preferences →
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-white mb-3">
              {status === 'expired'
                ? 'This unsubscribe link has expired.'
                : 'This unsubscribe link is invalid.'}
            </h1>
            <p className="text-sm text-zinc-400 mb-6">
              Sign in to manage your email preferences.
            </p>
            <Link
              href="/"
              className="inline-block px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Sign in →
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
