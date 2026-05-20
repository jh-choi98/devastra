'use client'

import dynamic from 'next/dynamic'
import type { LivingMapContainerProps } from './_map-container'

const Header = dynamic(() => import('@/app/_components/Header').then((mod) => mod.Header), {
  ssr: false,
})

const LivingMapContainer = dynamic(
  () => import('./_map-container').then((mod) => mod.LivingMapContainer),
  { ssr: false },
)

const PosthogIdentifier = dynamic(
  () => import('@/app/_components/PosthogIdentifier').then((mod) => mod.PosthogIdentifier),
  { ssr: false },
)

interface AuthenticatedShellProps {
  user: {
    id: string
    displayUsername: string
    avatarUrl: string | null
    isPublic: boolean
  }
  lastSyncStartedAt: string | null
  initialSyncing: boolean
  map: LivingMapContainerProps
}

export function AuthenticatedShell({
  user,
  lastSyncStartedAt,
  initialSyncing,
  map,
}: AuthenticatedShellProps) {
  return (
    <div className="relative h-screen overflow-hidden bg-[#020207]">
      <PosthogIdentifier userId={user.id} />
      <div className="absolute inset-0">
        <LivingMapContainer {...map} />
      </div>
      <Header
        user={user}
        lastSyncStartedAt={lastSyncStartedAt ? new Date(lastSyncStartedAt) : null}
        initialSyncing={initialSyncing}
      />
    </div>
  )
}
