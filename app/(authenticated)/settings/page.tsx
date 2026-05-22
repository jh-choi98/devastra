import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/auth/supabase-server'
import { getSettingsPageData } from '@/lib/db/queries/users'
import { isEmailRecapFeatureEnabled } from '@/features/recap/feature-flag'
import { AccountInfoSection } from './_sections/account-info'
import { PublicProfileSection } from './_sections/public-profile'
import { EmailRecapSection } from './_sections/email-recap'
import { TimezoneSection } from './_sections/timezone'
import { UsernameChangeSection } from './_sections/username-change'
import { IncludedReposSection } from './_sections/included-repos'
import { DangerZoneSection } from './_sections/danger-zone'
import { getTimezoneOptions, getTimezonePreviewLine } from './_timezones'

function getNextSunday(): string {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek
  const next = new Date(now)
  next.setUTCDate(now.getUTCDate() + daysUntilSunday)
  return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://devastra.app'

export default async function SettingsPage() {
  const supabase = createServerClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/')

  const user = await getSettingsPageData(authUser.id)
  if (!user) redirect('/')

  const emailRecapsEnabled = isEmailRecapFeatureEnabled()
  const nextRecapDate = emailRecapsEnabled ? getNextSunday() : null
  const timezonePreview = getTimezonePreviewLine(user.timezone, { emailRecapsEnabled })
  const timezoneOptions = getTimezoneOptions(user.timezone)

  return (
    <main className="min-h-screen bg-[#0b1020] px-4 py-10">
      <div className="mx-auto max-w-[800px]">
        {/* Header */}
        <div className="mb-10 flex items-start justify-between gap-4 lg:items-center">
          <div className="relative min-w-0">
            <Link
              href="/"
              className="mb-3 inline-flex whitespace-nowrap text-sm text-zinc-400 transition-colors hover:text-zinc-200 lg:absolute lg:right-full lg:top-1/2 lg:mb-0 lg:mr-8 lg:-translate-y-1/2"
            >
              ← Back
            </Link>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Settings</h1>
          </div>
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.displayUsername}
              className="mt-8 h-8 w-8 rounded-full lg:mt-0"
            />
          ) : (
            <div className="mt-8 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs text-zinc-200 lg:mt-0">
              {user.displayUsername[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Sections */}
        <div className="space-y-8">
          <AccountInfoSection
            avatarUrl={user.avatarUrl}
            displayUsername={user.displayUsername}
            email={user.email}
          />

          <hr className="border-zinc-800" />

          <PublicProfileSection
            initialIsPublic={user.isPublic}
            displayUsername={user.displayUsername}
            baseUrl={BASE_URL}
          />

          <hr className="border-zinc-800" />

          {emailRecapsEnabled ? (
            <>
              <EmailRecapSection
                initialEnabled={user.emailRecapEnabled}
                nextRecapDate={nextRecapDate ?? ''}
              />

              <hr className="border-zinc-800" />
            </>
          ) : null}

          <TimezoneSection
            initialTimezone={user.timezone}
            initialPreviewLine={timezonePreview}
            timezones={timezoneOptions}
            emailRecapsEnabled={emailRecapsEnabled}
          />

          <hr className="border-zinc-800" />

          <UsernameChangeSection
            currentUsername={user.displayUsername}
            githubLogin={user.githubLogin}
          />

          <hr className="border-zinc-800" />

          <IncludedReposSection
            initialIncludedCount={user.includedCount}
            totalCount={user.totalCount}
          />

          <hr className="border-zinc-800" />

          <DangerZoneSection displayUsername={user.displayUsername} />
        </div>
      </div>
    </main>
  )
}
