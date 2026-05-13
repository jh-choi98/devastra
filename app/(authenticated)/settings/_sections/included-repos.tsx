'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateIncludedRepos } from '../_actions'
import type { DbRepositoryRow } from '@/lib/db/queries/users'

interface IncludedReposSectionProps {
  repos: DbRepositoryRow[]
}

export function IncludedReposSection({ repos }: IncludedReposSectionProps) {
  const [includedIds, setIncludedIds] = useState<Set<string>>(
    new Set(repos.filter((r) => r.isIncluded).map((r) => r.id)),
  )
  const [isPending, startTransition] = useTransition()

  function toggleRepo(id: string) {
    setIncludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleSave() {
    const repoIds = repos.map((r) => r.id)
    startTransition(async () => {
      try {
        await updateIncludedRepos({ repoIds, includedIds: Array.from(includedIds) })
        toast.success('Included repositories updated. Backfill started.')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update repositories.')
      }
    })
  }

  if (repos.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 mb-4">
        <h2 className="text-base font-semibold text-white mb-1">Included repositories</h2>
        <p className="text-sm text-zinc-400">No repositories found. Sync to load your repos.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 mb-4">
      <h2 className="text-base font-semibold text-white mb-1">Included repositories</h2>
      <p className="text-sm text-zinc-400 mb-4">
        Only included repositories count toward your map. Changes trigger a backfill.
      </p>
      <ul className="space-y-2 max-h-96 overflow-y-auto">
        {repos.map((repo) => (
          <li key={repo.id} className="flex items-center gap-3">
            <input
              type="checkbox"
              id={`repo-${repo.id}`}
              checked={includedIds.has(repo.id)}
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
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        Save changes
      </button>
    </div>
  )
}
