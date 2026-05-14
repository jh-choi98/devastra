'use client'
import { useState } from 'react'
import { MisclassificationModal } from './MisclassificationModal'

function ruleToCopy(kind: string): string {
  switch (kind) {
    case 'ext':            return 'extension-based files'
    case 'path':           return 'specific path prefixes'
    case 'filename':       return 'a known filename'
    case 'packageJson':    return 'package.json dependency'
    case 'requirementsTxt': return 'requirements.txt dependency'
    case 'goMod':          return 'go.mod module'
    case 'gemfile':        return 'Gemfile gem'
    case 'cargoToml':      return 'Cargo.toml crate'
    default:               return 'matched activity'
  }
}

function formatActivity(activity: { commits: number; prs: number; issues: number }): string {
  const parts: string[] = []
  if (activity.commits > 0) parts.push(`${activity.commits} commit${activity.commits !== 1 ? 's' : ''}`)
  if (activity.prs > 0) parts.push(`${activity.prs} PR${activity.prs !== 1 ? 's' : ''}`)
  return parts.join(' · ')
}

export function WhyExpansion(props: {
  tech_key: string
  displayName: string
  matchedRuleKinds: string[]
  contributingRepos: Array<{ owner: string; name: string; repoId: string; matchCount: number }>
  activity: { commits: number; prs: number; issues: number }
  hideFeedback: boolean
  ownerUserId: string
  territoryType: string
  primaryRepoId: string | null
}): JSX.Element {
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const ruleCopies = props.matchedRuleKinds.map(ruleToCopy)
  const ruleText =
    ruleCopies.length === 0
      ? 'matched activity'
      : ruleCopies.length === 1
        ? ruleCopies[0]
        : `${ruleCopies.slice(0, -1).join(', ')} and ${ruleCopies[ruleCopies.length - 1]}`

  const activityText = formatActivity(props.activity)

  return (
    <div className="mt-2 ml-5 pl-3 border-l border-slate-700 space-y-2 text-sm text-slate-400">
      <p>
        Lit from <span className="text-slate-300">{ruleText}</span>.
      </p>

      {props.contributingRepos.length > 0 && (
        <p>
          Contributing repos:{' '}
          {props.contributingRepos.slice(0, 3).map((r, i) => (
            <span key={r.repoId}>
              {i > 0 && ', '}
              <span className="text-slate-300">{r.owner}/{r.name}</span>
            </span>
          ))}
        </p>
      )}

      {activityText && <p>{activityText}</p>}

      {!props.hideFeedback && (
        <button
          onClick={() => setFeedbackOpen(true)}
          className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
        >
          This doesn&apos;t look right
        </button>
      )}

      {feedbackOpen && (
        <MisclassificationModal
          tech_key={props.tech_key}
          territoryType={props.territoryType}
          relatedRepoId={props.primaryRepoId}
          onClose={() => setFeedbackOpen(false)}
        />
      )}
    </div>
  )
}
