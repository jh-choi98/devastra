# Phase 4: GitHub Integration

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/data-schema.md` §Activities, §Repositories, §Users
- `/docs/adr.md` (ADR-9, ADR-10, ADR-11, ADR-16, ADR-17)
- `/docs/code-architecture.md` §Layers and dependency direction
- `/CLAUDE.md`
- `/tasks/0-mvp/docs-diff.md`

Then verify Phase 3's output:

- `lib/auth/supabase.ts` exists with server and admin clients
- `features/sync/sources/github.ts` or `constants.ts` exports `MVP_INCLUDE_PRIVATE = false`
- `npm test -- oauth-callback` passes

## Work

Build the GitHub source client that supplies all sync flows downstream. The interface MUST be source-agnostic so a future `GitLabSourceClient` can be added without touching consumers.

### 1. SourceClient interface

`features/sync/sources/interface.ts` (`import 'server-only'`):

```ts
export type SourceUserId = { source: 'github'; externalId: string }
export type SourceRepo = {
  source: 'github'
  externalRepoId: string
  owner: string
  name: string
  primaryLanguage: string | null
  isPrivate: boolean
}
export type SourceActivity = {
  source: 'github'
  externalId: string
  type: 'commit' | 'pr' | 'issue'
  repoExternalId: string
  occurredAt: Date
  filePaths: string[]   // empty array if not yet fetched (sampled separately)
  additions: number
  deletions: number
  githubUrl: string
}

export interface SourceClient {
  listAuthoredRepos(): Promise<SourceRepo[]>
  listAuthoredActivities(opts: {
    repoExternalIds: string[]
    since: Date          // contributions window
  }): Promise<SourceActivity[]>
  fetchCommitFiles(repoOwner: string, repoName: string, sha: string): Promise<{
    file_paths: string[]; additions: number; deletions: number; github_url: string
  }>
  fetchPullRequestTitles(handles: { owner: string; repo: string; number: number }[]): Promise<Record<string, string>>
  refreshTokenIfNeeded(): Promise<void>
}
```

The PR-title batch method exists to support the on-demand drawer fetch in Phase 8 — it is NOT used during sync writes.

### 2. GitHubSourceClient

`features/sync/sources/github.ts` (`import 'server-only'`):

- Construct with the user's decrypted access token (caller decrypts via `lib/db/encryption.ts`).
- `User-Agent: DevAtlas/0.1 (+https://devatlas.app)` on every request.
- Use GraphQL for `listAuthoredActivities` via `contributionsCollection { commitContributionsByRepository, pullRequestContributions, issueContributions }` over a 12-month window. Use REST for `fetchCommitFiles`.
- Filter out private repos in `listAuthoredRepos`:

```ts
const repos = (await this.gh.listAffiliatedRepos()).filter(r => MVP_INCLUDE_PRIVATE || !r.isPrivate)
```

- Respect Retry-After / 403 secondary rate limits — `await` and retry once.
- 401 on any call → `await this.refreshTokenIfNeeded()` then retry once more.

### 3. GitHub clients

Split protocol concerns into `lib/github/`:

- `lib/github/graphql.ts` — fetch-based GraphQL client with typed queries (use TypeScript template-literal types, NO codegen). Server-only.
- `lib/github/rest.ts` — fetch-based REST client. Server-only.
- `lib/github/token.ts` — JIT refresh. Exports `refreshAccessToken(userId)` that:
  1. Reads `users.github_refresh_token_enc`, decrypts.
  2. POSTs to `https://github.com/login/oauth/access_token` with `refresh_token` grant.
  3. Encrypts new tokens, UPDATEs `users.github_access_token_enc`, `users.github_refresh_token_enc`, `users.github_token_expires_at`.
  4. Returns the new plaintext access token.
- `lib/github/types.ts` — shared GitHub API response shapes.

### 4. Token policy

Wrap callers so they never read `users.github_access_token_enc` directly. Provide:

```ts
// lib/github/token.ts
import 'server-only'
export async function getUsableAccessToken(userId: string): Promise<string>
// internally: if expires_at < NOW() + 10min → refreshAccessToken(); else decrypt and return
```

GitHub OAuth access tokens default to 8h. Refresh tokens are returned only if the OAuth app is configured for them; document this assumption inline (a comment in `token.ts`).

### 5. GitHub parser

`features/sync/sources/parsers.ts` — pure functions used by the classifier in Phase 5:

```ts
export function extractFilePaths(rawCommit: GitHubCommit): string[]
export function parsePackageJsonDeps(jsonText: string): { dep: string; type: 'dep' | 'devDep' }[]
export function parseRequirementsTxt(text: string): string[]
export function parseGoMod(text: string): string[]
export function parseGemfile(text: string): string[]
export function parseCargoToml(text: string): string[]
```

Each must handle malformed input gracefully (return `[]`). No throws on parse error.

### 6. Verification spike

`scripts/spike-github-api.ts` — standalone Node script (executable via `npx tsx scripts/spike-github-api.ts`). Reads `GITHUB_TEST_TOKEN` from env. Performs:

1. `GET /user` → prints `login`
2. GraphQL `contributionsCollection` (12 months) → prints repo count + PR count
3. `GET /users/{login}/events/public` → prints first event type and date
4. `GET /repos/{owner}/{repo}/commits/{sha}` (one sample) → prints file_paths length, additions, deletions
5. Prints remaining rate limit at end

Output is summarized; raw response bodies must NOT be printed (could contain commit messages — see ADR-9). If `GITHUB_TEST_TOKEN` is missing, the script prints `--help` style usage and exits 0. Add the script path to `.gitignore` outputs if any are written.

### 7. Unit tests

`tests/unit/github-parser.test.ts` — comprehensive cases for each parser (valid input, edge cases, malformed input).
`tests/unit/github-source.test.ts` — mock the GraphQL/REST clients; verify private-repo filtering, User-Agent header, retry on 403, 401 refresh path.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm run build
npm test -- github-parser
npm test -- github-source
npx tsx scripts/spike-github-api.ts --help 2>&1 | head -1
grep -q "MVP_INCLUDE_PRIVATE" features/sync/sources/github.ts || grep -q "from.*constants" features/sync/sources/github.ts
grep -rn "raw_user_meta_data\|process.env.GITHUB_OAUTH_CLIENT_SECRET" lib features 2>/dev/null | grep -v "test" | head -5
```

## How to verify AC

Run the AC commands above. The unit tests must pass. The spike script must run with `--help` (i.e. it does not crash when `GITHUB_TEST_TOKEN` is absent).

If all pass, set this phase's status to `"completed"` in `/tasks/0-mvp/index.json`. If you cannot make AC pass after 3 attempts, set status to `"error"`.

## Notes

- The spike script is for human-run verification with a real token. CI must NOT require a token. The script's `--help` path is the AC-relevant behavior.
- Do NOT persist any GitHub response body to `activities.raw` beyond the documented fields (`file_paths`, `additions`, `deletions`, `github_url`). ADR-9 is non-negotiable.
- Do NOT store commit messages anywhere. Do NOT store PR bodies. PR titles are fetched on-demand at view time (Phase 8) and must NEVER be written to `activities.raw`.
- Cache layers (`Cache-Control`, in-memory) for GraphQL/REST clients are out of scope here; the rate-limit retry logic is enough for MVP.
- All identifiers, comments, doc strings in English.
- If GitHub returns `Authorization: Basic` errors during local dev, the cause is usually missing `GITHUB_OAUTH_CLIENT_ID/SECRET` — surface this in the spike script's error message.
