'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setPublicProfile } from '../_actions'

interface PublicProfileSectionProps {
  initialIsPublic: boolean
  displayUsername: string
  baseUrl: string
}

export function PublicProfileSection({
  initialIsPublic,
  displayUsername,
  baseUrl,
}: PublicProfileSectionProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [pending, startTransition] = useTransition()

  const profileUrl = `${baseUrl}/${displayUsername}`

  function onToggle(next: boolean) {
    setIsPublic(next)
    startTransition(async () => {
      try {
        await setPublicProfile(next)
        if (!next) {
          toast('Your constellation is now private. Existing shared links will show a private placeholder.')
        }
      } catch {
        setIsPublic(!next)
        toast.error('Failed to update profile visibility.')
      }
    })
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
        Public profile
      </h2>
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-300">
          Make your constellation public at devastra.app/{displayUsername}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          disabled={pending}
          onClick={() => onToggle(!isPublic)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
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
      {isPublic && (
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-zinc-300 font-mono">{profileUrl}</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(profileUrl)
              toast('Link copied!')
            }}
            className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-200 transition-colors"
          >
            Copy
          </button>
          <a
            href={`/${displayUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-200 transition-colors"
          >
            Preview →
          </a>
        </div>
      )}
    </section>
  )
}
