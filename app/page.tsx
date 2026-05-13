import { signIn } from '@/lib/auth/actions'
import { getOptionalUser } from '@/lib/auth/session'
import { getMapDataForUser } from '@/lib/db/queries/map'
import { updateLastLoginAt } from '@/lib/db/queries/users'
import { getLatestSyncJobForUser } from '@/lib/db/queries/sync-jobs'
import { Header } from '@/app/_components/Header'
import { LivingMapContainer } from './(authenticated)/_map-container'

export default async function RootPage() {
  const user = await getOptionalUser()

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-semibold">DevAtlas</h1>
        <p className="text-gray-600">Turn your GitHub into a developer world map</p>
        <form action={signIn}>
          <button
            type="submit"
            className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
          >
            Sign in with GitHub
          </button>
        </form>
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
