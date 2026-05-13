'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/app/_components/ConfirmModal'
import { deleteAccount } from '../_actions'

export function DeleteAccountSection() {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [isPending, startTransition] = useTransition()

  const isConfirmed = confirmation === 'DELETE'

  function handleOpen() {
    setConfirmation('')
    setIsOpen(true)
  }

  function handleConfirm() {
    if (!isConfirmed) return
    startTransition(async () => {
      try {
        await deleteAccount({ confirmation: 'DELETE' })
      } catch (err) {
        setIsOpen(false)
        toast.error(err instanceof Error ? err.message : 'Failed to delete account.')
      }
    })
  }

  return (
    <div className="rounded-xl border border-red-900/50 bg-zinc-900 p-6 mb-4">
      <h2 className="text-base font-semibold text-red-400 mb-1">Delete account</h2>
      <p className="text-sm text-zinc-400 mb-4">
        Permanently deletes your account and all associated data. This cannot be undone.
      </p>
      <button
        type="button"
        onClick={handleOpen}
        disabled={isPending}
        className="px-4 py-2 rounded-lg bg-red-900/40 border border-red-700 text-red-400 hover:bg-red-900/60 text-sm font-medium transition-colors disabled:opacity-50"
      >
        Delete account
      </button>
      <ConfirmModal
        isOpen={isOpen}
        title="Delete your account?"
        description="This will permanently delete your DevAtlas account and all your data. This cannot be undone."
        confirmLabel="Delete account"
        cancelLabel="Keep account"
        danger
        onConfirm={handleConfirm}
        onCancel={() => setIsOpen(false)}
      >
        <div className="mt-4">
          <label className="block text-sm text-zinc-400 mb-2">
            Type <span className="font-mono text-red-400">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="DELETE"
            className="w-full rounded-lg bg-zinc-800 border border-zinc-600 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        {!isConfirmed && confirmation.length > 0 && (
          <p className="text-xs text-red-400 mt-1">Please type DELETE exactly to continue.</p>
        )}
      </ConfirmModal>
    </div>
  )
}
