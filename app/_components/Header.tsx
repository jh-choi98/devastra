'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signOut } from '@/lib/auth/actions'
import { RefreshButton } from './RefreshButton'

interface HeaderUser {
  id: string
  displayUsername: string
  avatarUrl: string | null
  isPublic: boolean
}

export function Header({
  user,
  lastSyncStartedAt,
}: {
  user: HeaderUser
  lastSyncStartedAt: Date | null
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700 shrink-0">
      <Link href="/" className="text-slate-100 font-bold text-lg hover:text-white transition-colors">
        DevAtlas
      </Link>

      <div className="flex items-center gap-3">
        <RefreshButton userId={user.id} lastSyncStartedAt={lastSyncStartedAt} />

        {/* Share button — wired in Phase 9 */}
        <button
          className="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
          disabled
          title="Coming soon"
        >
          Share
        </button>

        <div className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2 rounded hover:bg-slate-700 p-1.5 transition-colors"
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.displayUsername}
                className="w-7 h-7 rounded-full"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs text-slate-200">
                {user.displayUsername[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-sm text-slate-300 hidden sm:block">{user.displayUsername}</span>
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-slate-800 border border-slate-700 rounded shadow-xl">
                <Link
                  href="/settings"
                  className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                  onClick={() => setDropdownOpen(false)}
                >
                  Settings
                </Link>
                {user.isPublic && (
                  <Link
                    href={`/${user.displayUsername}`}
                    className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    My public profile
                  </Link>
                )}
                <form action={signOut}>
                  <button
                    type="submit"
                    className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
