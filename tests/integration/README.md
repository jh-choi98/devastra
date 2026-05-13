# Integration Tests

Integration tests run against a real Supabase project. They require the following environment variables set in `.env.test` (git-ignored):

| Variable | Description |
|---|---|
| `TEST_SUPABASE_URL` | URL of the Supabase dev project (e.g. `https://abcdefg.supabase.co`) |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS; used for test setup/teardown) |
| `TEST_SUPABASE_ANON_KEY` | Anon key (used for session-impersonation RLS checks) |

If these variables are not set, all tests in this directory are skipped automatically — they will not fail CI.

## Running locally

```bash
cp .env.test.example .env.test  # fill in values from Supabase dashboard
npx vitest run tests/integration --pool=forks
```

## Test isolation

Each test suite creates its own users via the Supabase Auth admin API and cleans them up in `afterAll`. CASCADE deletes on `auth.users` remove all related rows automatically.
