'use client'

function ruleToCopy(kind: string): string {
  switch (kind) {
    case 'ext':
      return 'extension-based files'
    case 'path':
      return 'specific path prefixes'
    case 'filename':
      return 'a known filename'
    case 'packageJson':
      return 'package.json dependency'
    case 'requirementsTxt':
      return 'requirements.txt dependency'
    case 'goMod':
      return 'go.mod module'
    case 'gemfile':
      return 'Gemfile gem'
    case 'cargoToml':
      return 'Cargo.toml crate'
    default:
      return 'matched activity'
  }
}

function formatActivity(activity: { commits: number; prs: number; issues: number }): string {
  const parts: string[] = []
  if (activity.commits > 0)
    parts.push(`${activity.commits} commit${activity.commits !== 1 ? 's' : ''}`)
  if (activity.prs > 0) parts.push(`${activity.prs} PR${activity.prs !== 1 ? 's' : ''}`)
  return parts.join(' · ')
}

export function WhyExpansion(props: {
  matchedRuleKinds: string[]
  contributingRepos: Array<{ owner: string; name: string; repoId: string; matchCount: number }>
  activity: { commits: number; prs: number; issues: number }
}): JSX.Element {
  const ruleCopies = props.matchedRuleKinds.map(ruleToCopy)
  const ruleText =
    ruleCopies.length === 0
      ? 'matched activity'
      : ruleCopies.length === 1
        ? ruleCopies[0]
        : `${ruleCopies.slice(0, -1).join(', ')} and ${ruleCopies[ruleCopies.length - 1]}`

  const activityText = formatActivity(props.activity)

  return (
    <div className="ml-5 mt-2 space-y-2 border-l border-slate-700 pl-3 text-sm text-slate-400">
      <p>
        Lit from <span className="text-slate-300">{ruleText}</span>.
      </p>

      {props.contributingRepos.length > 0 && (
        <p>
          Contributing repos:{' '}
          {props.contributingRepos.slice(0, 3).map((r, i) => (
            <span key={r.repoId}>
              {i > 0 && ', '}
              <span className="text-slate-300">
                {r.owner}/{r.name}
              </span>
            </span>
          ))}
        </p>
      )}

      {activityText && <p>{activityText}</p>}
    </div>
  )
}
