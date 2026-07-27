
-- Anonymous visitors may read only non-sensitive profile columns (no whatsapp).
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, username, display_name, avatar_url, bio, town_id, neighborhood_id,
  language, is_vendor, is_verified, is_premium, created_at, updated_at
) ON public.profiles TO anon;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Users can see the status of their own verification requests.
DROP POLICY IF EXISTS verif_read_own ON public.verification_requests;
CREATE POLICY verif_read_own ON public.verification_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
