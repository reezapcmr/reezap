-- Counters so public pages no longer need to read raw likes/follows rows
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS follower_count integer NOT NULL DEFAULT 0;
UPDATE public.listings l SET like_count = (SELECT count(*) FROM public.likes k WHERE k.listing_id = l.id);
UPDATE public.profiles p SET follower_count = (SELECT count(*) FROM public.follows f WHERE f.vendor_id = p.id);
GRANT SELECT (like_count) ON public.listings TO anon, authenticated;
GRANT SELECT (follower_count) ON public.profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_like_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.listings SET like_count = like_count + 1 WHERE id = NEW.listing_id;
  ELSE
    UPDATE public.listings SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.listing_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE OR REPLACE FUNCTION public.sync_follower_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET follower_count = follower_count + 1 WHERE id = NEW.vendor_id;
  ELSE
    UPDATE public.profiles SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.vendor_id;
  END IF;
  RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.sync_like_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_follower_count() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_sync_like_count ON public.likes;
CREATE TRIGGER trg_sync_like_count AFTER INSERT OR DELETE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.sync_like_count();
DROP TRIGGER IF EXISTS trg_sync_follower_count ON public.follows;
CREATE TRIGGER trg_sync_follower_count AFTER INSERT OR DELETE ON public.follows FOR EACH ROW EXECUTE FUNCTION public.sync_follower_count();

-- likes: only your own
DROP POLICY IF EXISTS likes_public_read ON public.likes;
CREATE POLICY likes_read_own ON public.likes FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- follows: only rows you are part of
DROP POLICY IF EXISTS follows_public_read ON public.follows;
CREATE POLICY follows_read_involved ON public.follows FOR SELECT TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = vendor_id);

-- profiles: vendors are public; other people only when relevant to you
DROP POLICY IF EXISTS profiles_public_read ON public.profiles;
CREATE POLICY profiles_read_scoped ON public.profiles FOR SELECT
  USING (
    is_vendor
    OR id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.ratings r WHERE r.author_id = profiles.id)
    OR EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = profiles.id AND f.vendor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.blocks b WHERE b.blocked_id = profiles.id AND b.blocker_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.notifications n WHERE n.actor_id = profiles.id AND n.user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.is_username_available(p_username text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = lower(p_username))
$$;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;

-- storage: no open reads; owners read their own, everything else is signed server-side
DROP POLICY IF EXISTS listing_media_public_read ON storage.objects;
DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
CREATE POLICY listing_media_read_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'listing-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_read_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);