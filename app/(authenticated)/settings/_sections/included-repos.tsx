'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateIncludedRepos } from '../_actions'

type Repo = {
  id: string
  owner: string
  name: string
  primaryLanguage: string | null
  isIncluded: boolean
}

interface IncludedReposSectionProps {
  repos: Repo[]
}

export function IncludedReposSection({ repos }: IncludedReposSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [drafts, setDrafts] = useState<Map<string, boolean>>(
    new Map(repos.map((r) => [r.id, r.isIncluded])),
  )
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [saving, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState('')

  const includedCount = Array.from(drafts.values()).filter(Boolean).length
  const totalCount = repos.length

  const filtered = repos.filter((r) => {
    const q = searchQuery.toLowerCase()
    return !q || `${r.owner}/${r.name}`.toLowerCase().includes(q)
  })

  function toggleRepo(id: string) {
    setDrafts((prev) => {
      const next = new Map(prev)
      next.set(id, !next.get(id))
      return next
    })
  }

  function onSave() {
    const updates = repos.map((r) => ({ id: r.id, isIncluded: drafts.get(r.id) ?? r.isIncluded }))
    startTransition(async () => {
      try {
        await updateIncludedRepos(updates)
        // updateIncludedRepos redirects to / on success
      } catch (err) {
        setConfirmModalOpen(false)
        toast.error(err instanceof Error ? err.message : 'Failed to update repositories.')
      }
    })
  }

  if (repos.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
          Included repos
        </h2>
        <p className="text-sm text-zinc-500">No repositories found. Sync to load your repos.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Included repos</h2>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {expanded ? 'Collapse' : 'Edit'}
        </button>
      </div>

      {!expanded && (
        <p className="text-sm text-zinc-300">
          {includedCount} of {totalCount} repos included
        </p>
      )}

      {expanded && (
        <>
          <input
            type="search"
            placeholder="Search repos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full mb-3 rounded-lg bg-zinc-800 border border-zinc-600 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <ul className="space-y-2 max-h-96 overflow-y-auto mb-4">
            {filtered.map((repo) => (
              <li key={repo.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`repo-${repo.id}`}
                  checked={drafts.get(repo.id) ?? repo.isIncluded}
                  onChange={() => toggleRepo(repo.id)}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500"
                />
                <label htmlFor={`repo-${repo.id}`} className="text-sm text-zinc-300 cursor-pointer">
                  {repo.owner}/{repo.name}
                  {repo.primaryLanguage && (
                    <span className="ml-2 text-xs text-zinc-500">{repo.primaryLanguage}</span>
                  )}
                </label>
              </li>
            ))}
          </ul>

          {!confirmModalOpen ? (
            <button
              type="button"
              onClick={() => setConfirmModalOpen(true)}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              Save changes
            </button>
          ) : (
            <div className="rounded-lg border border-zinc-600 bg-zinc-900 p-4">
              <p className="text-sm text-zinc-300 mb-3">These changes will affect your constellation.</p>
              <p className="text-xs text-zinc-500 mb-4">
                Some changes may take effect after backfill completes.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(false)}
                  className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
