import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { resolveUsername } from '@/lib/utils/username-redirect'
import { getPublicProfileByUsername } from '@/lib/db/queries/public-profile'
import { getOptionalUser } from '@/lib/auth/session'
import { PrivateProfile } from '@/app/_components/PrivateProfile'
import { PublicProfileMap } from './_public-profile-map'
import { VisitorReveal } from './_components/VisitorReveal'
import { ogVersionParam } from '@/lib/og/version'
import { publicUrl } from '@/lib/utils/public-base-url'

export const revalidate = 3600

type PageParams = { params: { username: string } }

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const username = params.username.toLowerCase()
  const encodedUsername = encodeURIComponent(username)
  const profileUrl = publicUrl(`/${encodedUsername}`)
  const ogUrl = publicUrl(`/api/og/profile/${encodedUsername}?${ogVersionParam()}`)
  return {
    title: `${username} on DevAstra`,
    description: 'A developer skill constellation that lights up as you code.',
    openGraph: {
      type: 'profile',
      url: profileUrl,
      images: [
        {
          url: ogUrl,
          width: 1200,
          height: 630,
          alt: `${username}'s DevAstra constellation`,
        },
      ],
      siteName: 'DevAstra',
    },
    twitter: {
      card: 'summary_large_image',
      images: [{ url: ogUrl, alt: `${username}'s DevAstra constellation` }],
    },
    alternates: {
      canonical: `/${username}`,
    },
  }
}

export default async function PublicProfilePage({ params }: PageParams) {
  const renderer = (process.env.CONSTELLATION_RENDERER as 'webgl' | 'svg' | undefined) ?? 'webgl'
  const resolved = await resolveUsername(params.username)

  if (resolved.kind === 'not_found') {
    notFound()
  }

  if (resolved.kind === 'redirect') {
    permanentRedirect(`/${resolved.canonicalUsername}`)
  }

  const { userId, canonicalUsername } = resolved

  const profile = await getPublicProfileByUsername(canonicalUsername)

  if (!profile) {
    // User exists but is_public = false
    return <PrivateProfile username={canonicalUsername} />
  }

  const viewer = await getOptionalUser()
  const variant: 'visitor' | 'owner_self' | 'logged_in_visitor' =
    !viewer ? 'visitor'
    : viewer.id === userId ? 'owner_self'
    : 'logged_in_visitor'

  const litCount = profile.map.landmarks.length
  const activeClusterCount = profile.map.territories.filter((t) => t.stage > 1).length

  const identityTop = variant === 'owner_self'
    ? 'top-28'  // account for the strip below header
    : 'top-16'

  return (
    <div
      className="relative flex flex-col h-screen overflow-hidden"
      style={{ background: 'linear-gradient(to bottom, #0b1020, #020617)' }}
    >
      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-4 py-3 shrink-0">
        <Link href="/" className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
          DevAstra
        </Link>
        {variant === 'logged_in_visitor' && (
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Back to my sky →
          </Link>
        )}
      </header>

      {/* Owner self-view strip */}
      {variant === 'owner_self' && (
        <div className="z-20 bg-slate-800/80 border-b border-slate-700/60 px-4 py-2 text-center shrink-0">
          <span className="text-sm text-slate-300">
            This is how others see your constellation
          </span>
          <span className="mx-3 text-slate-600">·</span>
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Back to my private view
          </Link>
        </div>
      )}

      {/* Identity block — top-left compact */}
      <div className={`absolute ${identityTop} left-4 z-20 flex flex-col gap-1`}>
        {profile.avatarUrl && (
          <Image
            src={profile.avatarUrl}
            alt={`${canonicalUsername} avatar`}
            width={40}
            height={40}
            className="rounded-full mb-1"
          />
        )}
        <span className="text-slate-200 text-sm font-medium">@{canonicalUsername}</span>
        <span className="text-slate-500 text-xs">
          {litCount} stars lit · {activeClusterCount} clusters active
        </span>
        {variant !== 'owner_self' && (
          <span className="text-slate-600 text-xs mt-1">
            Viewing {canonicalUsername}&apos;s constellation
          </span>
        )}
      </div>

      {/* Screen-reader summary */}
      {variant === 'owner_self' ? (
        <div className="sr-only" role="status" aria-live="polite">
          Your constellation has {litCount} stars lit across {activeClusterCount} clusters.
        </div>
      ) : (
        <div className="sr-only">
          {canonicalUsername}&apos;s constellation has {litCount} stars lit across {activeClusterCount} clusters.
        </div>
      )}

      {/* Constellation + drawer (+ sticky bar for visitors) */}
      <div className="flex-1 relative">
        <PublicProfileMap
          mapData={profile.map}
          ownerUsername={canonicalUsername}
          drawerVariant={variant === 'owner_self' ? 'owner' : 'visitor'}
          showStickyBar={variant === 'visitor'}
          renderer={renderer}
        />
      </div>

      {/* Session-scoped visitor reveal animation */}
      {variant === 'visitor' && <VisitorReveal username={canonicalUsername} />}
    </div>
  )
}
