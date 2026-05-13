'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { LivingMap } from '@/app/_components/Map/LivingMap'
import type { MapData } from '@/app/_components/Map/LivingMap'
import { ALL_TERRITORY_TYPES } from '@/features/territories/registry'

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0x100000000
  }
}

function generateMockData(seed: number): MapData {
  const rand = seededRandom(seed)
  const territories = ALL_TERRITORY_TYPES.map((type) => {
    const totalWeight = Math.floor(rand() * 800 + 50)
    const stage = totalWeight >= 1500 ? 5 : totalWeight >= 500 ? 4 : totalWeight >= 200 ? 3 : totalWeight >= 50 ? 2 : 1
    return {
      type,
      stage,
      totalWeight,
      growth30d: Math.floor(rand() * 120),
      stageChangedAt: null,
    }
  })

  const landmarks = ALL_TERRITORY_TYPES.flatMap((type) =>
    Array.from({ length: Math.floor(rand() * 4) + 1 }, (_, i) => ({
      tech_key: `tech_${type}_${i}`,
      territory: type,
      weight: Math.floor(rand() * 40 + 5),
      firstUnlockedAt: null,
    })),
  )

  return {
    userId: 'demo',
    territories,
    landmarks,
  }
}

export function LandingDemo() {
  // Seed changes per page load but is stable within the load
  const seed = useMemo(() => Math.floor(Math.random() * 100000), [])
  const data = useMemo(() => generateMockData(seed), [seed])

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none" />
      <motion.div
        className="w-full h-full"
        animate={{ scale: [1, 1.01, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <LivingMap data={data} />
      </motion.div>
    </div>
  )
}
