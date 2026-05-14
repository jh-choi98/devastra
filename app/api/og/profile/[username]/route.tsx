import { createClient } from '@supabase/supabase-js'
import { renderProfileImage, renderPrivatePlaceholder } from '@/lib/og/ProfileImage'
import type { TerritoryType } from '@/features/territories/registry'

export const runtime = 'edge'

export async function GET(
  _req: Request,
  { params }: { params: { username: string } },
) {
  const { username } = params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Query users_public_view — already filters is_public = true
  const { data: publicUser, error } = await supabase
    .from('users_public_view')
    .select('id, display_username, avatar_url')
    .eq('display_username', username)
    .maybeSingle()

  if (error || !publicUser) {
    return renderPrivatePlaceholder()
  }

  const [{ data: territoriesData }, { data: landmarksData }] = await Promise.all([
    supabase
      .from('territories')
      .select('type, stage, total_weight, growth_30d, stage_changed_at')
      .eq('user_id', publicUser.id),
    supabase
      .from('landmarks')
      .select('tech_key, territory_type, weight, first_unlocked_at')
      .eq('user_id', publicUser.id),
  ])

  const map = {
    territories: (territoriesData ?? []).map((t: Record<string, unknown>) => ({
      type: String(t['type']) as TerritoryType,
      stage: Number(t['stage']),
      totalWeight: Number(t['total_weight']),
      growth30d: Number(t['growth_30d']),
      stageChangedAt: t['stage_changed_at'] ? String(t['stage_changed_at']) : null,
    })),
    landmarks: (landmarksData ?? []).map((l: Record<string, unknown>) => ({
      tech_key: String(l['tech_key']),
      territory: String(l['territory_type']) as TerritoryType,
      weight: Number(l['weight']),
      firstUnlockedAt: l['first_unlocked_at'] ? String(l['first_unlocked_at']) : null,
    })),
  }

  return renderProfileImage({
    displayUsername: publicUser.display_username,
    avatarUrl: publicUser.avatar_url,
    map,
  })
}
