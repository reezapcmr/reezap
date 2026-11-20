GRANT SELECT (
  id, username, display_name, avatar_url, bio, town_id, neighborhood_id, language,
  is_vendor, is_verified, is_premium, premium_until, username_changed_at,
  notify_follows, notify_moderation, notify_likes, phone_verified_at, created_at, updated_at
) ON public.profiles TO anon, authenticated;