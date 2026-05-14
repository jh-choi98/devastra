'use client'

import Link from 'next/link'

export function PublicStickyBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-indigo-700/90 backdrop-blur-sm border-t border-indigo-600 py-3 px-4">
      <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
        <span className="text-white text-sm">Build your own developer world map</span>
        <Link
          href="/"
          className="px-4 py-1.5 bg-white text-indigo-700 rounded-full font-semibold text-sm hover:bg-indigo-50 transition-colors shrink-0"
        >
          Get your own DevAstra →
        </Link>
      </div>
    </div>
  )
}
