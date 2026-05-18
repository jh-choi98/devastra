# Phase 5: Classifier & Scoring

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/data-schema.md` §Activities, §Activity_Territories, §Territories, §Landmarks
- `/docs/adr.md` (ADR-2, ADR-17)
- `/docs/tech-catalog.md` (the source of truth for 50 tech entries)
- `/CLAUDE.md`
- `/tasks/0-mvp/docs-diff.md`

Then verify Phase 4's output:

- `features/sync/sources/interface.ts` exports `SourceActivity` type
- `features/sync/sources/parsers.ts` provides parse helpers
- `tests/unit/github-parser.test.ts` passes

## Work

Build the deterministic, rule-based classifier that transforms `SourceActivity` into multi-label territory weights and landmark unlocks. No LLM. No randomness. Same input always produces same output.

### 1. Territory registry (shared, not server-only)

`features/territories/registry.ts`:

```ts
export type TerritoryType =
  | 'frontend_land'
  | 'backend_fortress'
  | 'data_pipeline_zone'
  | 'testing_lab'
  | 'devops_harbor'
  | 'docs_library'

export const TERRITORIES: Record<TerritoryType, {
  name: string                  // display name, e.g. 'Backend Fortress'
  color: string                 // hex
  shapeSeed: string             // stable seed for procedural island shape
  landmarkColor: string         // accent for landmarks on this island
}> = {
  frontend_land:      { name: 'Frontend Land',      color: '#7C9DFF', shapeSeed: 'fl', landmarkColor: '#3B5BFF' },
  backend_fortress:   { name: 'Backend Fortress',   color: '#6B7280', shapeSeed: 'bf', landmarkColor: '#374151' },
  data_pipeline_zone: { name: 'Data Pipeline Zone', color: '#10B981', shapeSeed: 'dpz', landmarkColor: '#047857' },
  testing_lab:        { name: 'Testing Lab',        color: '#A78BFA', shapeSeed: 'tl',  landmarkColor: '#7C3AED' },
  devops_harbor:      { name: 'DevOps Harbor',      color: '#0EA5E9', shapeSeed: 'dh',  landmarkColor: '#0369A1' },
  docs_library:       { name: 'Docs Library',       color: '#F59E0B', shapeSeed: 'dl',  landmarkColor: '#B45309' },
}

export const ALL_TERRITORY_TYPES: TerritoryType[] = Object.keys(TERRITORIES) as TerritoryType[]
```

This file is imported by both backend (classification, recap) and frontend (map rendering). It must NOT contain server-only constants.

### 2. Server-only rules

`features/territories/rules.ts`:

```ts
import 'server-only'

export const STAGE_THRESHOLDS = [0, 50, 200, 500, 1500] as const
export const MAX_STAGE = STAGE_THRESHOLDS.length  // 5

export const SCORE_WEIGHTS = {
  commit: 1,
  pr: 5,
  issue: 2,
} as const

export const LANDMARK_UNLOCK_THRESHOLD = 5

export function computeStage(totalWeight: number): number {
  // Returns 1..5 based on STAGE_THRESHOLDS
  let stage = 1
  for (let i = 0; i < STAGE_THRESHOLDS.length; i++) {
    if (totalWeight >= STAGE_THRESHOLDS[i]) stage = i + 1
  }
  return stage
}
```

Frontend code MUST NOT import this file (`server-only` enforces it at build time).

### 3. Tech catalog

`features/territories/tech-catalog.ts`. Match `/docs/tech-catalog.md` exactly — same 50 `tech_key`s, same landmark names, same detection rules. Shape:

```ts
import 'server-only'
import type { TerritoryType } from './registry'

export type DetectionRule =
  | { kind: 'ext'; extensions: string[] }            // matches activity.filePaths by suffix
  | { kind: 'path'; prefixes: string[] }             // matches activity.filePaths by prefix
  | { kind: 'filename'; names: string[] }            // matches activity.filePaths by basename
  | { kind: 'packageJson'; packageName: string }     // requires fetched package.json content
  | { kind: 'requirementsTxt'; packageName: string }
  | { kind: 'goMod'; modulePath: string }
  | { kind: 'gemfile'; gemName: string }
  | { kind: 'cargoToml'; crateName: string }

export type TechCatalogEntry = {
  tech_key: string                  // stable identifier, e.g. 'typescript'
  landmarkName: string              // 'TypeScript Pavilion'
  territory: TerritoryType
  rules: DetectionRule[]            // OR semantics: any match implies the tech is present
}

export const TECH_CATALOG: readonly TechCatalogEntry[] = [
  // ... 50 entries matching docs/tech-catalog.md
]

export function getTechByKey(key: string): TechCatalogEntry | undefined
```

Implement all 50 entries from the doc. Verify by counting:

```ts
// at module-load time, optional dev assertion (not in prod build)
if (TECH_CATALOG.length !== 50) throw new Error(...)
```

For rules requiring package manifests (packageJson, requirementsTxt, etc.), the classifier's caller is responsible for supplying parsed dep lists. Phase 6 will wire that up.

### 4. Classifier

`features/territories/classifier.ts`:

```ts
import 'server-only'
import type { SourceActivity } from '@/features/sync/sources/interface'
import type { TerritoryType } from './registry'
import { SCORE_WEIGHTS } from './rules'
import { TECH_CATALOG } from './tech-catalog'

export type ClassificationResult = {
  territory: TerritoryType
  weight: number              // base weight × territory_affinity
  techKeys: string[]          // landmarks contributed by this classification
}

export interface Classifier {
  classify(activity: SourceActivity, ctx: ClassificationContext): ClassificationResult[]
}

export type ClassificationContext = {
  parsedPackageJsonDeps: string[]
  parsedRequirementsTxtDeps: string[]
  parsedGoModDeps: string[]
  parsedGemfileDeps: string[]
  parsedCargoTomlDeps: string[]
}

export class GitHubClassifier implements Classifier {
  classify(activity, ctx): ClassificationResult[] { ... }
}
```

Implementation rules:

- For each activity, evaluate every `TechCatalogEntry`. A tech matches when ANY of its `rules` matches (OR semantics).
- Base weight per activity type from `SCORE_WEIGHTS`.
- `territory_affinity ∈ [0.5, 1.0]`: when one activity touches files for multiple territories, divide weight proportionally. Specifically:
  - If activity matches techs in exactly one territory, that territory's affinity = 1.0.
  - If activity matches techs in N territories, each territory's affinity = `max(0.5, 1.0 / sqrt(N))`. This keeps multi-territory commits relevant but slightly discounted.
- Group `techKeys` by their `territory` so each `ClassificationResult` corresponds to one territory's row.
- If NO tech matches at all, fall back to inferring territory from the file extensions alone (e.g. `.md` → docs_library, `.test.ts` → testing_lab). If still nothing, produce a single `ClassificationResult` for the territory derived from the repo's primary language (caller passes it via ctx; if absent, do not emit a result).

### 5. Scoring helpers

`features/territories/scoring.ts`:

```ts
import 'server-only'
export function computeGrowth30d(activities: { occurredAt: Date; weight: number }[]): number
export function nextStageDelta(currentStage: number, totalWeight: number): { nextStage: number | null; weightUntilNext: number }
```

`computeGrowth30d` sums weight where `occurredAt > NOW() - 30 days`. Used by Phase 6 sync to update `territories.growth_30d`.

### 6. Unit tests

`tests/unit/classifier.test.ts` (≥95% line coverage):

- Each of the 50 tech entries has at least one positive-match test case.
- Multi-territory commit (touches React + Postgres migration + Dockerfile) yields three results with `affinity < 1.0`.
- Activity with no matches and no primary language → empty array.
- Activity with no matches but primary language `'go'` → one result for `backend_fortress`.
- All three activity types (`commit`, `pr`, `issue`) use the right base weight.

`tests/unit/scoring.test.ts`:

- `computeStage` returns 1, 2, 3, 4, 5 at boundaries (0, 50, 200, 500, 1500).
- `computeStage(49)` → 1; `computeStage(50)` → 2; etc.
- `computeStage(99999)` → 5.
- `computeGrowth30d` filters by date correctly.
- `nextStageDelta` returns correct `weightUntilNext` at various points.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm run build
npm test -- classifier
npm test -- scoring
npx vitest run --coverage tests/unit/classifier.test.ts tests/unit/scoring.test.ts 2>&1 | grep -E "All files" || true
grep -c "tech_key" features/territories/tech-catalog.ts | awk '{ if ($1 < 50) exit 1 }'
```

## How to verify AC

Run the AC commands. Classifier and scoring tests must pass. The catalog must contain at least 50 entries (verified by `grep -c "tech_key"`).

If all pass, set this phase's status to `"completed"` in `/tasks/0-mvp/index.json`. If you cannot make AC pass after 3 attempts, set status to `"error"`.

## Notes

- Do NOT use any LLM, randomness, time-of-day, or non-deterministic logic. `classify(a, ctx)` must be a pure function of `(a, ctx)`.
- Do NOT introduce a `classifier_version` column or runtime versioning. Backfill (Phase 6) re-runs everything against latest rules.
- Multi-label is correct: a `.tsx` test file (`src/App.test.tsx`) should yield results for both `frontend_land` (from `.tsx`) and `testing_lab` (from `.test.tsx` or `__tests__/`).
- Keep `registry.ts` free of `server-only` so frontend imports work.
- All identifiers, comments, fixture strings in English.
- The tech catalog landmark names must match `/docs/tech-catalog.md` exactly. If the doc and code disagree, fix the code, not the doc.
