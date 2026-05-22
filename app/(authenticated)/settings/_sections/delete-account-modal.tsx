'use client'

import { useEffect, useState, useTransition } from 'react'
import { deleteAccount } from '../_actions'

interface DeleteAccountModalProps {
  open: boolean
  displayUsername: string
  onClose: () => void
}

export function DeleteAccountModal({ open, displayUsername, onClose }: DeleteAccountModalProps) {
  const [input, setInput] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return

    setInput('')

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const matches = input === displayUsername

  function onConfirm() {
    if (!matches) return
    startTransition(async () => {
      await deleteAccount()
      // deleteAccount redirects to /account-deleted
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      {/* Full-screen on mobile (severity signal), centered max-md on desktop */}
      <div className="w-full h-full sm:h-auto sm:max-w-md sm:mx-4 sm:rounded-xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Delete your account</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-zinc-400 mb-3">This cannot be undone. We will delete:</p>
        <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1 mb-6">
          <li>Your constellation</li>
          <li>Your public profile</li>
          <li>All account data</li>
        </ul>

        <div className="mb-6">
          <label className="block text-sm text-zinc-400 mb-2">
            Type your username to confirm:{' '}
            <span className="font-mono text-zinc-200">{displayUsername}</span>
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={displayUsername}
            className="w-full rounded-lg bg-zinc-800 border border-zinc-600 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="flex items-center justify-between mt-auto">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || pending}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Permanently delete
          </button>
        </div>
      </div>
    </div>
  )
}
