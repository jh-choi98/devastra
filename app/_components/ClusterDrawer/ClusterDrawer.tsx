'use client'
import { useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { TerritoryType } from '@/features/territories/registry'
import { TERRITORIES } from '@/features/territories/registry'
import { useReducedMotion } from '@/app/_components/Constellation/SparkAnimation'
import { StarRow } from './StarRow'
import { RecentPRs } from './RecentPRs'

export type ClusterDrawerLitStar = {
  tech_key: string
  displayName: string
  weight: number
  firstUnlockedAt: string | null
  topContributingRepo: { owner: string; name: string; repoId: string } | null
  matchedRuleKinds: string[]
  contributingRepos: Array<{ owner: string; name: string; repoId: string; matchCount: number }>
  activity: { commits: number; prs: number; issues: number }
}

export type ClusterDrawerData = {
  type: TerritoryType
  stage: number
  growth30d: number
  stageChangedAt: string | null
  litStars: ClusterDrawerLitStar[]
}

function isActiveThisWeek(star: ClusterDrawerLitStar): boolean {
  if (!star.firstUnlockedAt) return false
  return Date.now() - new Date(star.firstUnlockedAt).getTime() < 7 * 86_400_000
}

function computeBrightnessDescriptor(
  stars: ClusterDrawerLitStar[],
  techKey: string,
): 'brightest' | 'bright' | 'dim' {
  const sorted = [...stars].sort((a, b) => b.weight - a.weight)
  const idx = sorted.findIndex((s) => s.tech_key === techKey)
  if (idx === 0) return 'brightest'
  const topWeight = sorted[0]?.weight ?? 0
  const weight = sorted[idx]?.weight ?? 0
  return weight >= topWeight * 0.5 ? 'bright' : 'dim'
}

export function ClusterDrawer(props: {
  data: ClusterDrawerData
  userId: string
  focusedTechKey?: string
  variant: 'owner' | 'visitor'
  ownerUsername?: string
  onClose: () => void
}): JSX.Element {
  const { data, userId, focusedTechKey, variant, onClose } = props
  const info = TERRITORIES[data.type]
  const reducedMotion = useReducedMotion()

  const recentlyExpanded =
    data.stageChangedAt != null &&
    Date.now() - new Date(data.stageChangedAt).getTime() < 7 * 86_400_000

  const anyActiveThisWeek = data.growth30d > 0 || data.litStars.some(isActiveThisWeek)

  let statusLine = anyActiveThisWeek ? 'Active this week' : ''
  if (recentlyExpanded) statusLine += statusLine ? ' · Recently expanded' : 'Recently expanded'

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const hideFeedback = variant === 'visitor'

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.aside
        key="cluster-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${info.name} cluster details`}
        data-testid="cluster-drawer"
        className="fixed right-0 top-0 bottom-0 z-50 w-full md:w-[480px] bg-slate-900 text-slate-100 shadow-2xl flex flex-col overflow-y-auto"
        initial={reducedMotion ? { x: 0 } : { x: '100%' }}
        animate={{ x: 0 }}
        exit={reducedMotion ? { x: 0 } : { x: '100%' }}
        transition={reducedMotion ? { duration: 0 } : { type: 'tween', duration: 0.28 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-700/60 shrink-0">
          <div className="space-y-1">
            <h2 className="text-xl font-bold" style={{ color: info.accentColor === '#3B5BFF' ? info.color : info.color }}>
              {info.name}
            </h2>
            {statusLine && (
              <p className="text-sm text-slate-400">{statusLine}</p>
            )}
            <p className="text-xs text-slate-600">Stage {data.stage}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200 shrink-0"
            aria-label="Close cluster drawer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Lit stars */}
          {data.litStars.length > 0 ? (
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Lit stars
              </h3>
              <div className="space-y-1">
                {data.litStars.map((star) => (
                  <StarRow
                    key={star.tech_key}
                    tech_key={star.tech_key}
                    displayName={star.displayName}
                    weight={star.weight}
                    firstUnlockedAt={star.firstUnlockedAt}
                    topContributingRepo={star.topContributingRepo}
                    brightnessDescriptor={computeBrightnessDescriptor(data.litStars, star.tech_key)}
                    highlighted={focusedTechKey === star.tech_key}
                    expandedByDefault={focusedTechKey === star.tech_key}
                    ownerUserId={userId}
                    territoryType={data.type}
                    hideFeedback={hideFeedback}
                    matchedRuleKinds={star.matchedRuleKinds}
                    contributingRepos={star.contributingRepos}
                    activity={star.activity}
                    color={info.color}
                  />
                ))}
              </div>
            </section>
          ) : (
            <p className="text-sm text-slate-500">No stars lit yet in this cluster.</p>
          )}

          {/* Recent PRs */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Recent PRs
            </h3>
            <RecentPRs userId={userId} cluster={data.type} />
          </section>

          {/* Visitor CTA */}
          {variant === 'visitor' && props.ownerUsername && (
            <div className="border-t border-slate-700/60 pt-4">
              <a
                href={`/?from=profile&inviter=${encodeURIComponent(props.ownerUsername)}`}
                className="block text-center text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Want to see yours? Create yours, free →
              </a>
            </div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}
