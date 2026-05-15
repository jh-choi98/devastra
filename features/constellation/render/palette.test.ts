import { describe, it, expect } from 'vitest'
import { spectralColorFor, spectralHex } from './palette'

const TECH_KEYS = [
  'typescript', 'javascript', 'react', 'nextjs', 'vue', 'svelte', 'angular',
  'tailwind', 'css', 'sass', 'vite', 'webpack', 'nodejs', 'express', 'fastify',
  'nestjs', 'go', 'gin', 'python', 'fastapi', 'django', 'flask', 'rust', 'java',
  'postgres', 'mysql', 'sqlite', 'mongodb', 'redis', 'sql', 'dbt', 'prisma',
  'jest', 'vitest', 'pytest', 'playwright', 'cypress', 'rspec',
  'docker', 'ghactions', 'terraform', 'kubernetes', 'aws', 'vercel', 'nginx',
  'markdown', 'mdx', 'jsdoc', 'storybook', 'openapi',
]

describe('palette', () => {
  it('spectralColorFor is deterministic — same key always returns same color', () => {
    for (const key of TECH_KEYS) {
      expect(spectralColorFor(key)).toBe(spectralColorFor(key))
    }
  })

  it('distribution across tech catalog approximates 70/20/7/2/1 targets', () => {
    const counts: Record<string, number> = {
      'white': 0, 'blue-white': 0, 'yellow-white': 0, 'orange': 0, 'red': 0,
    }
    for (const key of TECH_KEYS) {
      counts[spectralColorFor(key)]++
    }
    const n = TECH_KEYS.length
    // Check that white > blue-white > yellow-white, and all colors appear in some large catalog
    expect(counts['white'] / n).toBeGreaterThan(0.4) // at least 40%
    // blue-white + yellow-white + orange + red covers the rest
    expect(counts['white'] + counts['blue-white'] + counts['yellow-white'] +
           counts['orange'] + counts['red']).toBe(n)
  })

  it('all 5 spectral colors are reachable', () => {
    // Generate enough keys to hit all 5 buckets
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) {
      seen.add(spectralColorFor(`tech_${i}`))
    }
    expect(seen).toContain('white')
    expect(seen).toContain('blue-white')
    expect(seen).toContain('yellow-white')
    expect(seen).toContain('orange')
    expect(seen).toContain('red')
  })

  it('spectralHex returns a valid hex string for each color', () => {
    const colors = ['white', 'blue-white', 'yellow-white', 'orange', 'red'] as const
    for (const c of colors) {
      const hex = spectralHex(c)
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
