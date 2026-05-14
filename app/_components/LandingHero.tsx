'use client'

import { useEffect, useRef } from 'react'
import { Constellation } from '@/app/_components/Constellation/Constellation'
import type { ConstellationData } from '@/app/_components/Constellation/Constellation'
import { SignInButton } from './SignInButton'

const REVEAL_LOCAL_KEY = 'landing_reveal_last_at'
const REVEAL_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export type LandingHeroProps = {
  demoData?: {
    territories: ConstellationData['territories']
    landmarks: ConstellationData['landmarks']
  } | null
}

const EMPTY_DEMO: ConstellationData = {
  userId: 'landing-demo',
  territories: [],
  landmarks: [],
}

export function LandingHero({ demoData }: LandingHeroProps): JSX.Element {
  const hasUpdatedReveal = useRef(false)

  useEffect(() => {
    if (hasUpdatedReveal.current) return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    const last = localStorage.getItem(REVEAL_LOCAL_KEY)
    const ts = last ? Number(last) : 0
    if (Date.now() - ts > REVEAL_INTERVAL_MS) {
      localStorage.setItem(REVEAL_LOCAL_KEY, String(Date.now()))
      hasUpdatedReveal.current = true
    }
  }, [])

  const constellationData: ConstellationData = demoData
    ? { userId: 'landing-demo', ...demoData }
    : EMPTY_DEMO

  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px 0',
        background: '#0b1020',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 680, marginBottom: 40 }}>
        <h1
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: '#f1f5f9',
            lineHeight: 1.2,
            margin: 0,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          A developer skill constellation that lights up as you code.
        </h1>
        <p
          style={{
            fontSize: 18,
            color: '#94a3b8',
            marginTop: 16,
            marginBottom: 32,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Connect GitHub. See what you&apos;ve built, brighter every week.
        </p>
        <SignInButton />
      </div>

      {/* Constellation preview — 60% viewport height */}
      <div
        style={{
          width: '100%',
          maxWidth: 900,
          height: '60vh',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, #0b1020 0%, transparent 30%)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        />
        <Constellation data={constellationData} />
      </div>
    </section>
  )
}
