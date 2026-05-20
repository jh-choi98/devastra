'use client'
import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { anchorFor } from '@/features/constellation/render/anchors'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import {
  CLUSTER_LABEL_GLOW,
  CLUSTER_LABELS,
  clusterLabelFontSize,
} from '../cluster-labels'
import { techLabelOpacity } from '../label-position'
import { resolveTechLabelLayouts } from '../label-layout'
import { useConstellationState } from '../state'
import {
  DEFAULT_SEMANTIC_SCALE_PROFILE,
  type SemanticConstellationScaleProfile,
} from '../semantic-scale-profile'
import type { ConstellationData } from '../types'
import type { TerritoryType } from '@/features/territories/registry'

interface LabelsProps {
  data: ConstellationData
  viewport?: 'desktop' | 'mobile' | 'og'
  semanticProfile?: SemanticConstellationScaleProfile
  canvasSize?: { width: number | null; height: number | null }
}

export function Labels({
  data,
  viewport = 'desktop',
  semanticProfile = DEFAULT_SEMANTIC_SCALE_PROFILE,
  canvasSize,
}: LabelsProps) {
  const { hovered, hoveredTechKey } = useConstellationState()
  const labelLayouts = useMemo(
    () => resolveTechLabelLayouts({ data, viewport, semanticProfile, canvasSize }),
    [canvasSize, data, semanticProfile, viewport],
  )
  const clusterFontSize = clusterLabelFontSize(viewport)

  // Stellarium-style label styling — three-level hierarchy:
  //   cluster label = muted atlas region marker (larger, lower-contrast type)
  //   tech label    = clean star name (mid-bright)
  //   (cinematic / drawer-selected label brightening handled elsewhere)
  // Inline styles (not Tailwind) so labels render correctly inside drei's
  // <Html> portal regardless of Tailwind JIT processing.
  const clusterLabelBaseStyle: React.CSSProperties = {
    fontSize: clusterFontSize,
    lineHeight: 1.12,
    letterSpacing: 0,
    color: 'rgba(128, 145, 181, 0.62)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 600,
    userSelect: 'none',
    whiteSpace: 'nowrap',
    textShadow:
      '0 1px 3px rgba(0, 0, 0, 0.94), 0 0 10px rgba(116, 142, 192, 0.08)',
    pointerEvents: 'none',
    display: 'inline-block',
    position: 'relative',
    zIndex: 1,
  }
  const starLabelBaseStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#c3d0e5',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 400,
    userSelect: 'none',
    whiteSpace: 'nowrap',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.92)',
    pointerEvents: 'none',
    display: 'inline-block',
    transformOrigin: 'center',
  }

  return (
    <group renderOrder={20}>
      {/* Cluster labels — always rendered, one per cluster (ADR-61).
          Stellarium-style: label sits at the cluster CENTER (anchor).
          On hover the label gently grows + brightens. The glow is scoped to
          the label only; territory polygons, sky, and aura remain unchanged. */}
      {Object.entries(CLUSTER_LABELS).map(([type, label]) => {
        const territory = type as TerritoryType
        const a = anchorFor(viewport, type as TerritoryType)
        const w = viewBoxToWorld({ x: a.x, y: a.y })
        const isHovered = hovered === territory
        const glowRgb = CLUSTER_LABEL_GLOW[territory]
        const wrapperStyle: React.CSSProperties = {
          position: 'relative',
          display: 'inline-block',
          transform: isHovered ? 'scale(1.09)' : 'scale(1)',
          transformOrigin: 'center',
          transition: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)',
        }
        const glowStyle: React.CSSProperties = {
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '155%',
          height: '260%',
          minWidth: '82px',
          minHeight: '32px',
          borderRadius: '50%',
          background:
            `radial-gradient(ellipse at center, rgba(${glowRgb},0.18) 0%, rgba(${glowRgb},0.08) 42%, rgba(${glowRgb},0) 74%)`,
          filter: 'blur(12px)',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 420ms ease-out',
          pointerEvents: 'none',
          zIndex: 0,
        }
        const labelStyle: React.CSSProperties = {
          ...clusterLabelBaseStyle,
          color: isHovered ? 'rgba(198, 215, 244, 0.82)' : 'rgba(128, 145, 181, 0.62)',
          textShadow: isHovered
            ? `0 1px 3px rgba(0,0,0,0.94), 0 0 11px rgba(${glowRgb},0.16), 0 0 16px rgba(132,162,216,0.08)`
            : clusterLabelBaseStyle.textShadow,
          transition: 'color 420ms ease-out, text-shadow 420ms ease-out',
        }
        return (
          <Html
            key={type}
            position={[w.x, w.y, 0]}
            center
            zIndexRange={[10, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <div style={wrapperStyle}>
              <div style={glowStyle} aria-hidden="true" />
              <span style={labelStyle}>{label}</span>
            </div>
          </Html>
        )
      })}

      {/* Tech star labels - every lit star gets a persistent map-style label.
          Smaller stars use quieter type, while brighter stars gain a little
          size and opacity. Tech hover: scale(1.12) + lift to pure white +
          slightly stronger text-shadow. Faster (180ms) than cluster hover,
          because the user expects an information response, not a slow lamp.
          Hover state is driven by the invisible DOM hit areas in A11yOverlay,
          so the actual text can stay pointer-transparent and never block the
          canvas interaction model. */}
      {labelLayouts.map((layout) => {
        const w = viewBoxToWorld(layout.position)
        const isTechHovered = hoveredTechKey === layout.tech_key
        const opacity = techLabelOpacity(layout.landmark.weight)
        const dynamicStarStyle: React.CSSProperties = {
          ...starLabelBaseStyle,
          fontSize: layout.fontSize,
          color: isTechHovered ? '#ffffff' : `rgba(201, 212, 232, ${opacity})`,
          textShadow: isTechHovered
            ? '0 1px 3px rgba(0,0,0,0.94), 0 0 9px rgba(220,232,255,0.34)'
            : `0 1px 3px rgba(0,0,0,0.94), 0 0 5px rgba(160,185,230,${0.06 + opacity * 0.06})`,
          transform: isTechHovered ? 'scale(1.12)' : 'scale(1.0)',
          transition: 'transform 180ms ease-out, color 180ms ease-out, text-shadow 180ms ease-out',
        }
        return (
          <Html
            key={layout.tech_key}
            position={[w.x, w.y, 0]}
            center
            zIndexRange={[10, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <span style={dynamicStarStyle}>{layout.label}</span>
          </Html>
        )
      })}
    </group>
  )
}
