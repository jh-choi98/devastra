'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signOut } from '@/lib/auth/actions'
import { RefreshButton } from './RefreshButton'
import { ShareModal } from './ShareModal'
import { togglePublicStub } from './share-actions'
import { captureClientEvent } from './posthog-lite'

interface HeaderUser {
  id: string
  displayUsername: string
  avatarUrl: string | null
  isPublic: boolean
}

export function Header({
  user,
  lastSyncStartedAt,
  initialSyncKind = null,
  initialSyncing = false,
}: {
  user: HeaderUser
  lastSyncStartedAt: Date | null
  initialSyncKind?: string | null
  initialSyncing?: boolean
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)

  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[45] flex items-start justify-between px-3 pt-3 sm:px-5 sm:pt-4">
        <Link
          href="/"
          className="pointer-events-auto flex items-center gap-2 rounded-md bg-slate-950/40 px-2.5 py-2 text-base font-bold text-slate-100 shadow-xl shadow-black/20 backdrop-blur-md transition-colors hover:bg-slate-950/60 hover:text-white sm:text-lg"
        >
          DevAstra
        </Link>

        <div className="pointer-events-auto flex items-center gap-2 rounded-md bg-slate-950/40 p-1.5 shadow-xl shadow-black/20 backdrop-blur-md sm:gap-3">
          <RefreshButton
            userId={user.id}
            lastSyncStartedAt={lastSyncStartedAt}
            initialSyncKind={initialSyncKind}
            initialSyncing={initialSyncing}
          />

          <button
            data-testid="share-button"
            onClick={() => {
              captureClientEvent('share.clicked', { distinctId: user.id })
              setShareModalOpen(true)
            }}
            className="rounded bg-indigo-500/90 px-3 py-1.5 text-sm text-white transition-colors hover:bg-indigo-400"
          >
            Share
          </button>

          <div className="relative">
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2 rounded p-1.5 transition-colors hover:bg-white/10"
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
                  className="pointer-events-auto fixed inset-0 z-40"
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

      <ShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        username={user.displayUsername}
        isPublic={user.isPublic}
        onTogglePublic={togglePublicStub}
      />
    </>
  )
}
