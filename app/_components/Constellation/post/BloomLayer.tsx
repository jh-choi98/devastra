'use client'

import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'

export function PostStack({ isMobile }: { isMobile: boolean }) {
  return (
    <EffectComposer
      multisampling={0}
      resolutionScale={isMobile ? 0.5 : 1.0}
    >
      <Bloom
        intensity={0.5}
        luminanceThreshold={0.75}
        luminanceSmoothing={0.9}
        radius={1.0}
        mipmapBlur
      />
      <Vignette eskil={false} offset={0.5} darkness={0.5} />
    </EffectComposer>
  )
}
