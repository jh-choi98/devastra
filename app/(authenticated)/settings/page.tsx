import Link from 'next/link'
import { requireUser } from '@/lib/auth/session'
import { listUserRepos } from '@/lib/db/queries/users'
import { AccountInfoSection } from './_sections/account-info'
import { PublicProfileSection } from './_sections/public-profile'
import { EmailRecapSection } from './_sections/email-recap'
import { TimezoneSection } from './_sections/timezone'
import { UsernameChangeSection } from './_sections/username-change'
import { IncludedReposSection } from './_sections/included-repos'
import { DangerZoneSection } from './_sections/danger-zone'

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
  const repos = await listUserRepos(user.id)

  const nextRecapDate = getNextSunday()
  const timezonePreview = getTimezonePreviewLine(user.timezone)

  return (
    <main className="min-h-screen bg-[#0b1020] py-10 px-4">
      <div className="max-w-[800px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              ← Back
            </Link>
            <h1 className="text-lg font-semibold text-white">Settings</h1>
          </div>
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.displayUsername}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-200">
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
          />

          <hr className="border-zinc-800" />

          <UsernameChangeSection
            currentUsername={user.displayUsername}
            githubLogin={user.githubLogin}
          />

          <hr className="border-zinc-800" />

          <IncludedReposSection repos={repos} />

          <hr className="border-zinc-800" />

          <DangerZoneSection displayUsername={user.displayUsername} />
        </div>
      </div>
    </main>
  )
}
