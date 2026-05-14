import type { MetadataRoute } from 'next'
import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'

export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://devastra.app'

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  const publicUsers = await db.execute<{ display_username: string; updated_at: string }>(
    sql`SELECT display_username, GREATEST(created_at, last_incremental_sync_at, last_login_at) as updated_at
        FROM public.users
        WHERE is_public = true
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 10000`,
  )

  const rows = Array.isArray(publicUsers) ? publicUsers : (publicUsers as { rows: Array<{ display_username: string; updated_at: string }> }).rows ?? []

  const userEntries: MetadataRoute.Sitemap = rows.map((u) => ({
    url: `${base}/${u.display_username}`,
    lastModified: u.updated_at ? new Date(u.updated_at) : undefined,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticEntries, ...userEntries]
}
