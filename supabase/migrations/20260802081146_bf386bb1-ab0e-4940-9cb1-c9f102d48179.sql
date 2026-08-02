-- Trigger-only SECURITY DEFINER functions: not meant to be called via the API
REVOKE ALL ON FUNCTION public.enforce_listing_limits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_follow_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_like_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_listing_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_report_resolved() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_verification_reviewed() FROM PUBLIC, anon, authenticated;

-- App-facing RPCs: keep only the access each one actually needs
REVOKE ALL ON FUNCTION public.increment_listing_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_listing_view(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.increment_whatsapp_click(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_whatsapp_click(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_vendor_whatsapp(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_whatsapp(uuid) TO anon, authenticated;

-- Repost is an owner-only action; the function itself checks auth.uid()
REVOKE ALL ON FUNCTION public.repost_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repost_listing(uuid) TO authenticated;

-- has_role is required by RLS policies evaluated as the calling role
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;