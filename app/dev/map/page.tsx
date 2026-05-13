import { notFound } from 'next/navigation'
import { LivingMap } from '@/app/_components/Map/LivingMap'
import type { MapData } from '@/app/_components/Map/LivingMap'

export const dynamic = 'force-static'

const MOCK_DATA: MapData = {
  userId: 'dev-user',
  territories: [
    {
      type: 'frontend_land',
      stage: 4,
      totalWeight: 820,
      growth30d: 120,
      stageChangedAt: '2026-05-10T00:00:00Z',
    },
    {
      type: 'backend_fortress',
      stage: 3,
      totalWeight: 350,
      growth30d: 60,
      stageChangedAt: null,
    },
    {
      type: 'data_pipeline_zone',
      stage: 2,
      totalWeight: 90,
      growth30d: 0,
      stageChangedAt: null,
    },
    {
      type: 'testing_lab',
      stage: 2,
      totalWeight: 75,
      growth30d: 20,
      stageChangedAt: null,
    },
    {
      type: 'devops_harbor',
      stage: 3,
      totalWeight: 310,
      growth30d: 45,
      stageChangedAt: '2026-05-08T00:00:00Z',
    },
    {
      type: 'docs_library',
      stage: 1,
      totalWeight: 15,
      growth30d: 5,
      stageChangedAt: null,
    },
  ],
  landmarks: [
    { tech_key: 'typescript', territory: 'frontend_land', weight: 120, firstUnlockedAt: '2026-01-01T00:00:00Z' },
    { tech_key: 'react', territory: 'frontend_land', weight: 85, firstUnlockedAt: '2026-01-10T00:00:00Z' },
    { tech_key: 'nextjs', territory: 'frontend_land', weight: 70, firstUnlockedAt: '2026-01-15T00:00:00Z' },
    { tech_key: 'tailwind', territory: 'frontend_land', weight: 40, firstUnlockedAt: '2026-02-01T00:00:00Z' },
    { tech_key: 'css', territory: 'frontend_land', weight: 25, firstUnlockedAt: '2026-01-01T00:00:00Z' },
    { tech_key: 'javascript', territory: 'frontend_land', weight: 60, firstUnlockedAt: '2026-01-01T00:00:00Z' },
    { tech_key: 'vite', territory: 'frontend_land', weight: 18, firstUnlockedAt: '2026-03-01T00:00:00Z' },
    { tech_key: 'nodejs', territory: 'backend_fortress', weight: 80, firstUnlockedAt: '2026-01-05T00:00:00Z' },
    { tech_key: 'python', territory: 'backend_fortress', weight: 55, firstUnlockedAt: '2026-01-20T00:00:00Z' },
    { tech_key: 'go', territory: 'backend_fortress', weight: 30, firstUnlockedAt: '2026-03-01T00:00:00Z' },
    { tech_key: 'express', territory: 'backend_fortress', weight: 22, firstUnlockedAt: '2026-02-10T00:00:00Z' },
    { tech_key: 'postgres', territory: 'data_pipeline_zone', weight: 45, firstUnlockedAt: '2026-02-10T00:00:00Z' },
    { tech_key: 'redis', territory: 'data_pipeline_zone', weight: 15, firstUnlockedAt: '2026-03-15T00:00:00Z' },
    { tech_key: 'vitest', territory: 'testing_lab', weight: 35, firstUnlockedAt: '2026-02-05T00:00:00Z' },
    { tech_key: 'playwright', territory: 'testing_lab', weight: 20, firstUnlockedAt: '2026-02-20T00:00:00Z' },
    { tech_key: 'jest', territory: 'testing_lab', weight: 12, firstUnlockedAt: '2026-01-10T00:00:00Z' },
    { tech_key: 'docker', territory: 'devops_harbor', weight: 65, firstUnlockedAt: '2026-01-10T00:00:00Z' },
    { tech_key: 'ghactions', territory: 'devops_harbor', weight: 50, firstUnlockedAt: '2026-01-15T00:00:00Z' },
    { tech_key: 'vercel', territory: 'devops_harbor', weight: 25, firstUnlockedAt: '2026-02-01T00:00:00Z' },
    { tech_key: 'terraform', territory: 'devops_harbor', weight: 10, firstUnlockedAt: '2026-04-01T00:00:00Z' },
    { tech_key: 'markdown', territory: 'docs_library', weight: 10, firstUnlockedAt: '2026-01-01T00:00:00Z' },
  ],
}

export default function DevMapPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <LivingMap data={MOCK_DATA} onIslandClick={(t) => console.log('clicked', t)} />
    </div>
  )
}
