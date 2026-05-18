import Link from 'next/link'
import { requireUser } from '@/lib/auth/session'
import { getUserRepoSummary } from '@/lib/db/queries/users'
import { AccountInfoSection } from './_sections/account-info'
import { PublicProfileSection } from './_sections/public-profile'
import { EmailRecapSection } from './_sections/email-recap'
import { TimezoneSection } from './_sections/timezone'
import { UsernameChangeSection } from './_sections/username-change'
import { IncludedReposSection } from './_sections/included-repos'
import { DangerZoneSection } from './_sections/danger-zone'
import { getTimezoneOptions } from './_timezones'

function getNextSunday(): string {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek
  const next = new Date(now)
  next.setUTCDate(now.getUTCDate() + daysUntilSunday)
  return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function getTimezonePreviewLine(tz: string): string {
  try {
    const sunday = new Date()
    sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7 || 7))
    sunday.setHours(18, 0, 0, 0)
    const time = sunday.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz,
    })
    return `Your weekly recap arrives Sunday at ${time} in this timezone.`
  } catch {
    return 'Your weekly recap arrives Sunday in this timezone.'
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://devastra.app'

export default async function SettingsPage() {
  const user = await requireUser()
  const repoSummary = await getUserRepoSummary(user.id)

  const nextRecapDate = getNextSunday()
  const timezonePreview = getTimezonePreviewLine(user.timezone)
  const timezoneOptions = getTimezoneOptions(user.timezone)

  return (
    <main className="min-h-screen bg-[#0b1020] px-4 py-10">
      <div className="mx-auto max-w-[800px]">
        {/* Header */}
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-zinc-400 transition-colors hover:text-zinc-200">
              ← Back
            </Link>
            <h1 className="text-lg font-semibold text-white">Settings</h1>
          </div>
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.displayUsername} className="h-8 w-8 rounded-full" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs text-zinc-200">
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

          <EmailRecapSection
            initialEnabled={user.emailRecapEnabled}
            nextRecapDate={nextRecapDate}
          />

          <hr className="border-zinc-800" />

          <TimezoneSection
            initialTimezone={user.timezone}
            initialPreviewLine={timezonePreview}
            timezones={timezoneOptions}
          />

          <hr className="border-zinc-800" />

          <UsernameChangeSection
            currentUsername={user.displayUsername}
            githubLogin={user.githubLogin}
          />

          <hr className="border-zinc-800" />

          <IncludedReposSection
            initialIncludedCount={repoSummary.includedCount}
            totalCount={repoSummary.totalCount}
          />

          <hr className="border-zinc-800" />

          <DangerZoneSection displayUsername={user.displayUsername} />
        </div>
      </div>
    </main>
  )
}
