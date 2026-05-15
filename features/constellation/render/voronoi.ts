// SPDX-License-Identifier: MIT
import type { Viewport, VoronoiCell, WorldCoord } from './types'
import { anchorsFor } from './anchors'

/**
 * Clips a convex polygon by the half-plane where (P - M) · N ≤ 0.
 * M = (mx, my) is a point on the clipping line; N = (nx, ny) is the normal.
 * Uses Sutherland-Hodgman edge clipping.
 */
function clipByHalfPlane(
  polygon: WorldCoord[],
  mx: number, my: number,
  nx: number, ny: number,
): WorldCoord[] {
  if (polygon.length === 0) return []

  const inside = (p: WorldCoord) => (p.x - mx) * nx + (p.y - my) * ny <= 0

  const intersect = (a: WorldCoord, b: WorldCoord): WorldCoord => {
    const da = (a.x - mx) * nx + (a.y - my) * ny
    const db = (b.x - mx) * nx + (b.y - my) * ny
    const t = da / (da - db)
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
  }

  const result: WorldCoord[] = []
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % n]
    const aIn = inside(a)
    const bIn = inside(b)
    if (aIn) {
      result.push(a)
      if (!bIn) result.push(intersect(a, b))
    } else if (bIn) {
      result.push(intersect(a, b))
    }
  }
  return result
}

/**
 * Computes 6 Voronoi cells for the given viewport's cluster anchors,
 * clipped to the viewBox (1000x700). Cells are returned in fixed cluster order.
 * Pure function — same viewport always yields identical cells.
 *
 * Implementation: half-plane intersection, O(n²) for n=6 anchors.
 */
export function voronoiCells(viewport: Viewport): VoronoiCell[] {
  const anchors = anchorsFor(viewport)
  const viewBox: WorldCoord[] = [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 700 },
    { x: 0, y: 700 },
  ]

  return anchors.map((ai) => {
    let polygon = [...viewBox]

    for (const aj of anchors) {
      if (aj.type === ai.type) continue
      // Perpendicular bisector midpoint
      const mx = (ai.x + aj.x) / 2
      const my = (ai.y + aj.y) / 2
      // Normal pointing from ai toward aj; ai's half-plane keeps (P-M)·N ≤ 0
      const nx = aj.x - ai.x
      const ny = aj.y - ai.y
      polygon = clipByHalfPlane(polygon, mx, my, nx, ny)
      if (polygon.length === 0) break
    }

    return { type: ai.type, polygon }
  })
}
