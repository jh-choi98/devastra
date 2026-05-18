'use client'

interface AccountInfoSectionProps {
  avatarUrl: string | null
  displayUsername: string
  email: string
}

export function AccountInfoSection({ avatarUrl, displayUsername, email }: AccountInfoSectionProps) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
        Account info
      </h2>
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={displayUsername} className="w-10 h-10 rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-sm text-zinc-200">
            {displayUsername[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-white">@{displayUsername}</p>
          <p className="text-sm text-zinc-400">{email}</p>
        </div>
      </div>
    </section>
  )
}
