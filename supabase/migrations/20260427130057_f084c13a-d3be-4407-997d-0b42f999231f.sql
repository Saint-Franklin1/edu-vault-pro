-- 1) Fix profiles public read: drop overly permissive policy and create a SECURITY DEFINER RPC for verify page
DROP POLICY IF EXISTS "public read minimal profile for verify" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_public_profile(_user_id uuid)
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  WHERE p.id = _user_id
    AND p.deleted_at IS NULL
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;

-- 2) Fix documents public read: restrict to authenticated users and only expose minimal verification metadata via RPC
DROP POLICY IF EXISTS "public read verified docs" ON public.documents;

CREATE POLICY "authenticated read verified docs minimal"
ON public.documents FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND status = 'verified'::document_status
  AND deleted_at IS NULL
);

CREATE OR REPLACE FUNCTION public.get_public_verified_documents(_user_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  verified_at timestamptz,
  created_at timestamptz,
  mime_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.title, d.verified_at, d.created_at, d.mime_type
  FROM public.documents d
  WHERE d.user_id = _user_id
    AND d.status = 'verified'::document_status
    AND d.deleted_at IS NULL
  ORDER BY d.verified_at DESC NULLS LAST
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_verified_documents(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_verified_documents(uuid) TO anon, authenticated;

-- 3) Fix storage geo-scope for student-documents: restore admin_can_access_user check (super_admin still passes through)
DROP POLICY IF EXISTS "admins read student documents" ON storage.objects;

CREATE POLICY "admins read student documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'student-documents'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.admin_can_access_user(((storage.foldername(name))[1])::uuid)
  )
);

-- 4) Add UPDATE policies for storage buckets so updates are explicitly controlled
DROP POLICY IF EXISTS "owners update student documents" ON storage.objects;
CREATE POLICY "owners update student documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'student-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'student-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "chief update own letters" ON storage.objects;
CREATE POLICY "chief update own letters"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chief-letters'
  AND public.has_role(auth.uid(), 'chief')
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'chief-letters'
  AND public.has_role(auth.uid(), 'chief')
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5) Lock down log_action RPC so only trusted server-side callers (definer functions) can invoke it
REVOKE EXECUTE ON FUNCTION public.log_action(text, text, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_action(text, text, uuid, jsonb) FROM anon, authenticated;

-- 6) Tighten audit_logs INSERT policy: prevent forging entries with another user_id
DROP POLICY IF EXISTS "authenticated insert audit" ON public.audit_logs;
CREATE POLICY "users insert own audit only"
ON public.audit_logs FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
);

-- 7) Remove hardcoded super_admin email backdoor from handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END
$function$;

-- 8) Lock down SECURITY DEFINER helper functions so anon/authenticated cannot call them directly via PostgREST.
-- They remain callable from RLS / other definer functions because postgres role retains EXECUTE.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_can_access_user(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_geo() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_geo() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_doc_approval() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_document() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_bursary() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_bursary_application() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_profile_geo() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_profile_geo_after_role() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;