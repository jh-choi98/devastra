import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { repositories } from '@/lib/db/schema/repositories'
import type { DbRepository } from '@/lib/db/queries/repositories'
import type { GitHubSourceClient } from './sources/github'

export async function discoverUserRepositories(
  userId: string,
  github: GitHubSourceClient,
): Promise<DbRepository[]> {
  const sourceRepos = await github.listAuthoredRepos()
  if (sourceRepos.length === 0) return []

  return db
    .insert(repositories)
    .values(
      sourceRepos.map((repo) => ({
        userId,
        source: repo.source,
        externalRepoId: repo.externalRepoId,
        owner: repo.owner,
        name: repo.name,
        primaryLanguage: repo.primaryLanguage,
        sourcePushedAt: repo.pushedAt ?? null,
        isIncluded: true,
      })),
    )
    .onConflictDoUpdate({
      target: [repositories.userId, repositories.source, repositories.externalRepoId],
      set: {
        owner: sql`excluded.owner`,
        name: sql`excluded.name`,
        primaryLanguage: sql`excluded.primary_language`,
        sourcePushedAt: sql`excluded.source_pushed_at`,
      },
    })
    .returning()
}
