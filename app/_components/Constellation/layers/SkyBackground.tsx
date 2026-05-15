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
        // Near-black vertical gradient — zenith #020207 to edge #050307
        float t = gl_FragCoord.y / 900.0;
        vec3 zenith = vec3(0.008, 0.008, 0.027);
        vec3 edge   = vec3(0.020, 0.012, 0.027);
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
