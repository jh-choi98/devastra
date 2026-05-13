# Phase 2: Database Layer

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- `/docs/data-schema.md` (the primary reference for this phase)
- `/docs/adr.md` (ADR-3, ADR-4, ADR-9, ADR-10, ADR-12, ADR-16, ADR-19, ADR-20)
- `/docs/code-architecture.md` §Directory tree
- `/CLAUDE.md`
- `/tasks/0-mvp/docs-diff.md`

Then verify Phase 1's output:

- `package.json` includes `drizzle-orm`, `drizzle-kit`, `postgres` (or `pg`), `@supabase/supabase-js`
- `drizzle.config.ts` exists
- `lib/db/schema/.gitkeep` exists
- `npm run typecheck && npm run build` still passes

## Work

Define the 9-table schema, RLS policies, supporting triggers, indexes, the `users_public_view`, and Realtime publication setup. All schema files in TypeScript via Drizzle. Migration SQL committed to `drizzle/migrations/`.

### 1. Drizzle schemas under `lib/db/schema/`

Each table gets its own file matching the entity list in `/docs/data-schema.md`. Use snake_case column names. Add `import 'server-only'` at the top of any file that also exports query helpers (the bare schema files do not need it, but the client file does).

Files (one per entity):

- `users.ts`
- `repositories.ts`
- `activities.ts`
- `activity_territories.ts`
- `territories.ts`
- `landmarks.ts`
- `sync_jobs.ts`
- `weekly_recaps.ts`
- `email_sends.ts`
- `index.ts` (re-export all)

Match every column, type, nullable flag, default, and unique constraint exactly as specified in `/docs/data-schema.md`. Use `bytea` (Drizzle `customType` if needed) for `users.github_access_token_enc` and `users.github_refresh_token_enc`. Use `jsonb` for `activities.raw`, `sync_jobs.progress`, `weekly_recaps.highlights`.

**Critical constraints to encode:**

- `users.id` is `uuid` PK referencing `auth.users(id)` ON DELETE CASCADE.
- `users.display_username` is UNIQUE, NOT NULL.
- `users.github_id` is UNIQUE, NOT NULL.
- Composite UNIQUEs as listed in `/docs/data-schema.md`.
- `territories` PK is `(user_id, type)`.
- `landmarks` PK is `(user_id, tech_key)`.
- `activity_territories` PK is `(activity_id, territory_type)`.

### 2. `lib/db/client.ts`

Drizzle client wired to `DATABASE_URL`. Mark `import 'server-only'`. Export a singleton `db` instance using the chosen driver (`postgres` or `pg`). Stick to `postgres` if no strong reason otherwise; it works well with Supabase.

### 3. `lib/db/queries/` placeholder

Create empty files `users.ts`, `repositories.ts`, `activities.ts`, `territories.ts`, `landmarks.ts`, `sync_jobs.ts`, `weekly_recaps.ts`, `email_sends.ts`. Each just exports an empty object for now; later phases populate them. Add `import 'server-only'` to each.

### 4. Initial migration SQL

Run `npm run db:generate` to produce the Drizzle migration. Then **manually create an additional migration** (e.g. `drizzle/migrations/0001_rls_and_triggers.sql`) containing the operations Drizzle Kit cannot generate from schema alone:

#### a. Extensions

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

#### b. `handle_new_user` trigger (auth.users → public.users)

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, github_id, github_login, display_username, email, avatar_url)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'provider_id')::bigint,
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'user_name',
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### c. RLS policies (every table)

Enable RLS on every public table. Then for each, define explicit SELECT / INSERT / UPDATE / DELETE policies referencing `auth.uid()`. Summary table to encode:

| Table | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `users` | `id = auth.uid() OR is_public = true` | self only (UPDATE); INSERT via trigger |
| `repositories` | `user_id = auth.uid()` | self only |
| `activities` | `user_id = auth.uid()` | server only via service role |
| `activity_territories` | via parent activity | service role only |
| `territories` | `user_id = auth.uid() OR user_id IN (SELECT id FROM users WHERE is_public)` | service role only |
| `landmarks` | `user_id = auth.uid() OR user_id IN (SELECT id FROM users WHERE is_public)` | service role only |
| `sync_jobs` | `user_id = auth.uid()` | service role only |
| `weekly_recaps` | `user_id = auth.uid()` | service role only |
| `email_sends` | `user_id = auth.uid()` | service role only |

Important: server-side service role bypasses RLS — that is the intended path for sync/recap writes. End-user mutations are limited to `users` (Settings) only.

#### d. `users_public_view`

```sql
CREATE VIEW public.users_public_view AS
SELECT id, display_username, avatar_url, is_public, created_at
FROM public.users
WHERE is_public = true;

GRANT SELECT ON public.users_public_view TO anon, authenticated;
```

This view is the only path that `anon` role can use to read user data. The view explicitly omits `email`, `github_access_token_enc`, `github_refresh_token_enc`, `timezone`, `email_recap_enabled`, sync cursor columns, etc.

#### e. Realtime publication

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.territories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.landmarks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_jobs;
```

Do NOT add `activities` — too noisy.

#### f. Indexes

All indexes from `/docs/data-schema.md` §Indexes. Drizzle can declare some of them inline; ensure the rest are in the migration SQL.

### 5. pgcrypto encryption helpers

Document (in `lib/db/encryption.ts`, `import 'server-only'`) two functions:

```ts
export async function encryptToken(plaintext: string): Promise<Buffer>
export async function decryptToken(ciphertext: Buffer): Promise<string>
```

Implementation uses `pgcrypto`'s `pgp_sym_encrypt`/`pgp_sym_decrypt` via SQL calls. The key MUST come from Supabase Vault — read it via a server-side Supabase admin client call to `vault.secrets`. For Phase 2, the helper can be skeletal (real wiring requires the Vault secret to exist in the prod Supabase project); add a clear TODO referencing Phase 3/4 if the Vault key is not yet set up. The function signatures and types must compile.

### 6. RLS isolation integration test

Create `tests/integration/rls-isolation.test.ts`. Use Vitest with the dev Supabase project (env-gated; if `TEST_SUPABASE_URL` is missing, mark tests as `skipIf`). The test should:

1. Create two test users via Supabase Auth admin API.
2. Insert sample rows owned by user A.
3. Assert that a session impersonating user B cannot SELECT user A's rows from `territories`, `landmarks`, `repositories`, `activities`, `sync_jobs`, `weekly_recaps`, `email_sends`.
4. Assert that user B CAN read user A's `territories` and `landmarks` if user A has `is_public = true` and the read goes through the corresponding policy.
5. Clean up at the end.

If a local Supabase dev project is not available at test time, the test must skip gracefully (do not hard-fail in CI without env). Provide a `tests/integration/README.md` snippet explaining the env vars.

### 7. Schema type sanity check

Create `tests/unit/schema.test.ts` that imports `lib/db/schema` and asserts the Drizzle table objects are defined (compile-time check). This is fast and runs even without a DB.

## Acceptance Criteria

```bash
npm run typecheck
npm run build
npm run db:generate    # produces a new migration; commit it
test -f drizzle/migrations/0001_rls_and_triggers.sql || ls drizzle/migrations/*.sql
npm test -- schema
```

## How to verify AC

Run the AC commands above. The `npm run db:generate` step should run without errors against the schema files. Migration files must exist under `drizzle/migrations/`.

If all pass, set this phase's status to `"completed"` in `/tasks/0-mvp/index.json`.

If RLS integration tests cannot run because no Supabase is reachable, they should be `skipIf`'d, NOT failed. Other tests must pass. If you cannot make AC pass after 3 attempts, set status to `"error"`.

## Notes

- Do NOT seed any data in this phase. Schema and policies only.
- Do NOT introduce a separate `db.transaction` helper here — that comes in Phase 6 where it's actually used.
- The `users.id` FK to `auth.users.id` is critical: it allows CASCADE delete of all user data when the auth account is removed.
- If Drizzle does not natively support `bytea`, use `customType<{ data: Buffer }>` patterns from the Drizzle docs.
- All identifiers, comments, and migration SQL comments in English.
- Do NOT remove `MVP_INCLUDE_PRIVATE`-related semantics from the schema — `repositories` table is source-agnostic and does not store an `is_private` flag in MVP. That column is intentionally absent (private repos out of scope).
