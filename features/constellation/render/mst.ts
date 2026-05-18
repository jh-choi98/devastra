// SPDX-License-Identifier: MIT
import type { WorldCoord, MstEdge } from './types'

/**
 * Computes the minimum spanning tree edges among lit star positions within a cluster.
 * Uses Prim's algorithm with Euclidean distance.
 * Extracted from Constellation.tsx (lines ~140–174).
 *
 * For lit count 0 or 1: returns empty array.
 */
export function mstEdges(starsInCluster: WorldCoord[]): MstEdge[] {
  if (starsInCluster.length < 2) return []

  const inMST = new Set<number>([0])
  const edges: MstEdge[] = []

  while (inMST.size < starsInCluster.length) {
    let minD = Infinity
    let minI = -1
    let minJ = -1

    for (const i of Array.from(inMST)) {
      for (let j = 0; j < starsInCluster.length; j++) {
        if (inMST.has(j)) continue
        const dx = starsInCluster[i].x - starsInCluster[j].x
        const dy = starsInCluster[i].y - starsInCluster[j].y
        const d = dx * dx + dy * dy
        if (d < minD) {
          minD = d
          minI = i
          minJ = j
        }
      }
    }

    if (minJ === -1) break
    inMST.add(minJ)
    edges.push({ a: starsInCluster[minI], b: starsInCluster[minJ] })
  }

  return edges
}
