'use client'

type Variant = 'disconnected' | 'token_expired'

const COPY: Record<Variant, string> = {
  disconnected: 'GitHub disconnected — reconnect to sync new activity',
  token_expired: 'Your GitHub connection expired — Reconnect',
}

export function GitHubDisconnectedBanner({ variant }: { variant: Variant }) {
  return (
    <div className="w-full flex items-center justify-between gap-4 bg-slate-800/90 backdrop-blur border-b border-slate-700 px-4 py-2.5 text-sm text-slate-200">
      <span>{COPY[variant]}</span>
      <a
        href="/api/auth/sign-in"
        className="text-sky-400 hover:text-sky-300 transition-colors font-medium whitespace-nowrap"
      >
        Reconnect
      </a>
    </div>
  )
}
