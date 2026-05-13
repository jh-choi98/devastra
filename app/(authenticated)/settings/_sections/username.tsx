'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { changeUsername } from '../_actions'

interface UsernameSectionProps {
  initial: string
  githubLogin: string
}

export function UsernameSection({ initial, githubLogin }: UsernameSectionProps) {
  const [username, setUsername] = useState(initial)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      try {
        await changeUsername({ username })
        toast.success('Username updated.')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update username.')
      }
    })
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 mb-4">
      <h2 className="text-base font-semibold text-white mb-1">Username</h2>
      <p className="text-sm text-zinc-400 mb-1">
        Your public profile URL: <span className="text-zinc-300">/{username}</span>
      </p>
      {/* Custom domain support is intentionally deferred to v0.3 (ADR) */}
      <div className="flex gap-3 mt-4">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder={githubLogin}
          pattern="^[a-z0-9-_]+$"
          minLength={2}
          maxLength={30}
          className="flex-1 rounded-lg bg-zinc-800 border border-zinc-600 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || username === initial || username.length < 2}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          Save
        </button>
      </div>
      <p className="text-xs text-zinc-500 mt-2">
        Lowercase letters, numbers, hyphens, and underscores only. 2–30 characters.
      </p>
    </div>
  )
}
