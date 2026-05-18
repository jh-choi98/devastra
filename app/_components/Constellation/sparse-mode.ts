import { sparseProfileForLitStars } from '@/features/constellation/render/sparse-profile'
import { viewBoxToWorld } from '@/features/constellation/render/coords'
import type { Viewport, WorldCoord } from '@/features/constellation/render/types'
import { resolveStarViewBoxPosition } from './star-positions'
import type { ConstellationData } from './types'

const VIEWBOX_CENTER: WorldCoord = { x: 500, y: 350 }
const MAX_FOCUS_BLEND = 0.22

export interface SparseConstellationView {
  litStarCount: number
  profile: ReturnType<typeof sparseProfileForLitStars>
  focusViewBox: WorldCoord
  focusWorld: { x: number; y: number; z: number }
  svgTransform: string
}

function getLitLandmarks(data: ConstellationData): ConstellationData['landmarks'] {
  return data.landmarks.filter(
    (landmark) => landmark.firstUnlockedAt !== null && landmark.weight >= 5,
  )
}

function sparseFocusViewBox(
  data: ConstellationData,
  viewport: Viewport,
  intensity: number,
): WorldCoord {
  const lit = getLitLandmarks(data)
  if (lit.length === 0 || intensity <= 0) return VIEWBOX_CENTER

  const positions = lit.map((landmark) =>
    resolveStarViewBoxPosition(landmark.tech_key, landmark.territory, viewport),
  )
  const minX = Math.min(...positions.map((position) => position.x))
  const maxX = Math.max(...positions.map((position) => position.x))
  const minY = Math.min(...positions.map((position) => position.y))
  const maxY = Math.max(...positions.map((position) => position.y))
  const litCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
  const blend = MAX_FOCUS_BLEND * intensity

  return {
    x: VIEWBOX_CENTER.x + (litCenter.x - VIEWBOX_CENTER.x) * blend,
    y: VIEWBOX_CENTER.y + (litCenter.y - VIEWBOX_CENTER.y) * blend,
  }
}

export function sparseViewForData(
  data: ConstellationData,
  viewport: Viewport,
): SparseConstellationView {
  const litStarCount = getLitLandmarks(data).length
  const profile = sparseProfileForLitStars(litStarCount, viewport)
  const focusViewBox = sparseFocusViewBox(data, viewport, profile.intensity)
  const focusWorld = viewBoxToWorld(focusViewBox)
  const { cameraZoom } = profile
  const svgTransform =
    `translate(${VIEWBOX_CENTER.x} ${VIEWBOX_CENTER.y}) ` +
    `scale(${cameraZoom}) ` +
    `translate(${-focusViewBox.x} ${-focusViewBox.y})`

  return {
    litStarCount,
    profile,
    focusViewBox,
    focusWorld,
    svgTransform,
  }
}
