import Link from 'next/link'
import { RetryButton } from './_components/RetryButton'

export default function RateLimitedPage(): JSX.Element {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(to bottom, #0b1020, #020617)' }}
    >
      <header className="px-4 py-3 shrink-0">
        <Link href="/" className="text-slate-300 text-sm font-semibold">
          DevAstra
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-slate-300 text-xl font-medium">
          Too many requests — try again in a moment
        </p>
        <RetryButton />
      </main>
    </div>
  )
}
