'use client'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { submitMisclassificationFeedback } from '@/features/feedback/misclassification.actions'

type Category = 'wrong_category' | 'shouldnt_be_lit' | 'not_mine' | 'other'

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'wrong_category', label: 'Wrong category' },
  { value: 'shouldnt_be_lit', label: "Shouldn't be lit" },
  { value: 'not_mine', label: 'Activity not mine' },
  { value: 'other', label: 'Other' },
]

export function MisclassificationModal(props: {
  tech_key: string
  territoryType: string
  relatedRepoId: string | null
  onClose: () => void
}): JSX.Element {
  const [category, setCategory] = useState<Category>('wrong_category')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await submitMisclassificationFeedback({
        tech_key: props.tech_key,
        territory_type: props.territoryType as Parameters<typeof submitMisclassificationFeedback>[0]['territory_type'],
        related_repo_id: props.relatedRepoId,
        category,
        note: note.trim() || null,
      })
      if (result.kind === 'rate_limited') {
        setError("You've reached today's feedback limit. Thanks!")
      } else if (result.kind === 'error') {
        setError('Could not submit. Try again.')
      } else {
        toast("Thanks. We'll look into it.")
        props.onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={props.onClose} />
      <div className="relative z-10 w-full max-w-md bg-slate-800 rounded-xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-100">
            Help us understand. What looks off?
          </h3>
          <button
            onClick={props.onClose}
            className="p-1 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full bg-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm border border-slate-600 focus:border-slate-400 focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional details..."
            maxLength={2000}
            rows={3}
            className="w-full bg-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm border border-slate-600 focus:border-slate-400 focus:outline-none resize-none placeholder:text-slate-500"
          />
        </div>

        {error && <p className="text-sm text-amber-400">{error}</p>}

        <p className="text-xs text-slate-500">
          We may use this to improve classification. We won&apos;t email you about this submission.
        </p>

        <button
          onClick={onSubmit}
          disabled={pending}
          className="w-full bg-slate-600 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 rounded-lg py-2 text-sm font-medium transition-colors"
        >
          {pending ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
