import 'server-only'

import type { GitHubCommitRest } from '@/lib/github/types'

export function extractFilePaths(rawCommit: GitHubCommitRest): string[] {
  try {
    if (!rawCommit.files || !Array.isArray(rawCommit.files)) return []
    return rawCommit.files.map((f) => f.filename).filter(Boolean)
  } catch {
    return []
  }
}

export function parsePackageJsonDeps(
  jsonText: string,
): { dep: string; type: 'dep' | 'devDep' }[] {
  try {
    const parsed = JSON.parse(jsonText) as unknown
    if (typeof parsed !== 'object' || parsed === null) return []
    const obj = parsed as Record<string, unknown>
    const results: { dep: string; type: 'dep' | 'devDep' }[] = []

    const deps = obj.dependencies
    if (typeof deps === 'object' && deps !== null) {
      for (const dep of Object.keys(deps as Record<string, unknown>)) {
        results.push({ dep, type: 'dep' })
      }
    }

    const devDeps = obj.devDependencies
    if (typeof devDeps === 'object' && devDeps !== null) {
      for (const dep of Object.keys(devDeps as Record<string, unknown>)) {
        results.push({ dep, type: 'devDep' })
      }
    }

    return results
  } catch {
    return []
  }
}

export function parseRequirementsTxt(text: string): string[] {
  try {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('-'))
      .map((line) => {
        // Strip version specifiers: package==1.0, package>=1.0, package~=1.0, package[extras]
        const match = line.match(/^([A-Za-z0-9_.-]+)/)
        return match ? match[1].toLowerCase() : ''
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

export function parseGoMod(text: string): string[] {
  try {
    const results: string[] = []
    const lines = text.split('\n')
    let inRequireBlock = false

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed === 'require (') {
        inRequireBlock = true
        continue
      }
      if (inRequireBlock && trimmed === ')') {
        inRequireBlock = false
        continue
      }

      if (inRequireBlock) {
        // format: "module/path vX.Y.Z"
        const match = trimmed.match(/^(\S+)\s+v/)
        if (match) results.push(match[1])
      } else {
        // single-line: require module/path vX.Y.Z
        const match = trimmed.match(/^require\s+(\S+)\s+v/)
        if (match) results.push(match[1])
      }
    }

    return results
  } catch {
    return []
  }
}

export function parseGemfile(text: string): string[] {
  try {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('gem '))
      .map((line) => {
        // gem 'name', ... or gem "name", ...
        const match = line.match(/^gem\s+['"]([^'"]+)['"]/)
        return match ? match[1] : ''
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

export function parseCargoToml(text: string): string[] {
  try {
    const results: string[] = []
    const lines = text.split('\n')
    let inDepsSection = false

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed === '[dependencies]' || trimmed === '[dev-dependencies]' || trimmed === '[build-dependencies]') {
        inDepsSection = true
        continue
      }

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        // Entering a new section that is not a deps section
        const isDeps =
          trimmed === '[dependencies]' ||
          trimmed === '[dev-dependencies]' ||
          trimmed === '[build-dependencies]'
        if (!isDeps) {
          inDepsSection = false
        }
        continue
      }

      if (inDepsSection && trimmed.length > 0 && !trimmed.startsWith('#')) {
        // format: crate_name = "version" or crate_name = { version = "...", ... }
        const match = trimmed.match(/^([A-Za-z0-9_-]+)\s*=/)
        if (match) results.push(match[1])
      }
    }

    return results
  } catch {
    return []
  }
}
