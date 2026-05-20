'use client'

import { useState } from 'react'

interface ShareModalProps {
  open: boolean
  onClose: () => void
  username: string
  isPublic: boolean
  onTogglePublic: (next: boolean) => Promise<void>
}

export function ShareModal({
  open,
  onClose,
  username,
  isPublic,
  onTogglePublic,
}: ShareModalProps): JSX.Element {
  const [publicState, setPublicState] = useState(isPublic)
  const [toggling, setToggling] = useState(false)
  const [copied, setCopied] = useState(false)

  const profileUrl = `https://devastra.app/${username}`
  const tweetText = encodeURIComponent(
    `My GitHub activity, as a constellation.`,
  )

  async function handleToggle() {
    const next = !publicState
    setToggling(true)
    try {
      await onTogglePublic(next)
      setPublicState(next)
    } finally {
      setToggling(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(profileUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDownload() {
    const res = await fetch(`/api/og/profile/${username}`)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `devastra-${username}.png`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (!open) return <></>

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-slate-100">Share your DevAstra</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded hover:bg-slate-700 transition-colors text-slate-400"
            >
              ✕
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* OG image preview */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/og/profile/${username}?preview=1`}
              alt="Your DevAstra preview"
              className="w-full rounded-lg border border-slate-700 aspect-[1200/630] object-cover bg-slate-800"
            />

            {!publicState && (
              <div className="flex items-center justify-between bg-slate-800 rounded-lg p-4 border border-slate-600">
                <div>
                  <p className="text-slate-200 text-sm font-medium">Your DevAstra is private</p>
                  <p className="text-slate-400 text-xs mt-0.5">Make it public to share with others</p>
                </div>
                <button
                  onClick={handleToggle}
                  disabled={toggling}
                  className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  {toggling ? 'Saving...' : 'Make public'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopy}
                disabled={!publicState}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-100 text-sm rounded-lg transition-colors"
              >
                {copied ? '✓ Copied!' : '🔗 Copy link'}
              </button>

              <a
                href={
                  publicState
                    ? `https://x.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(profileUrl)}`
                    : '#'
                }
                aria-label="Share on X"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => !publicState && e.preventDefault()}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg transition-colors ${
                  publicState
                    ? 'bg-[#1DA1F2] hover:bg-[#1a8fd1] text-white'
                    : 'bg-slate-700 opacity-40 cursor-not-allowed text-slate-300'
                }`}
              >
                <span aria-hidden="true" className="text-xl font-semibold leading-none">
                  𝕏
                </span>
              </a>

              <a
                href={
                  publicState
                    ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`
                    : '#'
                }
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => !publicState && e.preventDefault()}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg transition-colors ${
                  publicState
                    ? 'bg-[#0A66C2] hover:bg-[#0958a8] text-white'
                    : 'bg-slate-700 opacity-40 cursor-not-allowed text-slate-300'
                }`}
              >
                <LinkedInLogo className="h-4 w-4" />
                LinkedIn
              </a>

              <button
                onClick={handleDownload}
                disabled={!publicState}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-100 text-sm rounded-lg transition-colors"
              >
                ↓ Download PNG
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function LinkedInLogo({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5.2 8.9h3.3v10.6H5.2V8.9ZM6.9 4a1.9 1.9 0 1 1 0 3.8A1.9 1.9 0 0 1 6.9 4ZM10.6 8.9h3.1v1.5h.1c.4-.8 1.5-1.8 3.1-1.8 3.3 0 3.9 2.2 3.9 5v5.8h-3.3v-5.1c0-1.2 0-2.8-1.7-2.8s-1.9 1.3-1.9 2.7v5.2h-3.3V8.9Z" />
    </svg>
  )
}
