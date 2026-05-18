-- Supabase linter: keep the public profile view running with the querying
-- role's permissions instead of the view owner's permissions.
CREATE OR REPLACE VIEW public.users_public_view
WITH (security_invoker = true) AS
  SELECT id, display_username, avatar_url, is_public, created_at
  FROM public.users
  WHERE is_public = true;

GRANT SELECT ON public.users_public_view TO anon, authenticated;
