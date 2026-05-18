'use client'

export function SyncFailedBanner({
  onRetry,
  onDismiss,
}: {
  onRetry: () => void
  onDismiss: () => void
}) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-between gap-4 bg-slate-800/90 backdrop-blur border-t border-slate-700 px-4 py-3 text-sm text-slate-200">
      <span>Sync failed. Your constellation is safe.</span>
      <div className="flex items-center gap-3">
        <button
          onClick={onRetry}
          className="text-sky-400 hover:text-sky-300 transition-colors font-medium"
        >
          Retry
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-slate-400 hover:text-slate-200 transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  )
}
