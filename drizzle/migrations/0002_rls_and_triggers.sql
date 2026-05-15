-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- FK: users.id → auth.users(id) ON DELETE CASCADE
ALTER TABLE public.users
  ADD CONSTRAINT users_auth_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── RLS ─────────────────────────────────────────────────────────────────────

-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_public = true);

CREATE POLICY "users_update" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- repositories
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repositories_select" ON public.repositories
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "repositories_insert" ON public.repositories
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "repositories_update" ON public.repositories
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "repositories_delete" ON public.repositories
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- activities (writes go through service role only)
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activities_select" ON public.activities
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- activity_territories (read via parent activity; writes via service role)
ALTER TABLE public.activity_territories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_territories_select" ON public.activity_territories
  FOR SELECT TO authenticated
  USING (
    activity_id IN (
      SELECT id FROM public.activities WHERE user_id = auth.uid()
    )
  );

-- territories (service role handles writes)
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "territories_select" ON public.territories
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.users WHERE is_public = true)
  );

-- landmarks (service role handles writes)
ALTER TABLE public.landmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "landmarks_select" ON public.landmarks
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.users WHERE is_public = true)
  );

-- sync_jobs (service role handles writes)
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_jobs_select" ON public.sync_jobs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- weekly_recaps (service role handles writes)
ALTER TABLE public.weekly_recaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_recaps_select" ON public.weekly_recaps
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- email_sends (service role handles writes)
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_sends_select" ON public.email_sends
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── Public view (anon-safe, columns restricted) ──────────────────────────────

CREATE VIEW public.users_public_view AS
  SELECT id, display_username, avatar_url, is_public, created_at
  FROM public.users
  WHERE is_public = true;

GRANT SELECT ON public.users_public_view TO anon, authenticated;

-- ── Realtime publication ─────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.territories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.landmarks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_jobs;
