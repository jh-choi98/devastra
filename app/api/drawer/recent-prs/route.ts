import 'server-only'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { getUsableAccessToken } from '@/lib/github/token'
import { fetchRecentPRsForUserInCluster } from '@/lib/github/graphql'
import { getRepoHandlesForTerritory } from '@/lib/db/queries/drawer'

export async function GET(req: Request) {
  const user = await requireUser()
  const { searchParams } = new URL(req.url)
  const cluster = searchParams.get('cluster')

  if (!cluster) return NextResponse.json({ prs: [] })

  try {
    const repos = await getRepoHandlesForTerritory(user.id, cluster)
    if (repos.length === 0) return NextResponse.json({ prs: [] })

    const token = await getUsableAccessToken(user.id)
    const prs = await fetchRecentPRsForUserInCluster({
      token,
      githubLogin: user.githubLogin,
      repos,
      limit: 3,
    })
    return NextResponse.json({ prs })
  } catch {
    // Graceful degradation: drawer shows "Could not load recent PRs."
    return NextResponse.json({ prs: [] }, { status: 200 })
  }
}
