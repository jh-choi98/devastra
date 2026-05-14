'use client'
import { useState, useEffect, useRef } from 'react'
import { WhyExpansion } from './WhyExpansion'

function formatFirstLit(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `since ${d.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`
}

export function StarRow(props: {
  tech_key: string
  displayName: string
  weight: number
  firstUnlockedAt: string | null
  topContributingRepo: { owner: string; name: string; repoId: string } | null
  brightnessDescriptor: 'brightest' | 'bright' | 'dim'
  highlighted: boolean
  expandedByDefault: boolean
  ownerUserId: string
  territoryType: string
  hideFeedback: boolean
  // WhyExpansion data
  matchedRuleKinds: string[]
  contributingRepos: Array<{ owner: string; name: string; repoId: string; matchCount: number }>
  activity: { commits: number; prs: number; issues: number }
  color: string
}): JSX.Element {
  const [expanded, setExpanded] = useState(props.expandedByDefault)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (props.highlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [props.highlighted])

  const descriptorColor: Record<string, string> = {
    brightest: 'text-yellow-300',
    bright: 'text-slate-200',
    dim: 'text-slate-500',
  }

  return (
    <div
      ref={rowRef}
      className={`rounded-lg px-3 py-2 transition-colors cursor-pointer select-none ${
        props.highlighted ? 'bg-slate-700/60' : 'hover:bg-slate-700/30'
      }`}
      onClick={() => setExpanded((v) => !v)}
      role="button"
      aria-expanded={expanded}
    >
      <div className="flex items-center gap-2">
        {/* Star dot matching cluster color */}
        <span
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: props.color }}
        />

        <span className="flex-1 text-sm font-medium text-slate-100">{props.displayName}</span>

        <span className={`text-xs ${descriptorColor[props.brightnessDescriptor]}`}>
          {props.brightnessDescriptor}
        </span>

        {props.firstUnlockedAt && (
          <span className="text-xs text-slate-500 hidden sm:inline">
            {formatFirstLit(props.firstUnlockedAt)}
          </span>
        )}

        {props.topContributingRepo && (
          <span className="text-xs text-slate-500 hidden md:inline truncate max-w-[120px]">
            {props.topContributingRepo.owner}/{props.topContributingRepo.name}
          </span>
        )}

        <span className="text-slate-600 text-xs ml-1">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <WhyExpansion
          tech_key={props.tech_key}
          displayName={props.displayName}
          matchedRuleKinds={props.matchedRuleKinds}
          contributingRepos={props.contributingRepos}
          activity={props.activity}
          hideFeedback={props.hideFeedback}
          ownerUserId={props.ownerUserId}
          territoryType={props.territoryType}
          primaryRepoId={props.topContributingRepo?.repoId ?? null}
        />
      )}
    </div>
  )
}
