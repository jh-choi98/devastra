import { createClient } from '@supabase/supabase-js'
import { renderRecapImage, renderPrivatePlaceholder, buildStatStripText } from '@/lib/og/RecapImage'
import type { RecapHighlights } from '@/lib/og/RecapImage'
import type { TerritoryType } from '@/features/territories/registry'

export const runtime = 'edge'

export async function GET(
  _req: Request,
  { params }: { params: { recap_id: string } },
) {
  const { recap_id } = params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: recap, error } = await supabase
    .from('weekly_recaps')
    .select('id, user_id, week_start, highlights')
    .eq('id', recap_id)
    .maybeSingle()

  if (error || !recap) {
    return renderPrivatePlaceholder()
  }

  const { data: user } = await supabase
    .from('users_public_view')
    .select('id, display_username, avatar_url')
    .eq('id', recap.user_id)
    .maybeSingle()

  if (!user) {
    return renderPrivatePlaceholder()
  }

  // Fetch current territories + landmarks for the constellation render
  const [{ data: territoriesData }, { data: landmarksData }] = await Promise.all([
    supabase
      .from('territories')
      .select('type, stage, total_weight, growth_30d, stage_changed_at')
      .eq('user_id', recap.user_id),
    supabase
      .from('landmarks')
      .select('tech_key, territory_type, weight, first_unlocked_at')
      .eq('user_id', recap.user_id),
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

  const highlights = recap.highlights as RecapHighlights
  const statStripText = buildStatStripText(highlights)

  const imageResponse = renderRecapImage({
    map,
    weekStart: new Date(recap.week_start),
    statStripText,
  })

  // Recap IDs are immutable — cache indefinitely
  return new Response(imageResponse.body, {
    status: imageResponse.status,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
