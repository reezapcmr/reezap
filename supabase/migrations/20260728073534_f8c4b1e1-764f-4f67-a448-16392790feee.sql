-- Stop anonymous/other users from reading phone numbers in bulk.
REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, username, display_name, avatar_url, bio, town_id, neighborhood_id, language,
  is_vendor, is_verified, is_premium, premium_until, username_changed_at,
  notify_follows, notify_moderation, created_at, updated_at
) ON public.profiles TO anon, authenticated;

GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Contact number is exposed one vendor at a time, only for vendors who
-- actually have listings, or to the owner of the profile.
CREATE OR REPLACE FUNCTION public.get_vendor_whatsapp(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.whatsapp
  FROM public.profiles p
  WHERE p.id = p_user_id
    AND (
      p.id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.listings l WHERE l.vendor_id = p.id)
    )
$$;

REVOKE ALL ON FUNCTION public.get_vendor_whatsapp(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_vendor_whatsapp(uuid) TO anon, authenticated, service_role;