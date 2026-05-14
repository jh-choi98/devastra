import Link from 'next/link'

const CLUSTER_POSITIONS = [
  { cx: 120, cy: 110 },
  { cx: 300, cy: 110 },
  { cx: 480, cy: 110 },
  { cx: 120, cy: 260 },
  { cx: 300, cy: 260 },
  { cx: 480, cy: 260 },
]

export default function NotFoundPage(): JSX.Element {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(to bottom, #0b1020, #020617)' }}
    >
      <header className="px-4 py-3 shrink-0">
        <Link href="/" className="text-slate-300 text-sm font-semibold">
          ⭐ DevAstra
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-8 px-4 text-center">
        {/* Decorative faint constellation outline */}
        <svg
          viewBox="0 0 600 370"
          className="w-full max-w-lg"
          aria-hidden="true"
          style={{ opacity: 0.12 }}
        >
          {CLUSTER_POSITIONS.map(({ cx, cy }, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={72}
              fill="none"
              stroke="#475569"
              strokeWidth="1"
              strokeDasharray="3 8"
            />
          ))}
        </svg>

        <div className="space-y-6">
          <p className="text-slate-300 text-2xl font-medium">
            No constellation at this address
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="px-6 py-3 bg-indigo-600 text-white rounded-full font-semibold text-sm hover:bg-indigo-500 transition-colors"
            >
              Create yours, free →
            </Link>
            <Link
              href="/#gallery"
              className="px-6 py-3 border border-slate-600 text-slate-300 rounded-full text-sm hover:border-slate-400 hover:text-slate-200 transition-colors"
            >
              Browse other constellations →
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
