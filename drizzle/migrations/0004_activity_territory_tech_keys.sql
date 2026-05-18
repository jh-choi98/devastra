ALTER TABLE public.activity_territories
  ADD COLUMN IF NOT EXISTS tech_keys text[] NOT NULL DEFAULT '{}'::text[];
