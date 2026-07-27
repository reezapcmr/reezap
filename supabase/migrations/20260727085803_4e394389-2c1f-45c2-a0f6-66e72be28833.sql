
REVOKE ALL ON FUNCTION public.enforce_listing_limits() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_listing_media_update() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_username_change() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_follow_created() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_verification_reviewed() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_report_resolved() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_listing_created() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.repost_listing(uuid) FROM anon;
