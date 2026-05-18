ALTER TABLE public.repositories
  ADD COLUMN IF NOT EXISTS commits_fetched_source_pushed_at timestamptz;
