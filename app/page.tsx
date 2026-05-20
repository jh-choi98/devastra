import { Suspense } from 'react'
import { getOptionalUser } from '@/lib/auth/session'
import { getMapDataForUser } from '@/lib/db/queries/map'
import { updateLastLoginAt } from '@/lib/db/queries/users'
import { getLatestSyncJobForUser } from '@/lib/db/queries/sync-jobs'
import { getSinceLastVisitDiff } from '@/lib/db/queries/since-last-visit-diff'
import { getActiveSystemMessage } from '@/lib/db/queries/system-messages'
import { getLandingDemoData } from '@/lib/db/queries/landing-demo'
import { failStaleActiveSyncJobsForUser, isStaleActiveSyncJob } from '@/features/sync/stale-jobs'
import { LandingHero } from '@/app/_components/LandingHero'
import { SampleProfilesGallery } from '@/app/_components/SampleProfilesGallery'
import { LandingFooter } from '@/app/_components/LandingFooter'
import LandingAnalytics from '@/app/_components/LandingAnalytics'
import { SignedOutToast } from '@/app/_components/SignedOutToast'
import { AuthenticatedShell } from './(authenticated)/_authenticated-shell'
import type { BannerState } from '@/app/_components/StateBanners/BannerStack'
import type { TerritoryType } from '@/features/territories/registry'

function normalizeSyncJobProgress(progress: unknown) {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return null
  const row = progress as Record<string, unknown>
  return {
    repos_analyzed: Number(row.repos_analyzed ?? 0),
    total: Number(row.total ?? 0),
    current_step: typeof row.current_step === 'string' ? row.current_step : '',
  }
}

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
  const renderer = (process.env.CONSTELLATION_RENDERER as 'webgl' | 'svg' | undefined) ?? 'webgl'
  const user = await getOptionalUser()

  if (!user) {
    const demo = await getLandingDemoData()

    const demoData = demo
      ? {
          territories: demo.territories.map((t) => ({
            type: t.type as TerritoryType,
            stage: t.stage,
            totalWeight: Number(t.totalWeight),
            growth30d: Number(t.growth30d),
            stageChangedAt: t.stageChangedAt ? t.stageChangedAt.toISOString() : null,
          })),
          landmarks: demo.landmarks.map((l) => ({
            tech_key: l.techKey,
            territory: l.territoryType as TerritoryType,
            weight: Number(l.weight),
            firstUnlockedAt: l.firstUnlockedAt ? l.firstUnlockedAt.toISOString() : null,
          })),
        }
      : null

    return (
      <main style={{ minHeight: '100vh', background: '#0b1020', color: '#f1f5f9' }}>
        <LandingAnalytics />
        <Suspense fallback={null}>
          <SignedOutToast />
        </Suspense>
        <LandingHero demoData={demoData} renderer={renderer} />
        <Suspense fallback={null}>
          <SampleProfilesGallery />
        </Suspense>
        <LandingFooter />
      </main>
    )
  }

  // Capture previous lastLoginAt BEFORE updating it — welcome-back diff uses this value.
  const prevLastLoginAt = user.lastLoginAt
  const isFirstReveal = !prevLastLoginAt

  const now = Date.now()
  const welcomeBackTrigger =
    prevLastLoginAt != null && now - prevLastLoginAt.getTime() > TWENTY_EIGHT_DAYS_MS

  // Determine GitHub connection status
  let githubDisconnected: BannerState['githubDisconnected'] | undefined
  if (!user.githubAccessTokenEnc) {
    githubDisconnected = { variant: 'disconnected' }
  } else if (user.githubTokenExpiresAt && user.githubTokenExpiresAt.getTime() < now) {
    githubDisconnected = { variant: 'token_expired' }
  }

  // Fetch data in parallel; updateLastLoginAt runs concurrently.
  const [initialData, , initialLatestSyncJob, sinceLastVisitDiff, activeSystemMessage] =
    await Promise.all([
      getMapDataForUser(user.id, prevLastLoginAt),
      updateLastLoginAt(user.id),
      getLatestSyncJobForUser(user.id),
      welcomeBackTrigger
        ? getSinceLastVisitDiff({ userId: user.id, lastLoginAt: prevLastLoginAt })
        : Promise.resolve(null),
      getActiveSystemMessage(),
    ])
  let latestSyncJob = initialLatestSyncJob
  if (latestSyncJob && isStaleActiveSyncJob(latestSyncJob)) {
    await failStaleActiveSyncJobsForUser(user.id)
    latestSyncJob = await getLatestSyncJobForUser(user.id)
  }

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
    <>
      <Suspense fallback={null}>
        <SignedOutToast />
      </Suspense>
      <AuthenticatedShell
        user={{
          id: user.id,
          displayUsername: user.displayUsername,
          avatarUrl: user.avatarUrl,
          isPublic: user.isPublic,
        }}
        lastSyncStartedAt={latestSyncJob?.startedAt?.toISOString() ?? null}
        initialSyncKind={latestSyncJob?.kind ?? null}
        initialSyncing={latestSyncJob?.status === 'pending' || latestSyncJob?.status === 'running'}
        map={{
          userId: user.id,
          initial: initialData,
          firstReveal: isFirstReveal,
          bannerState,
          renderer,
          initialSyncJob: latestSyncJob
            ? {
                id: latestSyncJob.id,
                kind: latestSyncJob.kind,
                status: latestSyncJob.status,
                progress: normalizeSyncJobProgress(latestSyncJob.progress),
                startedAt: latestSyncJob.startedAt?.toISOString() ?? null,
                createdAt: latestSyncJob.createdAt.toISOString(),
              }
            : null,
          firstStarCinematicPending: user.firstStarCinematicPending,
          firstStarCinematicSeen: user.firstStarCinematicSeen,
          hintFlags: {
            clusterClickHintSeen: user.clusterClickHintSeen,
            shareHintSeen: user.shareHintSeen,
            recapDiffHintSeen: user.recapDiffHintSeen,
          },
        }}
      />
    </>
  )
}
