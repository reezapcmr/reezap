ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_likes boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.on_like_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_owner uuid; v_title text; v_name text; v_enabled boolean;
BEGIN
  SELECT vendor_id, title INTO v_owner, v_title FROM public.listings WHERE id = NEW.listing_id;
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT notify_likes INTO v_enabled FROM public.profiles WHERE id = v_owner;
  IF NOT COALESCE(v_enabled, true) THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, username) INTO v_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, kind, title, body, listing_id, actor_id)
  VALUES (v_owner, 'like', COALESCE(v_name, 'Someone') || ' liked your listing', v_title, NEW.listing_id, NEW.user_id);
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.on_like_created() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_verification_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'pending' THEN
    UPDATE public.profiles
       SET is_verified = (NEW.status = 'approved'), updated_at = now()
     WHERE id = NEW.user_id;

    IF NEW.reviewed_at IS NULL THEN NEW.reviewed_at := now(); END IF;

    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (NEW.user_id, 'moderation',
      CASE WHEN NEW.status = 'approved' THEN 'You are verified' ELSE 'Verification not approved' END,
      COALESCE(NEW.notes, CASE WHEN NEW.status = 'approved'
        THEN 'Your trust badge is now live on your profile.'
        ELSE 'Please submit a clearer photo of a valid government ID.' END));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_on_like_created ON public.likes;
CREATE TRIGGER trg_on_like_created AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.on_like_created();

DROP TRIGGER IF EXISTS trg_on_follow_created ON public.follows;
CREATE TRIGGER trg_on_follow_created AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.on_follow_created();

DROP TRIGGER IF EXISTS trg_on_listing_created ON public.listings;
CREATE TRIGGER trg_on_listing_created AFTER INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.on_listing_created();

DROP TRIGGER IF EXISTS trg_enforce_listing_limits ON public.listings;
CREATE TRIGGER trg_enforce_listing_limits BEFORE INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_limits();

DROP TRIGGER IF EXISTS trg_enforce_listing_media_update ON public.listings;
CREATE TRIGGER trg_enforce_listing_media_update BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_media_update();

DROP TRIGGER IF EXISTS trg_listings_updated_at ON public.listings;
CREATE TRIGGER trg_listings_updated_at BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_enforce_username_change ON public.profiles;
CREATE TRIGGER trg_enforce_username_change BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_username_change();

DROP TRIGGER IF EXISTS trg_on_report_resolved ON public.reports;
CREATE TRIGGER trg_on_report_resolved AFTER UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.on_report_resolved();

DROP TRIGGER IF EXISTS trg_on_verification_reviewed ON public.verification_requests;
CREATE TRIGGER trg_on_verification_reviewed BEFORE UPDATE ON public.verification_requests
FOR EACH ROW EXECUTE FUNCTION public.on_verification_reviewed();
