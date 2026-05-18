'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { getIncludedRepoEditorData, updateIncludedRepos } from '../_actions'

type Repo = {
  id: string
  owner: string
  name: string
  primaryLanguage: string | null
  isIncluded: boolean
}

interface IncludedReposSectionProps {
  initialIncludedCount: number
  totalCount: number
}

export function IncludedReposSection({
  initialIncludedCount,
  totalCount,
}: IncludedReposSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [repos, setRepos] = useState<Repo[] | null>(null)
  const [drafts, setDrafts] = useState<Map<string, boolean>>(new Map())
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const includedCount = repos
    ? Array.from(drafts.values()).filter(Boolean).length
    : initialIncludedCount
  const hasChanges = repos
    ? repos.some((repo) => (drafts.get(repo.id) ?? repo.isIncluded) !== repo.isIncluded)
    : false

  const filtered =
    repos?.filter((r) => {
      const q = searchQuery.toLowerCase()
      return !q || `${r.owner}/${r.name}`.toLowerCase().includes(q)
    }) ?? []

  function loadReposIfNeeded() {
    if (repos || loadingRepos) return
    setLoadingRepos(true)
    void getIncludedRepoEditorData()
      .then((nextRepos) => {
        setRepos(nextRepos)
        setDrafts(new Map(nextRepos.map((r) => [r.id, r.isIncluded])))
      })
      .catch((err: unknown) => {
        setExpanded(false)
        toast.error(err instanceof Error ? err.message : 'Failed to load repositories.')
      })
      .finally(() => setLoadingRepos(false))
  }

  function toggleExpanded() {
    const nextExpanded = !expanded
    setExpanded(nextExpanded)
    setConfirmModalOpen(false)
    if (nextExpanded) loadReposIfNeeded()
  }

  function toggleRepo(id: string) {
    setDrafts((prev) => {
      const next = new Map(prev)
      next.set(id, !next.get(id))
      return next
    })
  }

  function selectAllRepos() {
    if (!repos) return
    setDrafts(new Map(repos.map((repo) => [repo.id, true])))
    setConfirmModalOpen(false)
  }

  function deselectAllRepos() {
    if (!repos) return
    setDrafts(new Map(repos.map((repo) => [repo.id, false])))
    setConfirmModalOpen(false)
  }

  function onSave() {
    if (!repos) return
    const updates = repos.map((r) => ({ id: r.id, isIncluded: drafts.get(r.id) ?? r.isIncluded }))
    setSaving(true)
    void updateIncludedRepos(updates).catch((err: unknown) => {
      setSaving(false)
      setConfirmModalOpen(false)
      toast.error(err instanceof Error ? err.message : 'Failed to update repositories.')
    })
  }

  if (totalCount === 0) {
    return (
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Included repos
        </h2>
        <p className="text-sm text-zinc-500">No repositories found. Sync to load your repos.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Included repos
        </h2>
        <button
          type="button"
          onClick={toggleExpanded}
          disabled={loadingRepos || saving}
          className="text-xs text-zinc-400 transition-colors hover:text-zinc-200 disabled:cursor-wait disabled:opacity-50"
        >
          {expanded ? 'Collapse' : loadingRepos ? 'Loading...' : 'Edit'}
        </button>
      </div>

      {!expanded && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-300">
            {includedCount} of {totalCount} repos included
          </p>
          <p className="text-xs leading-5 text-zinc-500">
            Included public repos shape your constellation from metadata only. We do not store code,
            diffs, commit messages, or PR bodies.
          </p>
        </div>
      )}

      {expanded && (
        <>
          <p className="mb-3 text-xs leading-5 text-zinc-500">
            Included public repos shape your constellation from metadata only: changed file paths,
            activity dates, additions/deletions, and dependency names.
          </p>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              {includedCount} of {totalCount} repos included
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllRepos}
                disabled={saving || loadingRepos || !repos || includedCount === totalCount}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={deselectAllRepos}
                disabled={saving || loadingRepos || !repos || includedCount === 0}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Deselect all
              </button>
            </div>
          </div>

          {loadingRepos && (
            <div className="mb-4 space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-8 animate-pulse rounded bg-zinc-800/70"
                  aria-hidden="true"
                />
              ))}
            </div>
          )}

          {repos && (
            <>
              <input
                type="search"
                placeholder="Search repos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-3 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <ul className="mb-4 max-h-96 space-y-2 overflow-y-auto">
                {filtered.map((repo) => (
                  <li key={repo.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`repo-${repo.id}`}
                      checked={drafts.get(repo.id) ?? repo.isIncluded}
                      onChange={() => toggleRepo(repo.id)}
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500"
                    />
                    <label
                      htmlFor={`repo-${repo.id}`}
                      className="cursor-pointer text-sm text-zinc-300"
                    >
                      {repo.owner}/{repo.name}
                      {repo.primaryLanguage && (
                        <span className="ml-2 text-xs text-zinc-500">{repo.primaryLanguage}</span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>

              {filtered.length === 0 && (
                <p className="mb-4 text-sm text-zinc-500">No repositories found.</p>
              )}

              {!confirmModalOpen ? (
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(true)}
                  disabled={saving || !hasChanges}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                >
                  Save changes
                </button>
              ) : (
                <div className="rounded-lg border border-zinc-600 bg-zinc-900 p-4">
                  <p className="mb-3 text-sm text-zinc-300">
                    These changes will affect your constellation.
                  </p>
                  <p className="mb-4 text-xs text-zinc-500">
                    Your constellation will stay in a build state until selected activity and
                    project manifests are checked.
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmModalOpen(false)}
                      className="text-sm text-zinc-400 transition-colors hover:text-zinc-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={onSave}
                      disabled={saving}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                    >
                      Confirm and rebuild
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
