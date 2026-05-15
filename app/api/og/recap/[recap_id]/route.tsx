import { createClient } from '@supabase/supabase-js'
import { renderRecapImage, renderPrivatePlaceholder, buildStatStripText } from '@/lib/og/RecapImage'
import type { RecapHighlights } from '@/lib/og/RecapImage'
import type { TerritoryType } from '@/features/territories/registry'

export const runtime = 'edge'

const MOCK_MAP = {
  territories: [
    { type: 'backend_fortress' as TerritoryType, stage: 4, totalWeight: 620, growth30d: 22, stageChangedAt: '2024-04-01T00:00:00Z' },
    { type: 'frontend_land' as TerritoryType, stage: 3, totalWeight: 320, growth30d: 14, stageChangedAt: null },
    { type: 'data_pipeline_zone' as TerritoryType, stage: 2, totalWeight: 110, growth30d: 8, stageChangedAt: null },
    { type: 'devops_harbor' as TerritoryType, stage: 2, totalWeight: 80, growth30d: 5, stageChangedAt: null },
    { type: 'testing_lab' as TerritoryType, stage: 1, totalWeight: 30, growth30d: 2, stageChangedAt: null },
    { type: 'docs_library' as TerritoryType, stage: 1, totalWeight: 10, growth30d: 0, stageChangedAt: null },
  ],
  landmarks: [
    { tech_key: 'nodejs', territory: 'backend_fortress' as TerritoryType, weight: 240, firstUnlockedAt: '2024-01-01T00:00:00Z' },
    { tech_key: 'python', territory: 'backend_fortress' as TerritoryType, weight: 160, firstUnlockedAt: '2024-01-01T00:00:00Z' },
    { tech_key: 'go', territory: 'backend_fortress' as TerritoryType, weight: 110, firstUnlockedAt: '2024-02-01T00:00:00Z' },
    { tech_key: 'typescript', territory: 'frontend_land' as TerritoryType, weight: 180, firstUnlockedAt: '2024-01-01T00:00:00Z' },
    { tech_key: 'react', territory: 'frontend_land' as TerritoryType, weight: 95, firstUnlockedAt: '2024-01-01T00:00:00Z' },
    { tech_key: 'postgres', territory: 'data_pipeline_zone' as TerritoryType, weight: 75, firstUnlockedAt: '2024-01-15T00:00:00Z' },
    { tech_key: 'docker', territory: 'devops_harbor' as TerritoryType, weight: 50, firstUnlockedAt: '2024-01-01T00:00:00Z' },
    { tech_key: 'jest', territory: 'testing_lab' as TerritoryType, weight: 22, firstUnlockedAt: '2024-03-01T00:00:00Z' },
    { tech_key: 'fastapi', territory: 'backend_fortress' as TerritoryType, weight: 55, firstUnlockedAt: '2024-04-01T00:00:00Z' },
    { tech_key: 'rust', territory: 'backend_fortress' as TerritoryType, weight: 18, firstUnlockedAt: '2024-04-10T00:00:00Z' },
  ],
}

const MOCK_HIGHLIGHTS: RecapHighlights = {
  top_growth: { territory: 'backend_fortress', pct: 22 },
  new_landmarks: ['fastapi', 'rust'],
  stage_ups: [{ territory: 'backend_fortress', from: 3, to: 4 }],
  stats: { active_days: 5, prs_shipped: 12 },
  slot_1: { kind: 'stage_up', territory: 'backend_fortress' },
  slot_2: { kind: 'new_landmarks', tech_keys: ['fastapi', 'rust'] },
}

export async function GET(
  req: Request,
  { params }: { params: { recap_id: string } },
) {
  const { recap_id } = params
  const url = new URL(req.url)

  const baseUrl = url.origin

  if (url.searchParams.get('test') === '1' && process.env.NODE_ENV !== 'production') {
    const statStripText = buildStatStripText(MOCK_HIGHLIGHTS)
    const stageUpTerritories = MOCK_HIGHLIGHTS.stage_ups.map((s) => s.territory as TerritoryType)
    return new Response(
      renderRecapImage({
        map: MOCK_MAP,
        weekStart: new Date('2024-04-08T00:00:00Z'),
        statStripText,
        stageUpTerritories,
        baseUrl,
      }).body,
      {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store',
        },
      },
    )
  }

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
  const stageUpTerritories = (highlights.stage_ups ?? []).map((s) => s.territory as TerritoryType)

  const imageResponse = renderRecapImage({
    map,
    weekStart: new Date(recap.week_start),
    statStripText,
    stageUpTerritories,
    baseUrl,
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
