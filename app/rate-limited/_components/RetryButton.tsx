'use client'

export function RetryButton(): JSX.Element {
  return (
    <button
      onClick={() => window.history.back()}
      className="px-6 py-3 border border-slate-600 text-slate-300 rounded-full text-sm hover:border-slate-400 hover:text-slate-200 transition-colors"
    >
      Retry
    </button>
  )
}
