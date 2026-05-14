import { getOptionalUser } from '@/lib/auth/session'
import { getMapDataForUser } from '@/lib/db/queries/map'
import { updateLastLoginAt } from '@/lib/db/queries/users'
import { getLatestSyncJobForUser } from '@/lib/db/queries/sync-jobs'
import { getSinceLastVisitDiff } from '@/lib/db/queries/since-last-visit-diff'
import { getActiveSystemMessage } from '@/lib/db/queries/system-messages'
import { Header } from '@/app/_components/Header'
import { LivingMapContainer } from './(authenticated)/_map-container'
import { LandingDemo } from '@/app/_components/LandingDemo'
import { SignInButton } from '@/app/_components/SignInButton'
import { PosthogIdentifier } from '@/app/_components/PosthogIdentifier'
import LandingAnalytics from '@/app/_components/LandingAnalytics'
import type { BannerState } from '@/app/_components/StateBanners/BannerStack'
import type { TerritoryType } from '@/features/territories/registry'

const TERRITORY_UI_LABELS: Record<string, string> = {
  frontend_land: 'Frontend',
  backend_fortress: 'Backend',
  data_pipeline_zone: 'Data',
  testing_lab: 'Testing',
  devops_harbor: 'DevOps',
  docs_library: 'Docs',
}

const TWENTY_EIGHT_DAYS_MS = 28 * 24 * 60 * 60 * 1000

export default async function RootPage() {
  const user = await getOptionalUser()

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col bg-slate-950 text-white">
        <LandingAnalytics />
        <section className="grow flex items-center justify-center px-4">
          <div className="text-center max-w-xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
              Turn your GitHub into a developer world map.
            </h1>
            <p className="mt-4 text-base text-neutral-400">A living world that grows as you code.</p>
            <div className="mt-8">
              <SignInButton />
            </div>
          </div>
        </section>
        <section className="h-[50vh]">
          <LandingDemo />
        </section>
        <footer className="py-6 text-xs text-neutral-500 flex justify-center gap-4">
          <a href="/privacy" className="hover:text-neutral-300 transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-neutral-300 transition-colors">Terms</a>
          <a
            href="https://github.com/devatlas/devatlas"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-300 transition-colors"
          >
            GitHub
          </a>
        </footer>
      </main>
    )
  }

  // Capture previous lastLoginAt BEFORE updating it — welcome-back diff uses this value.
  const prevLastLoginAt = user.lastLoginAt
  const isFirstReveal = !prevLastLoginAt

  const now = Date.now()
  const welcomeBackTrigger =
    prevLastLoginAt != null &&
    now - prevLastLoginAt.getTime() > TWENTY_EIGHT_DAYS_MS

  // Determine GitHub connection status
  let githubDisconnected: BannerState['githubDisconnected'] | undefined
  if (!user.githubAccessTokenEnc) {
    githubDisconnected = { variant: 'disconnected' }
  } else if (user.githubTokenExpiresAt && user.githubTokenExpiresAt.getTime() < now) {
    githubDisconnected = { variant: 'token_expired' }
  }

  // Fetch data in parallel; updateLastLoginAt runs concurrently.
  const [initialData, , latestSyncJob, sinceLastVisitDiff, activeSystemMessage] =
    await Promise.all([
      getMapDataForUser(user.id, prevLastLoginAt),
      updateLastLoginAt(user.id),
      getLatestSyncJobForUser(user.id),
      welcomeBackTrigger
        ? getSinceLastVisitDiff({ userId: user.id, lastLoginAt: prevLastLoginAt })
        : Promise.resolve(null),
      getActiveSystemMessage(),
    ])

  // Build banner state
  const bannerState: BannerState = {}

  if (githubDisconnected) {
    bannerState.githubDisconnected = githubDisconnected
  }

  if (activeSystemMessage) {
    bannerState.systemStatus = {
      id: activeSystemMessage.id,
      message: activeSystemMessage.message,
      severity: activeSystemMessage.severity as 'info' | 'warning' | 'error',
    }
  }

  if (welcomeBackTrigger && sinceLastVisitDiff && prevLastLoginAt) {
    bannerState.welcomeBack = {
      diffSummary: {
        new_stars_count: sinceLastVisitDiff.new_stars_count,
        expanded_clusters: sinceLastVisitDiff.expanded_clusters.map(
          (t) => TERRITORY_UI_LABELS[t] ?? t,
        ),
      },
      lastLoginIso: prevLastLoginAt.toISOString(),
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      <PosthogIdentifier userId={user.id} />
      <Header
        user={{
          id: user.id,
          displayUsername: user.displayUsername,
          avatarUrl: user.avatarUrl,
          isPublic: user.isPublic,
        }}
        lastSyncStartedAt={latestSyncJob?.startedAt ?? null}
      />
      <div className="flex-1 overflow-hidden">
        <LivingMapContainer
          userId={user.id}
          initial={initialData}
          firstReveal={isFirstReveal}
          bannerState={bannerState}
          firstStarCinematicPending={user.firstStarCinematicPending}
          firstStarCinematicSeen={user.firstStarCinematicSeen}
          hintFlags={{
            clusterClickHintSeen: user.clusterClickHintSeen,
            shareHintSeen: user.shareHintSeen,
            recapDiffHintSeen: user.recapDiffHintSeen,
          }}
        />
      </div>
    </div>
  )
}
