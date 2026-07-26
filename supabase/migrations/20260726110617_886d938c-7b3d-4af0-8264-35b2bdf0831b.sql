
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
CREATE TYPE public.listing_status AS ENUM ('in_stock','sold_out_today');
CREATE TYPE public.verification_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.report_reason AS ENUM ('spam','inappropriate','fake','fraud','other');
CREATE TYPE public.report_target AS ENUM ('listing','profile','review');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  bio text,
  whatsapp text,
  town_id uuid,
  neighborhood_id uuid,
  language text NOT NULL DEFAULT 'en',
  is_vendor boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_read_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.towns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division text NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (division, name)
);
GRANT SELECT ON public.towns TO anon, authenticated;
GRANT ALL ON public.towns TO service_role;
ALTER TABLE public.towns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "towns_public_read" ON public.towns FOR SELECT USING (true);

CREATE TABLE public.neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  town_id uuid NOT NULL REFERENCES public.towns(id) ON DELETE CASCADE,
  name text NOT NULL,
  UNIQUE (town_id, name)
);
GRANT SELECT ON public.neighborhoods TO anon, authenticated;
GRANT ALL ON public.neighborhoods TO service_role;
ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "neighborhoods_public_read" ON public.neighborhoods FOR SELECT USING (true);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  name_fr text,
  emoji text,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (true);

ALTER TABLE public.profiles ADD CONSTRAINT profiles_town_fk FOREIGN KEY (town_id) REFERENCES public.towns(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_neighborhood_fk FOREIGN KEY (neighborhood_id) REFERENCES public.neighborhoods(id) ON DELETE SET NULL;

CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  price numeric,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  town_id uuid REFERENCES public.towns(id) ON DELETE SET NULL,
  neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
  media_url text,
  media_type text NOT NULL DEFAULT 'image',
  voice_note_url text,
  status public.listing_status NOT NULL DEFAULT 'in_stock',
  view_count int NOT NULL DEFAULT 0,
  whatsapp_click_count int NOT NULL DEFAULT 0,
  is_flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listings_created_idx ON public.listings (created_at DESC);
CREATE INDEX listings_vendor_idx ON public.listings (vendor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT SELECT ON public.listings TO anon;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listings_public_read" ON public.listings FOR SELECT USING (true);
CREATE POLICY "listings_insert_own" ON public.listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = vendor_id);
CREATE POLICY "listings_update_own" ON public.listings FOR UPDATE TO authenticated USING (auth.uid() = vendor_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = vendor_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "listings_delete_own" ON public.listings FOR DELETE TO authenticated USING (auth.uid() = vendor_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, vendor_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT SELECT ON public.follows TO anon;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_public_read" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

CREATE TABLE public.likes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;
GRANT SELECT ON public.likes TO anon;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_public_read" ON public.likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_own" ON public.likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_own" ON public.likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.bookmarks (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
GRANT SELECT, INSERT, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookmarks_own" ON public.bookmarks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  body text,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_read_own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  vendor_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, author_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratings TO authenticated;
GRANT SELECT ON public.ratings TO anon;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings_public_read" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert_own" ON public.ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND auth.uid() <> vendor_id);
CREATE POLICY "ratings_update_author_or_vendor" ON public.ratings FOR UPDATE TO authenticated USING (auth.uid() = author_id OR auth.uid() = vendor_id) WITH CHECK (auth.uid() = author_id OR auth.uid() = vendor_id);
CREATE POLICY "ratings_delete_own" ON public.ratings FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TABLE public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_path text NOT NULL,
  full_name text,
  status public.verification_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.verification_requests TO authenticated;
GRANT ALL ON public.verification_requests TO service_role;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verif_admin_read" ON public.verification_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "verif_insert_own" ON public.verification_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "verif_admin_update" ON public.verification_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type public.report_target NOT NULL,
  target_id uuid NOT NULL,
  reason public.report_reason NOT NULL,
  details text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_read_own_or_admin" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "reports_admin_update" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_own" ON public.blocks FOR ALL TO authenticated USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_read" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit_admin_insert" ON public.admin_audit_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND admin_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER listings_updated BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.on_listing_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET is_vendor = true WHERE id = NEW.vendor_id AND is_vendor = false;
  INSERT INTO public.notifications (user_id, kind, title, body, listing_id, actor_id)
  SELECT f.follower_id, 'new_listing',
         COALESCE(p.display_name, p.username) || ' posted a new listing',
         NEW.title, NEW.id, NEW.vendor_id
  FROM public.follows f JOIN public.profiles p ON p.id = NEW.vendor_id
  WHERE f.vendor_id = NEW.vendor_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER listings_after_insert AFTER INSERT ON public.listings FOR EACH ROW EXECUTE FUNCTION public.on_listing_created();

CREATE POLICY "listing_media_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'listing-media');
CREATE POLICY "listing_media_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'listing-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "listing_media_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'listing-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_write_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "id_docs_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'id-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "id_docs_admin_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'id-documents' AND public.has_role(auth.uid(),'admin'));
