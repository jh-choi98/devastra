ALTER TABLE public.repositories
  ADD COLUMN IF NOT EXISTS source_pushed_at timestamptz,
  ADD COLUMN IF NOT EXISTS manifest_context jsonb,
  ADD COLUMN IF NOT EXISTS manifest_source_pushed_at timestamptz,
  ADD COLUMN IF NOT EXISTS manifest_cached_at timestamptz;
