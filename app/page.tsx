import { getOptionalUser } from '@/lib/auth/session'
import { getMapDataForUser } from '@/lib/db/queries/map'
import { updateLastLoginAt } from '@/lib/db/queries/users'
import { getLatestSyncJobForUser } from '@/lib/db/queries/sync-jobs'
import { Header } from '@/app/_components/Header'
import { LivingMapContainer } from './(authenticated)/_map-container'
import { LandingDemo } from '@/app/_components/LandingDemo'
import { SignInButton } from '@/app/_components/SignInButton'
import { PosthogIdentifier } from '@/app/_components/PosthogIdentifier'
import LandingAnalytics from '@/app/_components/LandingAnalytics'

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

  const isFirstReveal = !user.lastLoginAt

  const [initialData, , latestSyncJob] = await Promise.all([
    getMapDataForUser(user.id, user.lastLoginAt),
    updateLastLoginAt(user.id),
    getLatestSyncJobForUser(user.id),
  ])

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
        <LivingMapContainer userId={user.id} initial={initialData} firstReveal={isFirstReveal} />
      </div>
    </div>
  )
}
