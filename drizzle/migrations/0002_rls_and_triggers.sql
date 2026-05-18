-- Idempotent — safe to re-run on a database that already has the policies/triggers/view.
-- This file was originally authored as 0001_rls_and_triggers.sql and applied manually to
-- dev environments. It is now journaled as 0002 so a fresh `drizzle-kit migrate` picks it up
-- automatically.

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- FK: users.id → auth.users(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_auth_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'users'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_auth_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Trigger: mirror auth.users → public.users on signup
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── RLS ─────────────────────────────────────────────────────────────────────

-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select" ON public.users;
CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_public = true);

DROP POLICY IF EXISTS "users_update" ON public.users;
CREATE POLICY "users_update" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- repositories
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "repositories_select" ON public.repositories;
CREATE POLICY "repositories_select" ON public.repositories
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "repositories_insert" ON public.repositories;
CREATE POLICY "repositories_insert" ON public.repositories
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "repositories_update" ON public.repositories;
CREATE POLICY "repositories_update" ON public.repositories
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "repositories_delete" ON public.repositories;
CREATE POLICY "repositories_delete" ON public.repositories
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- activities (writes go through service role only)
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_select" ON public.activities;
CREATE POLICY "activities_select" ON public.activities
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- activity_territories (read via parent activity; writes via service role)
ALTER TABLE public.activity_territories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_territories_select" ON public.activity_territories;
CREATE POLICY "activity_territories_select" ON public.activity_territories
  FOR SELECT TO authenticated
  USING (
    activity_id IN (
      SELECT id FROM public.activities WHERE user_id = auth.uid()
    )
  );

-- territories (service role handles writes)
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "territories_select" ON public.territories;
CREATE POLICY "territories_select" ON public.territories
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.users WHERE is_public = true)
  );

-- landmarks (service role handles writes)
ALTER TABLE public.landmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "landmarks_select" ON public.landmarks;
CREATE POLICY "landmarks_select" ON public.landmarks
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.users WHERE is_public = true)
  );

-- sync_jobs (service role handles writes)
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sync_jobs_select" ON public.sync_jobs;
CREATE POLICY "sync_jobs_select" ON public.sync_jobs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- weekly_recaps (service role handles writes)
ALTER TABLE public.weekly_recaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_recaps_select" ON public.weekly_recaps;
CREATE POLICY "weekly_recaps_select" ON public.weekly_recaps
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- email_sends (service role handles writes)
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_sends_select" ON public.email_sends;
CREATE POLICY "email_sends_select" ON public.email_sends
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── Public view (anon-safe, columns restricted) ──────────────────────────────

CREATE OR REPLACE VIEW public.users_public_view AS
  SELECT id, display_username, avatar_url, is_public, created_at
  FROM public.users
  WHERE is_public = true;

GRANT SELECT ON public.users_public_view TO anon, authenticated;

-- ── Realtime publication ─────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'territories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.territories;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'landmarks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.landmarks;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sync_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_jobs;
  END IF;
END$$;
