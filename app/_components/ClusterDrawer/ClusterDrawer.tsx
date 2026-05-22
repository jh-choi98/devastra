'use client'
import { useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { TerritoryType } from '@/features/territories/registry'
import { TERRITORIES } from '@/features/territories/registry'
import { brightnessDescriptor } from '@/features/constellation/render/magnitude'
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

export function ClusterDrawer(props: {
  data: ClusterDrawerData
  userId: string
  focusedTechKey?: string
  variant: 'owner' | 'visitor'
  ownerUsername?: string
  loading?: boolean
  onClose: () => void
}): JSX.Element {
  const { data, userId, focusedTechKey, variant, loading = false, onClose } = props
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

  return (
    <AnimatePresence>
      <motion.div
        key="cluster-drawer-scrim"
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[6px]"
        onClick={onClose}
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'tween', duration: 0.28 }}
      />
      <motion.aside
        key="cluster-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${info.name} cluster details`}
        data-testid="cluster-drawer"
        className="fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col overflow-y-auto bg-slate-900 text-slate-100 shadow-2xl md:w-[480px]"
        initial={reducedMotion ? { x: 0 } : { x: '100%' }}
        animate={{ x: 0 }}
        exit={reducedMotion ? { x: 0 } : { x: '100%' }}
        transition={reducedMotion ? { duration: 0 } : { type: 'tween', duration: 0.28 }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-slate-700/60 p-6">
          <div className="space-y-1">
            <h2
              className="text-xl font-bold"
              style={{ color: info.accentColor === '#3B5BFF' ? info.color : info.color }}
            >
              {info.name}
            </h2>
            {statusLine && <p className="text-sm text-slate-400">{statusLine}</p>}
            <p className="text-xs text-slate-600">Stage {data.stage}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
            aria-label="Close cluster drawer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {loading ? (
            <>
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Lit stars
                </h3>
                <div className="space-y-3" aria-hidden="true">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 rounded-full bg-slate-700/80" />
                      <div className="h-4 flex-1 rounded bg-slate-800/80" />
                      <div className="h-4 w-20 rounded bg-slate-800/60" />
                    </div>
                  ))}
                </div>
                <p className="sr-only">Loading cluster details.</p>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Recent PRs
                </h3>
                <div className="space-y-3" aria-hidden="true">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="flex items-center justify-between gap-4">
                      <div className="h-4 flex-1 rounded bg-slate-800/80" />
                      <div className="h-4 w-14 rounded bg-slate-800/60" />
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <>
              {/* Lit stars */}
              {data.litStars.length > 0 ? (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                        brightnessDescriptor={brightnessDescriptor(star.weight)}
                        highlighted={focusedTechKey === star.tech_key}
                        expandedByDefault={focusedTechKey === star.tech_key}
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
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Recent PRs
                </h3>
                <RecentPRs userId={userId} cluster={data.type} />
              </section>

              {/* Visitor CTA */}
              {variant === 'visitor' && props.ownerUsername && (
                <div className="border-t border-slate-700/60 pt-4">
                  <a
                    href={`/?from=profile&inviter=${encodeURIComponent(props.ownerUsername)}`}
                    className="block text-center text-sm text-slate-400 transition-colors hover:text-slate-200"
                  >
                    Want to see yours? Start yours for free →
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}
