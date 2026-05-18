import { describe, it, expect } from 'vitest'
import { mstEdges } from './mst'
import type { WorldCoord } from './types'

describe('mstEdges', () => {
  it('returns empty array for 0 stars', () => {
    expect(mstEdges([])).toStrictEqual([])
  })

  it('returns empty array for 1 star', () => {
    expect(mstEdges([{ x: 100, y: 200 }])).toStrictEqual([])
  })

  it('returns n-1 edges for n stars and connects all nodes', () => {
    const stars: WorldCoord[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 50, y: 50 },
    ]
    const edges = mstEdges(stars)
    expect(edges.length).toBe(stars.length - 1)

    // Verify connectivity: all nodes reachable from node 0
    const adj = new Map<string, Set<string>>()
    const key = (p: WorldCoord) => `${p.x},${p.y}`
    for (const e of edges) {
      const ka = key(e.a)
      const kb = key(e.b)
      if (!adj.has(ka)) adj.set(ka, new Set())
      if (!adj.has(kb)) adj.set(kb, new Set())
      adj.get(ka)!.add(kb)
      adj.get(kb)!.add(ka)
    }
    const visited = new Set<string>()
    const queue = [key(stars[0])]
    while (queue.length) {
      const cur = queue.pop()!
      if (visited.has(cur)) continue
      visited.add(cur)
      const neighbors = adj.get(cur)
      if (!neighbors) continue
      neighbors.forEach((nb) => queue.push(nb))
    }
    for (const s of stars) {
      expect(visited).toContain(key(s))
    }
  })
})
