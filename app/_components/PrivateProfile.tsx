import Link from 'next/link'

const CLUSTER_POSITIONS = [
  { cx: 120, cy: 110, label: 'Frontend' },
  { cx: 300, cy: 110, label: 'Backend' },
  { cx: 480, cy: 110, label: 'Data' },
  { cx: 120, cy: 260, label: 'Testing' },
  { cx: 300, cy: 260, label: 'DevOps' },
  { cx: 480, cy: 260, label: 'Docs' },
]

export function PrivateProfile({ username }: { username: string }): JSX.Element {
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

      <main className="flex-1 flex flex-col items-center justify-center gap-8 px-4">
        {/* Unlit / locked constellation outline */}
        <svg
          viewBox="0 0 600 370"
          className="w-full max-w-lg"
          aria-hidden="true"
          style={{ opacity: 0.28 }}
        >
          {CLUSTER_POSITIONS.map(({ cx, cy, label }) => (
            <g key={label}>
              {/* Dim cluster ring */}
              <circle
                cx={cx}
                cy={cy}
                r={72}
                fill="none"
                stroke="#475569"
                strokeWidth="1.5"
                strokeDasharray="5 5"
              />
              {/* Faint placeholder star dots */}
              {[0, 60, 120, 180, 240, 300].map((angle) => {
                const rad = (angle * Math.PI) / 180
                const sx = cx + Math.cos(rad) * 42
                const sy = cy + Math.sin(rad) * 42
                return (
                  <circle key={angle} cx={sx} cy={sy} r={2.5} fill="#334155" />
                )
              })}
              <text
                x={cx}
                y={cy + 90}
                textAnchor="middle"
                fill="#475569"
                fontSize="11"
                fontFamily="sans-serif"
              >
                {label}
              </text>
            </g>
          ))}
        </svg>

        <div className="text-center space-y-6">
          <p className="text-slate-300 text-xl font-medium">
            {username}&apos;s sky is private
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-full font-semibold text-sm hover:bg-indigo-500 transition-colors"
          >
            Start yours for free →
          </Link>
        </div>
      </main>
    </div>
  )
}
