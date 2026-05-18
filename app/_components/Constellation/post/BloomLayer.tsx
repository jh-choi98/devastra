'use client'

import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'

export function PostStack({ isMobile, enabled = true }: { isMobile: boolean; enabled?: boolean }) {
  if (!enabled) return null

  return (
    <EffectComposer
      multisampling={0}
      resolutionScale={isMobile ? 0.22 : 0.25}
    >
      <Bloom
        intensity={0.35}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.85}
        radius={0.75}
        mipmapBlur={false}
      />
      <Vignette eskil={false} offset={0.25} darkness={0.85} />
    </EffectComposer>
  )
}
