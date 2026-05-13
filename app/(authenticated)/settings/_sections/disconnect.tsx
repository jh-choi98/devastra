'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/app/_components/ConfirmModal'
import { disconnectGithub } from '../_actions'

export function DisconnectSection() {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      try {
        await disconnectGithub()
        setIsOpen(false)
        toast.success('GitHub disconnected. Your map data is preserved.')
      } catch (err) {
        setIsOpen(false)
        toast.error(err instanceof Error ? err.message : 'Failed to disconnect GitHub.')
      }
    })
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 mb-4">
      <h2 className="text-base font-semibold text-white mb-1">Disconnect GitHub</h2>
      <p className="text-sm text-zinc-400 mb-4">
        Removes your GitHub access token. Your map data is preserved. You can reconnect anytime.
      </p>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={isPending}
        className="px-4 py-2 rounded-lg border border-zinc-600 text-zinc-300 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        Disconnect GitHub
      </button>
      <ConfirmModal
        isOpen={isOpen}
        title="Disconnect GitHub?"
        description="Your map will be preserved. You can reconnect anytime. Sync will be paused until you reconnect."
        confirmLabel="Disconnect"
        onConfirm={handleConfirm}
        onCancel={() => setIsOpen(false)}
      />
    </div>
  )
}
