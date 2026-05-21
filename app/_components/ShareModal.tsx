'use client'

import { useEffect, useState } from 'react'
import { publicUrl } from '@/lib/utils/public-base-url'

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

  const encodedUsername = encodeURIComponent(username)
  const profileUrl = publicUrl(`/${encodedUsername}`)
  const previewImageUrl = `/api/og/profile/${encodedUsername}?preview=1`
  const highResolutionPreviewImageUrl = `/api/og/profile/${encodedUsername}?preview=1&scale=2`
  const downloadImageUrl = `/api/og/profile/${encodedUsername}?download=1&scale=2`
  const tweetText = encodeURIComponent(`My GitHub activity, as a constellation.`)
  const [previewSrc, setPreviewSrc] = useState(previewImageUrl)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setPreviewSrc(previewImageUrl)

    const img = new Image()
    img.onload = () => {
      if (!cancelled) setPreviewSrc(highResolutionPreviewImageUrl)
    }
    img.src = highResolutionPreviewImageUrl

    return () => {
      cancelled = true
    }
  }, [highResolutionPreviewImageUrl, open, previewImageUrl])

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
    const res = await fetch(downloadImageUrl)
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
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="pointer-events-auto w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-700 p-5">
            <h2 className="text-lg font-semibold text-slate-100">Share your DevAstra</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-700"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 p-5">
            {/* OG image preview */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt="Your DevAstra preview"
              width={1200}
              height={630}
              className="aspect-[1200/630] w-full rounded-lg border border-slate-700 bg-slate-800 object-cover"
            />

            {!publicState && (
              <div className="flex items-center justify-between rounded-lg border border-slate-600 bg-slate-800 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-200">Your DevAstra is private</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Make it public to share with others
                  </p>
                </div>
                <button
                  onClick={handleToggle}
                  disabled={toggling}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                >
                  {toggling ? 'Saving...' : 'Make public'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopy}
                disabled={!publicState}
                className="flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-2.5 text-sm text-slate-100 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
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
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors ${
                  publicState
                    ? 'bg-[#1DA1F2] text-white hover:bg-[#1a8fd1]'
                    : 'cursor-not-allowed bg-slate-700 text-slate-300 opacity-40'
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
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors ${
                  publicState
                    ? 'bg-[#0A66C2] text-white hover:bg-[#0958a8]'
                    : 'cursor-not-allowed bg-slate-700 text-slate-300 opacity-40'
                }`}
              >
                <LinkedInLogo className="h-4 w-4" />
                LinkedIn
              </a>

              <button
                onClick={handleDownload}
                disabled={!publicState}
                className="flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-2.5 text-sm text-slate-100 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
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
