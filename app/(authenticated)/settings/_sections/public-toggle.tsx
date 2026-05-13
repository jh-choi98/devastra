'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { togglePublic } from '../_actions'

interface PublicToggleSectionProps {
  initial: boolean
  username: string
}

export function PublicToggleSection({ initial, username }: PublicToggleSectionProps) {
  const [isPublic, setIsPublic] = useState(initial)
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const next = !isPublic
    setIsPublic(next)
    startTransition(async () => {
      try {
        await togglePublic({ next })
        toast.success(next ? 'Profile is now public.' : 'Profile is now private.')
      } catch (err) {
        setIsPublic(!next)
        toast.error(err instanceof Error ? err.message : 'Failed to update profile visibility.')
      }
    })
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Public profile</h2>
          <p className="text-sm text-zinc-400 mt-1">
            {isPublic
              ? `Your map is visible at /${username}`
              : 'Your map is private. Only you can see it.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          disabled={isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            isPublic ? 'bg-indigo-600' : 'bg-zinc-600'
          } disabled:opacity-50`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isPublic ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  )
}
