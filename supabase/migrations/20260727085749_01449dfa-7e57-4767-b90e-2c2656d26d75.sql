
-- 1. Listings: gallery, expiry, pinning
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

UPDATE public.listings SET media_urls = ARRAY[media_url]
  WHERE media_url IS NOT NULL AND cardinality(media_urls) = 0;

CREATE INDEX IF NOT EXISTS listings_expires_idx ON public.listings (expires_at DESC);
CREATE INDEX IF NOT EXISTS listings_vendor_created_idx ON public.listings (vendor_id, created_at DESC);

-- 2. Profiles: premium, username change tracking, preferences
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_until timestamptz,
  ADD COLUMN IF NOT EXISTS username_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS notify_follows boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_moderation boolean NOT NULL DEFAULT true;

-- 3. Mutengene neighborhood under Tiko
INSERT INTO public.neighborhoods (town_id, name)
SELECT t.id, 'Mutengene' FROM public.towns t
WHERE t.name = 'Tiko'
  AND NOT EXISTS (
    SELECT 1 FROM public.neighborhoods n WHERE n.town_id = t.id AND n.name = 'Mutengene'
  );

-- 4. Counter RPCs (RLS blocks direct updates on other people's listings)
CREATE OR REPLACE FUNCTION public.increment_listing_view(p_listing_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.listings SET view_count = view_count + 1 WHERE id = p_listing_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_whatsapp_click(p_listing_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.listings SET whatsapp_click_count = whatsapp_click_count + 1 WHERE id = p_listing_id;
$$;

REVOKE ALL ON FUNCTION public.increment_listing_view(uuid) FROM public;
REVOKE ALL ON FUNCTION public.increment_whatsapp_click(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_listing_view(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_whatsapp_click(uuid) TO anon, authenticated;

-- 5. Repost an expired listing (owner only)
CREATE OR REPLACE FUNCTION public.repost_listing(p_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_premium boolean; v_days int;
BEGIN
  SELECT vendor_id INTO v_owner FROM public.listings WHERE id = p_listing_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT (is_premium AND (premium_until IS NULL OR premium_until > now())) INTO v_premium
  FROM public.profiles WHERE id = v_owner;
  v_days := CASE WHEN v_premium THEN 7 ELSE 2 END;
  UPDATE public.listings
     SET created_at = now(), expires_at = now() + (v_days || ' days')::interval, status = 'in_stock'
   WHERE id = p_listing_id;
END; $$;

REVOKE ALL ON FUNCTION public.repost_listing(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.repost_listing(uuid) TO authenticated;

-- 6. Daily post limit (7/day, unlimited for premium) + expiry window on insert
CREATE OR REPLACE FUNCTION public.enforce_listing_limits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_premium boolean; v_today int;
BEGIN
  SELECT (is_premium AND (premium_until IS NULL OR premium_until > now())) INTO v_premium
  FROM public.profiles WHERE id = NEW.vendor_id;
  v_premium := COALESCE(v_premium, false);

  IF NOT v_premium THEN
    SELECT count(*) INTO v_today FROM public.listings
     WHERE vendor_id = NEW.vendor_id AND created_at >= date_trunc('day', now());
    IF v_today >= 7 THEN
      RAISE EXCEPTION 'daily_post_limit_reached';
    END IF;
    NEW.is_pinned := false;
  END IF;

  IF cardinality(COALESCE(NEW.media_urls, '{}')) > 3 THEN
    RAISE EXCEPTION 'max_three_photos';
  END IF;

  NEW.expires_at := now() + (CASE WHEN v_premium THEN interval '7 days' ELSE interval '48 hours' END);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS listings_enforce_limits ON public.listings;
CREATE TRIGGER listings_enforce_limits BEFORE INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_limits();

CREATE OR REPLACE FUNCTION public.enforce_listing_media_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF cardinality(COALESCE(NEW.media_urls, '{}')) > 3 THEN
    RAISE EXCEPTION 'max_three_photos';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS listings_media_update ON public.listings;
CREATE TRIGGER listings_media_update BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_media_update();

-- 7. Username change: once per year
CREATE OR REPLACE FUNCTION public.enforce_username_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    IF OLD.username_changed_at IS NOT NULL AND OLD.username_changed_at > now() - interval '365 days' THEN
      RAISE EXCEPTION 'username_change_too_soon';
    END IF;
    IF NEW.username !~ '^[a-z0-9_]{3,20}$' THEN
      RAISE EXCEPTION 'invalid_username';
    END IF;
    NEW.username_changed_at := now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_username_change ON public.profiles;
CREATE TRIGGER profiles_username_change BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_username_change();

-- 8. Follow notifications
CREATE OR REPLACE FUNCTION public.on_follow_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_enabled boolean;
BEGIN
  SELECT notify_follows INTO v_enabled FROM public.profiles WHERE id = NEW.vendor_id;
  IF COALESCE(v_enabled, true) THEN
    SELECT COALESCE(display_name, username) INTO v_name FROM public.profiles WHERE id = NEW.follower_id;
    INSERT INTO public.notifications (user_id, kind, title, body, actor_id)
    VALUES (NEW.vendor_id, 'new_follower', COALESCE(v_name, 'Someone') || ' started following you',
            'They will see your new listings in their feed.', NEW.follower_id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS follows_notify ON public.follows;
CREATE TRIGGER follows_notify AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.on_follow_created();

-- 9. Moderation / verification notifications
CREATE OR REPLACE FUNCTION public.on_verification_reviewed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'pending' THEN
    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (NEW.user_id, 'moderation',
      CASE WHEN NEW.status = 'approved' THEN 'You are verified' ELSE 'Verification not approved' END,
      COALESCE(NEW.notes, CASE WHEN NEW.status = 'approved'
        THEN 'Your trust badge is now live on your profile.'
        ELSE 'Please submit a clearer photo of a valid government ID.' END));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS verification_notify ON public.verification_requests;
CREATE TRIGGER verification_notify AFTER UPDATE ON public.verification_requests
FOR EACH ROW EXECUTE FUNCTION public.on_verification_reviewed();

CREATE OR REPLACE FUNCTION public.on_report_resolved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.resolved AND NOT OLD.resolved THEN
    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (NEW.reporter_id, 'moderation', 'Your report was reviewed',
            'Thanks for helping keep Reezap safe. Our team has actioned your report.');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS reports_notify ON public.reports;
CREATE TRIGGER reports_notify AFTER UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.on_report_resolved();

-- Re-attach previously defined triggers that were missing
DROP TRIGGER IF EXISTS listings_created ON public.listings;
CREATE TRIGGER listings_created AFTER INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.on_listing_created();

DROP TRIGGER IF EXISTS listings_updated_at ON public.listings;
CREATE TRIGGER listings_updated_at BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. Realtime notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 11. Privacy: hide phone numbers from unauthenticated visitors
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, username, display_name, avatar_url, bio, town_id, neighborhood_id,
              language, is_vendor, is_verified, is_premium, created_at, updated_at)
  ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
