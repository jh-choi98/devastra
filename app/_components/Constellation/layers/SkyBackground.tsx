'use client'
import { useMemo } from 'react'
import * as THREE from 'three'

export function SkyBackground() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      void main() {
        // Near-black vertical gradient. Tuned darker per visual review —
        // previous values produced a perceptible blue-gray cast around the
        // canvas edges that washed out the star contrast. These approximate
        // #010104 (zenith) → #030305 (edge): essentially pure black with a
        // faint cool tint that's only visible against very bright stars.
        float t = gl_FragCoord.y / 900.0;
        // Further darkened by ~5% per visual review (cumulative ~15% from baseline).
        vec3 zenith = vec3(0.00342, 0.00342, 0.01368);
        vec3 edge   = vec3(0.00855, 0.005985, 0.01539);
        gl_FragColor = vec4(mix(edge, zenith, t), 1.0);
      }
    `,
    depthWrite: false,
    depthTest: false,
  }), [])

  return (
    <mesh material={material} renderOrder={-1000}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}
