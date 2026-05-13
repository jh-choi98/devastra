'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { TERRITORIES } from '@/features/territories/registry'
import type { TerritoryType } from '@/features/territories/registry'

export type TerritoryDrawerData = {
  type: TerritoryType
  stage: number
  growth30d: number
  totalWeight: number
  topRepos: Array<{ owner: string; name: string; githubUrl: string }>
  recentPRs: Array<{ title: string | null; githubUrl: string }>
  interpretation: string
}

export function TerritoryDrawer(props: {
  open: boolean
  territory: TerritoryType | null
  data: TerritoryDrawerData | null
  onClose: () => void
}): JSX.Element {
  const { open, territory, data, onClose } = props
  const territoryInfo = territory ? TERRITORIES[territory] : null

  return (
    <AnimatePresence>
      {open && data && territoryInfo && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            key="drawer"
            className="fixed right-0 top-0 bottom-0 z-50 w-full md:w-2/5 bg-slate-900 text-slate-100 shadow-2xl flex flex-col overflow-y-auto"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div>
                <h2 className="text-xl font-bold">{territoryInfo.name}</h2>
                <span
                  className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold"
                  style={{ backgroundColor: territoryInfo.color, color: '#fff' }}
                >
                  Stage {data.stage}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded hover:bg-slate-700 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              {data.growth30d > 0 && (
                <div className="text-sm text-slate-400">
                  <span className="text-green-400 font-semibold">
                    +{data.totalWeight > 0
                      ? Math.round((data.growth30d / data.totalWeight) * 100)
                      : 0}%
                  </span>{' '}
                  growth in the last 30 days
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Top Repos
                  </h3>
                  <ul className="space-y-1">
                    {data.topRepos.map((repo) => (
                      <li key={repo.githubUrl}>
                        <a
                          href={repo.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 truncate block"
                        >
                          {repo.owner}/{repo.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Recent PRs
                  </h3>
                  <ul className="space-y-1">
                    {data.recentPRs.map((pr, i) => (
                      <li key={pr.githubUrl}>
                        <a
                          href={pr.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 truncate block"
                        >
                          {pr.title ?? `PR #${i + 1}`}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700">
              <p className="text-sm text-slate-400 italic">{data.interpretation}</p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
