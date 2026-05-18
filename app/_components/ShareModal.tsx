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
                    ? `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(profileUrl)}`
                    : '#'
                }
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => !publicState && e.preventDefault()}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg transition-colors ${
                  publicState
                    ? 'bg-[#1DA1F2] hover:bg-[#1a8fd1] text-white'
                    : 'bg-slate-700 opacity-40 cursor-not-allowed text-slate-300'
                }`}
              >
                𝕏 Twitter
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
