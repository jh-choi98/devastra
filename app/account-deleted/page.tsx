import Link from 'next/link'
import { AutoRedirect } from './_auto-redirect'

export default function AccountDeletedPage() {
  return (
    <main className="min-h-screen bg-[#0b1020] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-zinc-400 text-sm mb-2">Account deleted</p>
        <h1 className="text-xl font-semibold text-white mb-4">
          Thanks for trying DevAstra. Your account has been deleted.
        </h1>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          Go to landing now →
        </Link>
        <AutoRedirect />
      </div>
    </main>
  )
}
