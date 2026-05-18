'use client'

import { useState, useTransition } from 'react'
import { saveRepoSelectionAndStartSync } from './_actions'
import type { OnboardingRepo } from '@/lib/github/onboarding-fetch'

interface RepoSelectorProps {
  repos: OnboardingRepo[]
  userId: string
}

export function RepoSelector({ repos }: RepoSelectorProps) {
  const [includedIds, setIncludedIds] = useState<Set<string>>(
    new Set(repos.map((r) => r.externalRepoId)),
  )
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()

  const filtered = search
    ? repos.filter((r) => `${r.owner}/${r.name}`.toLowerCase().includes(search.toLowerCase()))
    : repos

  const selectedCount = includedIds.size

  function toggleRepo(externalRepoId: string) {
    setIncludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(externalRepoId)) {
        next.delete(externalRepoId)
      } else {
        next.add(externalRepoId)
      }
      return next
    })
  }

  function selectAllRepos() {
    setIncludedIds(new Set(repos.map((r) => r.externalRepoId)))
  }

  function deselectAllRepos() {
    setIncludedIds(new Set())
  }

  function handleSubmit(nextIncludedIds = includedIds) {
    startTransition(async () => {
      await saveRepoSelectionAndStartSync({
        includedIds: Array.from(nextIncludedIds),
        repos: repos.map((r) => ({
          externalRepoId: r.externalRepoId,
          owner: r.owner,
          name: r.name,
          primaryLanguage: r.primaryLanguage,
        })),
      })
    })
  }

  return (
    <main className="min-h-screen bg-zinc-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Pick your repos</h1>
        <p className="text-zinc-400 text-sm mb-6">
          These repositories will shape your constellation. All are included by default.
        </p>
        <p className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs leading-5 text-zinc-500">
          Privacy note: selected public repos are analyzed from metadata only: changed file paths,
          activity dates, additions/deletions, and dependency names. We do not request private repos
          or store code, diffs, commit messages, or PR bodies.
        </p>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            Selected {selectedCount} of {repos.length}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAllRepos}
              disabled={isPending || selectedCount === repos.length}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={deselectAllRepos}
              disabled={isPending || selectedCount === 0}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Deselect all
            </button>
          </div>
        </div>

        {repos.length > 20 && (
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories…"
            className="w-full mb-4 rounded-lg bg-zinc-800 border border-zinc-600 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}

        <ul className="space-y-2 mb-8 max-h-[60vh] overflow-y-auto">
          {filtered.map((repo) => (
            <li key={repo.externalRepoId} className="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                id={`repo-${repo.externalRepoId}`}
                checked={includedIds.has(repo.externalRepoId)}
                onChange={() => toggleRepo(repo.externalRepoId)}
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-indigo-500"
              />
              <label
                htmlFor={`repo-${repo.externalRepoId}`}
                className="flex-1 flex items-center justify-between cursor-pointer"
              >
                <span className="text-sm text-zinc-300">
                  {repo.owner}/{repo.name}
                  {repo.primaryLanguage && (
                    <span className="ml-2 text-xs text-zinc-500">{repo.primaryLanguage}</span>
                  )}
                </span>
                <span className="text-xs text-zinc-500 ml-4">
                  {repo.ninetyDayCommitCount > 0 && `${repo.ninetyDayCommitCount} commits (90d)`}
                </span>
              </label>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="text-sm text-zinc-500 py-4 text-center">No repositories found.</li>
          )}
        </ul>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleSubmit(new Set())}
            disabled={isPending}
            className="flex-1 py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            Start with empty sky
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isPending || selectedCount === 0}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            Build my constellation
          </button>
        </div>
      </div>
    </main>
  )
}
