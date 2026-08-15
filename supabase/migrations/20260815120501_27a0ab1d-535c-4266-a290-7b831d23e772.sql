ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_verifications_code_idx ON public.phone_verifications (code) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS phone_verifications_user_idx ON public.phone_verifications (user_id);

GRANT SELECT ON public.phone_verifications TO authenticated;
GRANT ALL ON public.phone_verifications TO service_role;

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phone_verifications_read_own" ON public.phone_verifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.start_phone_verification(p_phone text)
RETURNS TABLE (code text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_code text; v_exp timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_phone !~ '^\+237[26][0-9]{8}$' THEN RAISE EXCEPTION 'invalid_phone'; END IF;

  IF (SELECT count(*) FROM public.phone_verifications
        WHERE user_id = v_uid AND created_at > now() - interval '10 minutes') >= 5 THEN
    RAISE EXCEPTION 'too_many_attempts';
  END IF;

  UPDATE public.phone_verifications SET consumed_at = now()
   WHERE user_id = v_uid AND consumed_at IS NULL;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_exp := now() + interval '10 minutes';

  INSERT INTO public.phone_verifications (user_id, phone, code, expires_at)
  VALUES (v_uid, p_phone, v_code, v_exp);

  UPDATE public.profiles SET whatsapp = p_phone WHERE id = v_uid;

  RETURN QUERY SELECT v_code, v_exp;
END; $$;

REVOKE EXECUTE ON FUNCTION public.start_phone_verification(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_phone_verification(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_phone_verification(p_code text, p_from_phone text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.phone_verifications%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.phone_verifications
   WHERE code = p_code AND consumed_at IS NULL AND expires_at > now()
   ORDER BY created_at DESC LIMIT 1;

  IF v_row.id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.phone_verifications SET consumed_at = now() WHERE id = v_row.id;

  UPDATE public.profiles
     SET phone_verified_at = now(),
         whatsapp = COALESCE(NULLIF(p_from_phone, ''), whatsapp),
         updated_at = now()
   WHERE id = v_row.user_id;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (v_row.user_id, 'moderation', 'WhatsApp number verified',
          'Your trust badge is now live on your Reezap profile.');

  RETURN v_row.user_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.confirm_phone_verification(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_phone_verification(text, text) TO service_role;