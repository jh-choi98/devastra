import type { WorldCoord } from './types'

const VB_W = 1000
const VB_H = 700

/** Converts a viewBox (1000x700) coordinate to WebGL world coordinates ([-1,1] x [-h/w, h/w]). */
export function viewBoxToWorld(p: WorldCoord): { x: number; y: number; z: number } {
  return {
    x: (p.x / VB_W) * 2 - 1,
    y: -((p.y / VB_H) * 2 - 1), // flip Y: WebGL is Y-up
    z: 0,
  }
}

/** Inverse of viewBoxToWorld. */
export function worldToViewBox(w: { x: number; y: number }): WorldCoord {
  return {
    x: ((w.x + 1) / 2) * VB_W,
    y: ((-w.y + 1) / 2) * VB_H,
  }
}

/** Converts a viewBox coordinate to a CSS pixel coordinate given a target canvas size. */
export function viewBoxToScreen(
  p: WorldCoord,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (p.x / VB_W) * canvasWidth,
    y: (p.y / VB_H) * canvasHeight,
  }
}
