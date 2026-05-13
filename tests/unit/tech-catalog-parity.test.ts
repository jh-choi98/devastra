import { describe, it, expect } from 'vitest'
import { TECH_CATALOG } from '@/features/territories/tech-catalog'
import { PUBLIC_TECH_CATALOG } from '@/features/territories/tech-catalog-public'

describe('tech-catalog-parity', () => {
  it('has the same number of entries', () => {
    expect(PUBLIC_TECH_CATALOG.length).toBe(TECH_CATALOG.length)
  })

  it('has matching tech_key/landmarkName/territory triples for every server entry', () => {
    for (const entry of TECH_CATALOG) {
      const pub = PUBLIC_TECH_CATALOG.find((e) => e.tech_key === entry.tech_key)
      expect(pub, `missing public entry for ${entry.tech_key}`).toBeDefined()
      expect(pub!.landmarkName).toBe(entry.landmarkName)
      expect(pub!.territory).toBe(entry.territory)
    }
  })

  it('contains no extra keys not present in server catalog', () => {
    for (const pub of PUBLIC_TECH_CATALOG) {
      const entry = TECH_CATALOG.find((e) => e.tech_key === pub.tech_key)
      expect(entry, `unexpected public entry ${pub.tech_key}`).toBeDefined()
    }
  })
})
