import { Metadata } from 'next'
import { getPublicProfileByUsername } from '@/lib/db/queries/public-profile'
import { TerritoryDrawer } from '@/app/_components/TerritoryDrawer'
import { PublicStickyBar } from '@/app/_components/PublicStickyBar'
import { PrivateProfile } from '@/app/_components/PrivateProfile'
import { PublicProfileMap } from './_public-profile-map'

export const revalidate = 3600 // 1 hour ISR

type PageParams = { params: { username: string } }

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { username } = params
  const ogImageUrl = `/api/og/profile/${username}`

  return {
    title: `@${username} — DevAstra`,
    description: `See ${username}'s developer world map on DevAstra`,
    openGraph: {
      title: `@${username} — DevAstra`,
      description: `See ${username}'s developer world map on DevAstra`,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `@${username} — DevAstra`,
      description: `See ${username}'s developer world map on DevAstra`,
      images: [ogImageUrl],
    },
  }
}

export default async function PublicProfilePage({ params }: PageParams) {
  const { username } = params
  const profile = await getPublicProfileByUsername(username)

  // Private or nonexistent — same copy covers both (see flow.md Flow 3)
  if (!profile) {
    return <PrivateProfile username={username} />
  }

  return (
    <div className="relative flex flex-col h-screen bg-slate-900 overflow-hidden">
      <PublicProfileMap mapData={profile.map} />
      <PublicStickyBar />
    </div>
  )
}
