ALTER TABLE public.repositories
  ADD COLUMN IF NOT EXISTS historical_bootstrap_source_pushed_at timestamptz,
  ADD COLUMN IF NOT EXISTS historical_bootstrap_checked_at timestamptz;
