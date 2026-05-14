'use client'

import { useState } from 'react'
import { DisconnectConfirmModal } from './disconnect-confirm-modal'
import { DeleteAccountModal } from './delete-account-modal'

interface DangerZoneSectionProps {
  displayUsername: string
}

export function DangerZoneSection({ displayUsername }: DangerZoneSectionProps) {
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <section className="rounded-lg border border-red-900/60 p-6">
        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-4">
          Danger zone
        </h2>

        <div className="space-y-6">
          <div>
            <p className="text-sm text-zinc-300 font-medium mb-1">Disconnect GitHub</p>
            <p className="text-sm text-zinc-500 mb-3">
              Disconnect your GitHub account. Your constellation will be preserved; you can reconnect anytime.
            </p>
            <button
              type="button"
              onClick={() => setDisconnectOpen(true)}
              className="text-sm text-red-400 hover:text-red-300 transition-colors font-medium"
            >
              Disconnect GitHub
            </button>
          </div>

          <hr className="border-zinc-700" />

          <div>
            <p className="text-sm text-zinc-300 font-medium mb-1">Delete account</p>
            <p className="text-sm text-zinc-500 mb-3">
              Permanently delete your account, constellation, and all associated data.
            </p>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="text-sm text-red-400 hover:text-red-300 transition-colors font-medium"
            >
              Delete account
            </button>
          </div>
        </div>
      </section>

      <DisconnectConfirmModal open={disconnectOpen} onClose={() => setDisconnectOpen(false)} />
      <DeleteAccountModal
        open={deleteOpen}
        displayUsername={displayUsername}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  )
}
