import { describe, expect, it } from 'vitest'
import {
  HISTORICAL_BOOTSTRAP_MAX_REPOS,
  dedupeActivities,
  hasValidatedHistoricalBootstrap,
  selectHistoricalBootstrapRepos,
} from '@/features/sync/historical'
import type { SourceActivity } from '@/features/sync/sources/interface'

function activity(repoExternalId: string, externalId: string): SourceActivity {
  return {
    source: 'github',
    externalId,
    type: 'commit',
    repoExternalId,
    occurredAt: new Date('2020-01-01T00:00:00Z'),
    filePaths: [],
    additions: 0,
    deletions: 0,
    githubUrl: `https://github.com/user/repo/commit/${externalId}`,
  }
}

describe('historical sync bootstrap', () => {
  it('selects only repos without recent activity', () => {
    const repos = [
      { externalRepoId: 'R_recent', owner: 'user', name: 'recent' },
      { externalRepoId: 'R_old', owner: 'user', name: 'old' },
    ]

    expect(selectHistoricalBootstrapRepos(repos, [activity('R_recent', 'sha-1')])).toEqual([
      { externalRepoId: 'R_old', owner: 'user', name: 'old' },
    ])
  })

  it('caps historical bootstrap repo count', () => {
    const repos = Array.from({ length: HISTORICAL_BOOTSTRAP_MAX_REPOS + 1 }, (_, index) => ({
      externalRepoId: `R_${index}`,
      owner: 'user',
      name: `repo-${index}`,
    }))

    expect(selectHistoricalBootstrapRepos(repos, [])).toHaveLength(HISTORICAL_BOOTSTRAP_MAX_REPOS)
  })

  it('skips quiet repos already checked at the current pushed_at', () => {
    const pushedAt = '2026-05-17T00:00:00.000Z'
    const repos = [
      {
        externalRepoId: 'R_checked',
        owner: 'user',
        name: 'checked',
        sourcePushedAt: pushedAt,
        historicalBootstrapSourcePushedAt: pushedAt,
      },
      {
        externalRepoId: 'R_changed',
        owner: 'user',
        name: 'changed',
        sourcePushedAt: '2026-05-17T00:00:01.000Z',
        historicalBootstrapSourcePushedAt: pushedAt,
      },
    ]

    expect(selectHistoricalBootstrapRepos(repos, [])).toEqual([repos[1]])
  })

  it('validates historical bootstrap cache only when pushed_at matches', () => {
    expect(
      hasValidatedHistoricalBootstrap({
        externalRepoId: 'R_checked',
        owner: 'user',
        name: 'checked',
        sourcePushedAt: '2026-05-17T00:00:00.000Z',
        historicalBootstrapSourcePushedAt: '2026-05-17T00:00:00.000Z',
      }),
    ).toBe(true)
    expect(
      hasValidatedHistoricalBootstrap({
        externalRepoId: 'R_changed',
        owner: 'user',
        name: 'changed',
        sourcePushedAt: '2026-05-17T00:00:01.000Z',
        historicalBootstrapSourcePushedAt: '2026-05-17T00:00:00.000Z',
      }),
    ).toBe(false)
  })

  it('keeps first-seen activities when recent and historical overlap', () => {
    const recent = activity('R_old', 'sha-1')
    const historical = activity('R_old', 'sha-1')
    historical.filePaths = ['cmd/main.go']

    expect(dedupeActivities([recent, historical])).toEqual([recent])
  })
})
