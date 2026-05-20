'use client'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mstEdges } from '@/features/constellation/render/mst'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import { resolveStarViewBoxPosition } from '@/app/_components/Constellation/star-positions'
import { useConstellationState } from '../state'
import type { TerritoryType } from '@/features/territories/registry'
import type { WorldCoord } from '@/features/constellation/render/types'
import type { ConstellationData } from '../types'

interface ConnectionsProps {
  data: ConstellationData
  viewport?: 'desktop' | 'mobile' | 'og'
}

type ConnectionSegment = {
  key: string
  a: THREE.Vector3
  b: THREE.Vector3
  strength: number
}

const REVEAL_DURATION_SECONDS = 1.1
const REVEAL_STAGGER_SECONDS = 0.06
const CONNECTION_HALF_WIDTH: Record<'desktop' | 'mobile' | 'og', number> = {
  desktop: 0.0054,
  mobile: 0.0089,
  og: 0.006,
}

const CONNECTION_VERT = /* glsl */ `
  attribute float aSide;
  attribute float aAlong;
  attribute float aStrength;
  varying float vSide;
  varying float vAlong;
  varying float vStrength;

  void main() {
    vSide = aSide;
    vAlong = aAlong;
    vStrength = aStrength;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const CONNECTION_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vSide;
  varying float vAlong;
  varying float vStrength;

  void main() {
    float side = abs(vSide);
    float center = 1.0 - smoothstep(0.0, 0.24, side);
    float core = 1.0 - smoothstep(0.12, 0.58, side);
    float glow = 1.0 - smoothstep(0.18, 1.0, side);
    glow *= glow;
    float startFade = smoothstep(0.0, 0.035, vAlong);
    float endFade = 1.0 - smoothstep(0.965, 1.0, vAlong);
    float endpoint = mix(0.78, 1.0, startFade * endFade);
    float alpha = (center * 0.238 + core * 0.4 + glow * 0.141) * endpoint * vStrength * 1.1;
    vec3 color = mix(uColor, vec3(0.88, 0.95, 1.0), center * 0.335 + core * 0.12);
    gl_FragColor = vec4(color, alpha);
  }
`

function easeOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return 1 - Math.pow(1 - clamped, 3)
}

function edgeStrength(aWeight: number, bWeight: number): number {
  const averageWeight = Math.sqrt(Math.max(5, aWeight) * Math.max(5, bWeight))
  const t = Math.max(0, Math.min(1, Math.log(averageWeight / 5) / Math.log(100)))
  return 0.86 + t * 0.24
}

function computeMstSegments(
  territory: TerritoryType,
  landmarks: Array<{ tech_key: string; weight: number }>,
  viewport: 'desktop' | 'mobile' | 'og',
): ConnectionSegment[] {
  if (landmarks.length < 2) return []

  const points = landmarks.map((landmark) => {
    const vb = resolveStarViewBoxPosition(landmark.tech_key, territory, viewport)
    return {
      techKey: landmark.tech_key,
      weight: landmark.weight,
      vb,
    }
  })
  const pointByCoord = new Map<WorldCoord, (typeof points)[number]>()
  points.forEach((point) => pointByCoord.set(point.vb, point))

  return mstEdges(points.map((point) => point.vb)).map((edge) => {
    const leftPoint = pointByCoord.get(edge.a)
    const rightPoint = pointByCoord.get(edge.b)
    if (!leftPoint || !rightPoint) {
      const a = viewBoxToWorld(edge.a)
      const b = viewBoxToWorld(edge.b)
      return {
        key: `${territory}:${edge.a.x},${edge.a.y}:${edge.b.x},${edge.b.y}`,
        a: new THREE.Vector3(a.x, a.y, a.z),
        b: new THREE.Vector3(b.x, b.y, b.z),
        strength: 0.88,
      }
    }

    const [left, right] = [leftPoint.techKey, rightPoint.techKey].sort()
    const a = viewBoxToWorld(leftPoint.vb)
    const b = viewBoxToWorld(rightPoint.vb)
    return {
      key: `${territory}:${left}:${right}`,
      a: new THREE.Vector3(a.x, a.y, a.z),
      b: new THREE.Vector3(b.x, b.y, b.z),
      strength: edgeStrength(leftPoint.weight, rightPoint.weight),
    }
  })
}

function writeSegmentQuadWithReveal(
  target: Float32Array,
  segment: ConnectionSegment,
  index: number,
  width: number,
  reveal: number,
) {
  const ax = segment.a.x
  const ay = segment.a.y
  const az = segment.a.z - 0.01
  const bx = segment.a.x + (segment.b.x - segment.a.x) * reveal
  const by = segment.a.y + (segment.b.y - segment.a.y) * reveal
  const bz = segment.a.z + (segment.b.z - segment.a.z) * reveal - 0.01
  const dx = bx - ax
  const dy = by - ay
  const length = Math.hypot(dx, dy)
  const nx = length > 0.000001 ? -dy / length : 0
  const ny = length > 0.000001 ? dx / length : 1
  const ox = nx * width
  const oy = ny * width

  const base = index * 18
  // Triangle 1: start-left, start-right, end-left
  target[base + 0] = ax - ox
  target[base + 1] = ay - oy
  target[base + 2] = az
  target[base + 3] = ax + ox
  target[base + 4] = ay + oy
  target[base + 5] = az
  target[base + 6] = bx - ox
  target[base + 7] = by - oy
  target[base + 8] = bz
  // Triangle 2: end-left, start-right, end-right
  target[base + 9] = bx - ox
  target[base + 10] = by - oy
  target[base + 11] = bz
  target[base + 12] = ax + ox
  target[base + 13] = ay + oy
  target[base + 14] = az
  target[base + 15] = bx + ox
  target[base + 16] = by + oy
  target[base + 17] = bz
}

export function Connections({ data, viewport = 'desktop' }: ConnectionsProps) {
  const { reducedMotion } = useConstellationState()
  const initializedRef = useRef(false)
  const revealByEdgeKey = useRef(new Map<string, number>())
  const geomRef = useRef<THREE.BufferGeometry | null>(null)

  const segments = useMemo(() => {
    const lit = data.landmarks.filter((l) => l.firstUnlockedAt !== null && l.weight >= 5)
    const byCluster = new Map<TerritoryType, typeof lit>()
    for (const lm of lit) {
      const bucket = byCluster.get(lm.territory) ?? []
      bucket.push(lm)
      byCluster.set(lm.territory, bucket)
    }

    const nextSegments: ConnectionSegment[] = []
    for (const [territory, landmarks] of Array.from(byCluster)) {
      nextSegments.push(...computeMstSegments(territory, landmarks, viewport))
    }

    nextSegments.forEach((segment, index) => {
      if (!revealByEdgeKey.current.has(segment.key)) {
        revealByEdgeKey.current.set(
          segment.key,
          initializedRef.current && !reducedMotion ? -index * REVEAL_STAGGER_SECONDS : 1,
        )
      }
    })

    return nextSegments
  }, [data.landmarks, reducedMotion, viewport])

  useEffect(() => {
    initializedRef.current = true
    const currentKeys = new Set(segments.map((segment) => segment.key))
    for (const key of Array.from(revealByEdgeKey.current.keys())) {
      if (!currentKeys.has(key)) revealByEdgeKey.current.delete(key)
    }
  }, [segments])

  const geom = useMemo(() => {
    const positions = new Float32Array(segments.length * 18)
    const sides = new Float32Array(segments.length * 6)
    const along = new Float32Array(segments.length * 6)
    const strengths = new Float32Array(segments.length * 6)
    segments.forEach((segment, i) => {
      const reveal = easeOutCubic(revealByEdgeKey.current.get(segment.key) ?? 1)
      writeSegmentQuadWithReveal(positions, segment, i, CONNECTION_HALF_WIDTH[viewport], reveal)
      sides.set([-1, 1, -1, -1, 1, 1], i * 6)
      along.set([0, 0, 1, 1, 0, 1], i * 6)
      strengths.fill(segment.strength, i * 6, i * 6 + 6)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aSide', new THREE.BufferAttribute(sides, 1))
    g.setAttribute('aAlong', new THREE.BufferAttribute(along, 1))
    g.setAttribute('aStrength', new THREE.BufferAttribute(strengths, 1))
    geomRef.current = g
    return g
  }, [segments, viewport])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color('#9fb8d6') },
        },
        vertexShader: CONNECTION_VERT,
        fragmentShader: CONNECTION_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  )

  useFrame((_, delta) => {
    if (reducedMotion) return
    let changed = false
    for (const [key, age] of Array.from(revealByEdgeKey.current.entries())) {
      if (age >= 1) continue
      revealByEdgeKey.current.set(key, Math.min(1, age + delta / REVEAL_DURATION_SECONDS))
      changed = true
    }
    if (!changed || !geomRef.current) return

    const position = geomRef.current.getAttribute('position') as THREE.BufferAttribute
    const arr = position.array as Float32Array
    segments.forEach((segment, index) => {
      const reveal = easeOutCubic(revealByEdgeKey.current.get(segment.key) ?? 1)
      writeSegmentQuadWithReveal(arr, segment, index, CONNECTION_HALF_WIDTH[viewport], reveal)
    })
    position.needsUpdate = true
  })

  return (
    <mesh geometry={geom} material={material} renderOrder={5} frustumCulled={false} />
  )
}
