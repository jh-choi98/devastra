'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { changeUsername, checkUsernameAvailable } from '../_actions'

interface UsernameChangeSectionProps {
  currentUsername: string
  githubLogin: string
}

type ValidationState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'error'; message: string }
  | { kind: 'ok' }

function clientValidate(draft: string, githubLogin: string): string | null {
  const lower = draft.toLowerCase()
  if (lower.length < 2) return 'At least 2 characters'
  if (lower.length > 30) return 'Up to 30 characters'
  if (!/^[a-z0-9-_]+$/.test(lower)) return 'Only lowercase letters, numbers, hyphens, and underscores'
  return null
}

export function UsernameChangeSection({ currentUsername, githubLogin }: UsernameChangeSectionProps) {
  const [draft, setDraft] = useState(currentUsername)
  const [savedUsername, setSavedUsername] = useState(currentUsername)
  const [validation, setValidation] = useState<ValidationState>({ kind: 'idle' })
  const [serverError, setServerError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saving, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const lower = draft.toLowerCase()

    if (lower === savedUsername) {
      setValidation({ kind: 'idle' })
      return
    }

    const clientErr = clientValidate(lower, githubLogin)
    if (clientErr) {
      setValidation({ kind: 'error', message: clientErr })
      return
    }

    setValidation({ kind: 'checking' })
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const result = await checkUsernameAvailable(lower)
      if (result.kind === 'available') {
        setValidation({ kind: 'ok' })
      } else if (result.kind === 'taken') {
        setValidation({ kind: 'error', message: 'This name is taken' })
      } else if (result.kind === 'reserved') {
        setValidation({ kind: 'error', message: 'This name is reserved' })
      } else {
        const msgs: Record<string, string> = {
          too_short: 'At least 2 characters',
          too_long: 'Up to 30 characters',
          regex: 'Only lowercase letters, numbers, hyphens, and underscores',
        }
        setValidation({ kind: 'error', message: msgs[result.reason] ?? 'Invalid username' })
      }
    }, 350)
  }, [draft, savedUsername, githubLogin])

  const isUnchanged = draft.toLowerCase() === savedUsername
  const isInvalid = validation.kind === 'error' || validation.kind === 'checking'
  const canSave = !isUnchanged && validation.kind === 'ok' && !saving

  function onSave() {
    if (!canSave) return
    setServerError(null)
    setSaveSuccess(false)
    startTransition(async () => {
      try {
        await changeUsername(draft.toLowerCase())
        const old = savedUsername
        setSavedUsername(draft.toLowerCase())
        setSaveSuccess(true)
        toast('Username updated')
        setTimeout(() => setSaveSuccess(false), 8000)
        // oldUsername is used in the success note below
        setSavedUsername((prev) => {
          return draft.toLowerCase()
        })
      } catch (err) {
        setServerError(err instanceof Error ? err.message : 'Failed to update username.')
      }
    })
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Username</h2>
      <div className="flex gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value.toLowerCase())
              setServerError(null)
              setSaveSuccess(false)
            }}
            className="w-full rounded-lg bg-zinc-800 border border-zinc-600 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-zinc-500 mt-1">
            devastra.app/{draft.toLowerCase() || currentUsername}
          </p>
          {validation.kind === 'error' && (
            <p className="text-xs text-red-400 mt-1">{validation.message}</p>
          )}
          {serverError && <p className="text-xs text-red-400 mt-1">{serverError}</p>}
          {saveSuccess && (
            <p className="text-xs text-zinc-400 mt-1">
              Anyone with your old URL devastra.app/{currentUsername} will be redirected to your new one.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="self-start px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </section>
  )
}
