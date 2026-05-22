ALTER TABLE public.repositories
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS repositories_user_is_available_idx
  ON public.repositories (user_id, is_available);
