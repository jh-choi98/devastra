'use client'

import { useEffect, useTransition } from 'react'
import { disconnectGitHub } from '../_actions'

interface DisconnectConfirmModalProps {
  open: boolean
  onClose: () => void
}

export function DisconnectConfirmModal({ open, onClose }: DisconnectConfirmModalProps) {
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  function onConfirm() {
    startTransition(async () => {
      await disconnectGitHub()
      // disconnectGitHub redirects to /; onClose won't be needed
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm mx-4 rounded-xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Disconnect GitHub?</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-zinc-400 mb-6">
          Your constellation stays. Public profile becomes private. Reconnect anytime.
        </p>
        <div className="flex items-center justify-between">
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
            disabled={pending}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  )
}
