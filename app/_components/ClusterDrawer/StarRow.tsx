'use client'
import { useState, useEffect, useRef } from 'react'
import { WhyExpansion } from './WhyExpansion'
import type { BrightnessDescriptor } from '@/features/constellation/render/magnitude'

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
  brightnessDescriptor: BrightnessDescriptor
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

  const descriptorColor: Record<BrightnessDescriptor, string> = {
    brightest: 'text-yellow-300',
    bright: 'text-slate-200',
    mid: 'text-slate-300',
    dim: 'text-slate-400',
    'very dim': 'text-slate-500',
  }

  return (
    <div
      ref={rowRef}
      className={`cursor-pointer select-none rounded-lg px-3 py-2 transition-colors ${
        props.highlighted ? 'bg-slate-700/60' : 'hover:bg-slate-700/30'
      }`}
      onClick={() => setExpanded((v) => !v)}
      role="button"
      aria-expanded={expanded}
    >
      <div className="flex items-center gap-2">
        {/* Star dot matching cluster color */}
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: props.color }}
        />

        <span className="flex-1 text-sm font-medium text-slate-100">{props.displayName}</span>

        <span className={`text-xs ${descriptorColor[props.brightnessDescriptor]}`}>
          {props.brightnessDescriptor}
        </span>

        {props.firstUnlockedAt && (
          <span className="hidden text-xs text-slate-500 sm:inline">
            {formatFirstLit(props.firstUnlockedAt)}
          </span>
        )}

        {props.topContributingRepo && (
          <span className="hidden max-w-[120px] truncate text-xs text-slate-500 md:inline">
            {props.topContributingRepo.owner}/{props.topContributingRepo.name}
          </span>
        )}

        <span className="ml-1 text-xs text-slate-600">{expanded ? '▲' : '▼'}</span>
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
