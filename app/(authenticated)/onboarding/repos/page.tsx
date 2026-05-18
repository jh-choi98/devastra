import { requireUser } from '@/lib/auth/session'
import { fetchReposViaGitHub } from '@/lib/github/onboarding-fetch'
import { RepoSelector } from './_repo-selector'

export default async function OnboardingReposPage() {
  const user = await requireUser()
  const repos = await fetchReposViaGitHub(user.id)
  return <RepoSelector repos={repos} userId={user.id} />
}
