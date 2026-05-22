'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/app/_components/Constellation/SparkAnimation'

export function PublicStickyBar({
  inviterUsername,
  pulse,
}: {
  inviterUsername: string
  pulse: boolean
}): JSX.Element {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 z-50 bg-indigo-700/90 backdrop-blur-sm border-t border-indigo-600 py-3 px-4"
      animate={pulse && !reducedMotion ? { scale: [1, 1.02, 1], opacity: [1, 0.95, 1] } : {}}
      transition={pulse && !reducedMotion ? { duration: 1, ease: 'easeInOut' } : {}}
    >
      <div className="max-w-xl mx-auto flex items-center justify-center">
        <Link
          href={`/?from=profile&inviter=${encodeURIComponent(inviterUsername)}`}
          data-testid="sticky-cta"
          className="px-6 py-2 bg-white text-indigo-700 rounded-full font-semibold text-sm hover:bg-indigo-50 transition-colors"
        >
          Start yours for free →
        </Link>
      </div>
    </motion.div>
  )
}
