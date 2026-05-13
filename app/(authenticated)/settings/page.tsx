import { requireUser } from '@/lib/auth/session'
import { getUserSettings, listUserRepos } from '@/lib/db/queries/users'
import { PublicToggleSection } from './_sections/public-toggle'
import { EmailRecapSection } from './_sections/email-recap'
import { TimezoneSection } from './_sections/timezone'
import { UsernameSection } from './_sections/username'
import { IncludedReposSection } from './_sections/included-repos'
import { DisconnectSection } from './_sections/disconnect'
import { DeleteAccountSection } from './_sections/delete-account'

export default async function SettingsPage() {
  const user = await requireUser()
  const settings = await getUserSettings(user.id)
  const repos = await listUserRepos(user.id)

  return (
    <main className="min-h-screen bg-zinc-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>
        <PublicToggleSection initial={settings.isPublic} username={settings.displayUsername} />
        <EmailRecapSection initial={settings.emailRecapEnabled} />
        <TimezoneSection initial={settings.timezone} />
        <UsernameSection initial={settings.displayUsername} githubLogin={settings.githubLogin} />
        <IncludedReposSection repos={repos} />
        <DisconnectSection />
        <DeleteAccountSection />
      </div>
    </main>
  )
}
