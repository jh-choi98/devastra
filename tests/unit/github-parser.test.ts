import { describe, it, expect } from 'vitest'
import {
  extractFilePaths,
  parsePackageJsonDeps,
  parseRequirementsTxt,
  parsePyprojectTomlDeps,
  parseGoMod,
  parsePomXmlDeps,
  parseGradleDeps,
  parseGemfile,
  parseCargoToml,
} from '../../features/sync/sources/parsers'
import type { GitHubCommitRest } from '../../lib/github/types'

// ---------------------------------------------------------------------------
// extractFilePaths
// ---------------------------------------------------------------------------
describe('extractFilePaths', () => {
  it('returns file names from files array', () => {
    const commit: GitHubCommitRest = {
      sha: 'abc',
      html_url: 'https://github.com/x/y/commit/abc',
      files: [
        { filename: 'src/index.ts', additions: 1, deletions: 0, status: 'added', sha: 'f1' },
        { filename: 'src/utils.ts', additions: 2, deletions: 1, status: 'modified', sha: 'f2' },
      ],
    }
    expect(extractFilePaths(commit)).toEqual(['src/index.ts', 'src/utils.ts'])
  })

  it('returns empty array when files is undefined', () => {
    const commit: GitHubCommitRest = { sha: 'abc', html_url: 'https://github.com/x/y/commit/abc' }
    expect(extractFilePaths(commit)).toEqual([])
  })

  it('returns empty array when files is empty', () => {
    const commit: GitHubCommitRest = {
      sha: 'abc',
      html_url: 'https://github.com/x/y/commit/abc',
      files: [],
    }
    expect(extractFilePaths(commit)).toEqual([])
  })

  it('handles malformed input gracefully', () => {
    // Force-cast to simulate unexpected runtime shape
    expect(extractFilePaths(null as unknown as GitHubCommitRest)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// parsePackageJsonDeps
// ---------------------------------------------------------------------------
describe('parsePackageJsonDeps', () => {
  it('parses dependencies and devDependencies', () => {
    const json = JSON.stringify({
      dependencies: { react: '^18', 'react-dom': '^18' },
      devDependencies: { typescript: '^5', vitest: '^2' },
    })
    const result = parsePackageJsonDeps(json)
    expect(result).toContainEqual({ dep: 'react', type: 'dep' })
    expect(result).toContainEqual({ dep: 'react-dom', type: 'dep' })
    expect(result).toContainEqual({ dep: 'typescript', type: 'devDep' })
    expect(result).toContainEqual({ dep: 'vitest', type: 'devDep' })
    expect(result).toHaveLength(4)
  })

  it('returns only deps when devDependencies missing', () => {
    const json = JSON.stringify({ dependencies: { express: '^4' } })
    const result = parsePackageJsonDeps(json)
    expect(result).toEqual([{ dep: 'express', type: 'dep' }])
  })

  it('returns empty array for empty dependencies objects', () => {
    expect(parsePackageJsonDeps(JSON.stringify({ dependencies: {}, devDependencies: {} }))).toEqual(
      [],
    )
  })

  it('returns empty array for non-object JSON', () => {
    expect(parsePackageJsonDeps('"just a string"')).toEqual([])
  })

  it('returns empty array for malformed JSON', () => {
    expect(parsePackageJsonDeps('{ not valid json')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parsePackageJsonDeps('')).toEqual([])
  })

  it('handles scoped package names', () => {
    const json = JSON.stringify({ dependencies: { '@nestjs/core': '^10', '@angular/core': '^17' } })
    const result = parsePackageJsonDeps(json)
    expect(result).toContainEqual({ dep: '@nestjs/core', type: 'dep' })
    expect(result).toContainEqual({ dep: '@angular/core', type: 'dep' })
  })
})

// ---------------------------------------------------------------------------
// parseRequirementsTxt
// ---------------------------------------------------------------------------
describe('parseRequirementsTxt', () => {
  it('parses simple package names', () => {
    const text = 'django\nflask\nfastapi\n'
    expect(parseRequirementsTxt(text)).toEqual(['django', 'flask', 'fastapi'])
  })

  it('strips version specifiers', () => {
    const text = 'django==4.2\nflask>=2.0\nfastapi~=0.100.0\npytest>=7.0,<8.0\n'
    const result = parseRequirementsTxt(text)
    expect(result).toContain('django')
    expect(result).toContain('flask')
    expect(result).toContain('fastapi')
    expect(result).toContain('pytest')
  })

  it('ignores comment lines', () => {
    const text = '# this is a comment\ndjango\n# another comment\n'
    expect(parseRequirementsTxt(text)).toEqual(['django'])
  })

  it('ignores pip options (-r, --index-url, etc.)', () => {
    const text = '-r other-requirements.txt\n--index-url https://pypi.org/simple\nrequests\n'
    expect(parseRequirementsTxt(text)).toEqual(['requests'])
  })

  it('ignores blank lines', () => {
    expect(parseRequirementsTxt('\n\ndjango\n\n')).toEqual(['django'])
  })

  it('returns empty array for empty string', () => {
    expect(parseRequirementsTxt('')).toEqual([])
  })

  it('normalizes to lowercase', () => {
    expect(parseRequirementsTxt('Django\nFlask\n')).toEqual(['django', 'flask'])
  })
})

// ---------------------------------------------------------------------------
// parsePyprojectTomlDeps
// ---------------------------------------------------------------------------
describe('parsePyprojectTomlDeps', () => {
  it('parses PEP 621 dependency arrays', () => {
    const text = `[project]
dependencies = [
  "fastapi>=0.110",
  "pandas",
  "scikit-learn[extra]",
]
`
    const result = parsePyprojectTomlDeps(text)
    expect(result).toContain('fastapi')
    expect(result).toContain('pandas')
    expect(result).toContain('scikit-learn')
  })

  it('parses Poetry dependency keys', () => {
    const text = `[tool.poetry.dependencies]
python = "^3.12"
django = "^5"
sqlalchemy = "^2"
`
    const result = parsePyprojectTomlDeps(text)
    expect(result).toContain('django')
    expect(result).toContain('sqlalchemy')
    expect(result).not.toContain('python')
  })
})

// ---------------------------------------------------------------------------
// parseGoMod
// ---------------------------------------------------------------------------
describe('parseGoMod', () => {
  it('parses block require directives', () => {
    const text = `module github.com/user/repo

go 1.21

require (
\tgithub.com/gin-gonic/gin v1.9.1
\tgithub.com/stretchr/testify v1.8.4
)
`
    const result = parseGoMod(text)
    expect(result).toContain('github.com/gin-gonic/gin')
    expect(result).toContain('github.com/stretchr/testify')
  })

  it('parses single-line require directive', () => {
    const text = `module github.com/user/repo

go 1.21

require github.com/pkg/errors v0.9.1
`
    expect(parseGoMod(text)).toContain('github.com/pkg/errors')
  })

  it('handles multiple require blocks', () => {
    const text = `module example.com/app

require (
\tgithub.com/a/b v1.0.0
)

require (
\tgithub.com/c/d v2.0.0
)
`
    const result = parseGoMod(text)
    expect(result).toContain('github.com/a/b')
    expect(result).toContain('github.com/c/d')
  })

  it('returns empty array for empty string', () => {
    expect(parseGoMod('')).toEqual([])
  })

  it('returns empty array for malformed content', () => {
    expect(parseGoMod('this is not go.mod')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// parsePomXmlDeps
// ---------------------------------------------------------------------------
describe('parsePomXmlDeps', () => {
  it('parses Maven artifact IDs', () => {
    const text = `<project>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
    </dependency>
  </dependencies>
</project>`
    const result = parsePomXmlDeps(text)
    expect(result).toContain('spring-boot-starter-web')
    expect(result).toContain('junit-jupiter')
  })
})

// ---------------------------------------------------------------------------
// parseGradleDeps
// ---------------------------------------------------------------------------
describe('parseGradleDeps', () => {
  it('parses Gradle dependency coordinates', () => {
    const text = `dependencies {
  implementation "org.springframework.boot:spring-boot-starter-web:3.2.0"
  testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")
}`
    const result = parseGradleDeps(text)
    expect(result).toContain('spring-boot-starter-web')
    expect(result).toContain('org.springframework.boot:spring-boot-starter-web')
    expect(result).toContain('junit-jupiter')
  })
})

// ---------------------------------------------------------------------------
// parseGemfile
// ---------------------------------------------------------------------------
describe('parseGemfile', () => {
  it('parses single-quoted gem names', () => {
    const text = `source 'https://rubygems.org'\n\ngem 'rails', '~> 7.0'\ngem 'devise'\n`
    const result = parseGemfile(text)
    expect(result).toContain('rails')
    expect(result).toContain('devise')
  })

  it('parses double-quoted gem names', () => {
    const text = `gem "rspec", "~> 3.0"\ngem "factory_bot"\n`
    const result = parseGemfile(text)
    expect(result).toContain('rspec')
    expect(result).toContain('factory_bot')
  })

  it('ignores source and group lines', () => {
    const text = `source 'https://rubygems.org'\nruby '3.2.0'\ngem 'rails'\n`
    const result = parseGemfile(text)
    expect(result).toEqual(['rails'])
  })

  it('returns empty array for empty string', () => {
    expect(parseGemfile('')).toEqual([])
  })

  it('returns empty array for no gem declarations', () => {
    expect(parseGemfile("source 'https://rubygems.org'\n")).toEqual([])
  })

  it('handles malformed input gracefully', () => {
    expect(parseGemfile(null as unknown as string)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// parseCargoToml
// ---------------------------------------------------------------------------
describe('parseCargoToml', () => {
  it('parses [dependencies] section', () => {
    const text = `[package]
name = "my-app"

[dependencies]
serde = "1.0"
tokio = { version = "1", features = ["full"] }
clap = "4"
`
    const result = parseCargoToml(text)
    expect(result).toContain('serde')
    expect(result).toContain('tokio')
    expect(result).toContain('clap')
  })

  it('parses [dev-dependencies] section', () => {
    const text = `[dev-dependencies]
criterion = "0.5"
mockall = "0.11"
`
    const result = parseCargoToml(text)
    expect(result).toContain('criterion')
    expect(result).toContain('mockall')
  })

  it('parses [build-dependencies] section', () => {
    const text = `[build-dependencies]
cc = "1.0"
`
    expect(parseCargoToml(text)).toContain('cc')
  })

  it('stops at next non-deps section', () => {
    const text = `[dependencies]
serde = "1.0"

[features]
default = []
`
    const result = parseCargoToml(text)
    expect(result).toContain('serde')
    expect(result).not.toContain('default')
  })

  it('ignores comment lines', () => {
    const text = `[dependencies]
# this is a comment
serde = "1.0"
`
    expect(parseCargoToml(text)).toEqual(['serde'])
  })

  it('returns empty array for no dependencies section', () => {
    expect(parseCargoToml('[package]\nname = "app"\n')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseCargoToml('')).toEqual([])
  })

  it('handles malformed input gracefully', () => {
    expect(parseCargoToml(null as unknown as string)).toEqual([])
  })
})
