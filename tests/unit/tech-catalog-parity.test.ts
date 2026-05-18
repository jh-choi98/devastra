import { describe, it, expect } from 'vitest'
import { TECH_CATALOG } from '@/features/territories/tech-catalog'
import { getPublicTech, getAllPublicTech } from '@/features/territories/tech-catalog-public'
import { getClientStarPositions } from '@/app/_components/Constellation/star-positions'

describe('tech-catalog-parity', () => {
  it('has the same number of entries', () => {
    expect(getAllPublicTech().length).toBe(TECH_CATALOG.length)
  })

  it('has matching tech_key/displayName/territory triples for every server entry', () => {
    for (const entry of TECH_CATALOG) {
      const pub = getPublicTech(entry.tech_key)
      expect(pub, `missing public entry for ${entry.tech_key}`).toBeDefined()
      expect(pub!.displayName).toBe(entry.displayName)
      expect(pub!.territory).toBe(entry.territory)
    }
  })

  it('contains no extra keys not present in server catalog', () => {
    for (const pub of getAllPublicTech()) {
      const entry = TECH_CATALOG.find((e) => e.tech_key === pub.tech_key)
      expect(entry, `unexpected public entry ${pub.tech_key}`).toBeDefined()
    }
  })

  it('has a client star position for every server catalog entry', () => {
    const clientPositions = getClientStarPositions()
    expect(clientPositions.length).toBe(TECH_CATALOG.length)

    for (const entry of TECH_CATALOG) {
      const position = clientPositions.find((p) => p.tech_key === entry.tech_key)
      expect(position, `missing client star position for ${entry.tech_key}`).toBeDefined()
      expect(position!.territory).toBe(entry.territory)
    }
  })
})
