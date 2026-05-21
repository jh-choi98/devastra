import { createClient } from '@supabase/supabase-js'
import { renderProfileImage, renderPrivatePlaceholder } from '@/lib/og/ProfileImage'
import type { TerritoryType } from '@/features/territories/registry'

export const runtime = 'edge'

function imageScaleFromRequest(url: URL): 1 | 2 {
  return url.searchParams.get('scale') === '2' ? 2 : 1
}

const MOCK_MAP = {
  territories: [
    {
      type: 'frontend_land' as TerritoryType,
      stage: 3,
      totalWeight: 320,
      growth30d: 14,
      stageChangedAt: null,
    },
    {
      type: 'backend_fortress' as TerritoryType,
      stage: 4,
      totalWeight: 620,
      growth30d: 22,
      stageChangedAt: null,
    },
    {
      type: 'data_pipeline_zone' as TerritoryType,
      stage: 2,
      totalWeight: 110,
      growth30d: 8,
      stageChangedAt: null,
    },
    {
      type: 'devops_harbor' as TerritoryType,
      stage: 2,
      totalWeight: 80,
      growth30d: 5,
      stageChangedAt: null,
    },
    {
      type: 'testing_lab' as TerritoryType,
      stage: 1,
      totalWeight: 30,
      growth30d: 2,
      stageChangedAt: null,
    },
    {
      type: 'docs_library' as TerritoryType,
      stage: 1,
      totalWeight: 10,
      growth30d: 0,
      stageChangedAt: null,
    },
  ],
  landmarks: [
    {
      tech_key: 'typescript',
      territory: 'frontend_land' as TerritoryType,
      weight: 180,
      firstUnlockedAt: '2024-01-01T00:00:00Z',
    },
    {
      tech_key: 'react',
      territory: 'frontend_land' as TerritoryType,
      weight: 95,
      firstUnlockedAt: '2024-01-01T00:00:00Z',
    },
    {
      tech_key: 'nextjs',
      territory: 'frontend_land' as TerritoryType,
      weight: 40,
      firstUnlockedAt: '2024-02-01T00:00:00Z',
    },
    {
      tech_key: 'tailwind',
      territory: 'frontend_land' as TerritoryType,
      weight: 20,
      firstUnlockedAt: '2024-03-01T00:00:00Z',
    },
    {
      tech_key: 'nodejs',
      territory: 'backend_fortress' as TerritoryType,
      weight: 240,
      firstUnlockedAt: '2024-01-01T00:00:00Z',
    },
    {
      tech_key: 'python',
      territory: 'backend_fortress' as TerritoryType,
      weight: 160,
      firstUnlockedAt: '2024-01-01T00:00:00Z',
    },
    {
      tech_key: 'go',
      territory: 'backend_fortress' as TerritoryType,
      weight: 110,
      firstUnlockedAt: '2024-02-01T00:00:00Z',
    },
    {
      tech_key: 'fastapi',
      territory: 'backend_fortress' as TerritoryType,
      weight: 55,
      firstUnlockedAt: '2024-03-01T00:00:00Z',
    },
    {
      tech_key: 'express',
      territory: 'backend_fortress' as TerritoryType,
      weight: 30,
      firstUnlockedAt: '2024-03-15T00:00:00Z',
    },
    {
      tech_key: 'postgres',
      territory: 'data_pipeline_zone' as TerritoryType,
      weight: 75,
      firstUnlockedAt: '2024-01-15T00:00:00Z',
    },
    {
      tech_key: 'redis',
      territory: 'data_pipeline_zone' as TerritoryType,
      weight: 30,
      firstUnlockedAt: '2024-02-15T00:00:00Z',
    },
    {
      tech_key: 'docker',
      territory: 'devops_harbor' as TerritoryType,
      weight: 50,
      firstUnlockedAt: '2024-01-01T00:00:00Z',
    },
    {
      tech_key: 'ghactions',
      territory: 'devops_harbor' as TerritoryType,
      weight: 25,
      firstUnlockedAt: '2024-02-01T00:00:00Z',
    },
    {
      tech_key: 'jest',
      territory: 'testing_lab' as TerritoryType,
      weight: 22,
      firstUnlockedAt: '2024-03-01T00:00:00Z',
    },
    {
      tech_key: 'markdown',
      territory: 'docs_library' as TerritoryType,
      weight: 8,
      firstUnlockedAt: '2024-04-01T00:00:00Z',
    },
  ],
}

export async function GET(req: Request, { params }: { params: { username: string } }) {
  const { username } = params
  const url = new URL(req.url)

  const baseUrl = url.origin
  const imageScale = imageScaleFromRequest(url)

  if (url.searchParams.get('test') === '1' && process.env.NODE_ENV !== 'production') {
    return renderProfileImage({
      displayUsername: username,
      avatarUrl: null,
      map: MOCK_MAP,
      baseUrl,
      imageScale,
    })
  }

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
    baseUrl,
    imageScale,
  })
}
