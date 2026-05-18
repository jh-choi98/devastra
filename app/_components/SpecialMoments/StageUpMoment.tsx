'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotion } from '@/app/_components/Constellation/SparkAnimation'

export function StageUpMoment(props: {
  events: Array<{
    cluster_name: string
    cluster_color: string
    cluster_center: { cx: number; cy: number; radius: number }
    from_stage: number
    to_stage: number
  }>
}): JSX.Element {
  const prefersReducedMotion = useReducedMotion()
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (props.events.length === 0) return

    // For each event (0.3s stagger between events per ADR-37):
    //   - Cluster aura radius expands 10–20% over 0.6s.
    //   - Aura intensity: opacity 0.05 → 0.20 over 0.6s.
    //   - One ripple wave: r from radius*0.5 to radius*1.2 over 1.5s, opacity 0.4 → 0.
    // Reduced-motion: snap to final aura state in 0.1s; skip ripple.

    if (prefersReducedMotion) return

    // Animation is applied on the SVG overlay positioned over the constellation.
    // The parent passes viewport-mode-derived centers used by Constellation.
  }, [props.events, prefersReducedMotion])

  if (props.events.length === 0) return null as unknown as JSX.Element

  const STAGGER_MS = 300

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1000 700"
    >
      {props.events.map((evt, i) => {
        const { cx, cy, radius } = evt.cluster_center
        const expandedRadius = radius * 1.18
        const delay = i * STAGGER_MS

        return (
          <g key={`${evt.cluster_name}-${i}`}>
            {/* Expanded aura */}
            <circle
              cx={cx}
              cy={cy}
              r={prefersReducedMotion ? expandedRadius : radius}
              fill="none"
              stroke={evt.cluster_color}
              strokeOpacity={prefersReducedMotion ? 0.2 : 0.05}
              strokeWidth={2}
              style={
                prefersReducedMotion
                  ? undefined
                  : {
                      animation: `aura-expand 0.6s ease-out ${delay}ms forwards`,
                    }
              }
            />
            {/* Ripple wave — skip on reduced motion */}
            {!prefersReducedMotion && (
              <circle
                cx={cx}
                cy={cy}
                r={radius * 0.5}
                fill="none"
                stroke={evt.cluster_color}
                strokeOpacity={0.4}
                strokeWidth={1.5}
                style={{
                  animation: `ripple-out 1.5s ease-out ${delay}ms forwards`,
                }}
              />
            )}
          </g>
        )
      })}
      <style>{`
        @keyframes aura-expand {
          from { r: ${props.events[0]?.cluster_center.radius ?? 0}; stroke-opacity: 0.05; }
          to   { r: ${(props.events[0]?.cluster_center.radius ?? 0) * 1.18}; stroke-opacity: 0.2; }
        }
        @keyframes ripple-out {
          from { r: ${(props.events[0]?.cluster_center.radius ?? 0) * 0.5}; stroke-opacity: 0.4; }
          to   { r: ${(props.events[0]?.cluster_center.radius ?? 0) * 1.2}; stroke-opacity: 0; }
        }
      `}</style>
    </svg>
  )
}
