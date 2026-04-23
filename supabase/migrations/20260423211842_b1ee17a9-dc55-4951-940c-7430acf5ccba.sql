
-- ============================================================
-- 1. Extend documents with chief workflow columns
-- ============================================================
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS chief_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chief_approved_by uuid,
  ADD COLUMN IF NOT EXISTS chief_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS chief_category text,
  ADD COLUMN IF NOT EXISTS chief_notes text,
  ADD COLUMN IF NOT EXISTS recommendation_letter_url text;

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_chief_category_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_chief_category_check
  CHECK (chief_category IS NULL OR chief_category IN ('orphan','vulnerable','pwd','other'));

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_approval_order_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_approval_order_check CHECK (
    (NOT ward_approved OR chief_approved)
    AND (NOT constituency_approved OR ward_approved)
    AND (NOT county_approved OR constituency_approved)
  );

-- ============================================================
-- 2. enforce_doc_approval — chief stage + super_admin BLOCKED from approvals
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_doc_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _is_super  boolean := public.has_role(auth.uid(), 'super_admin');
  _is_chief  boolean := public.has_role(auth.uid(), 'chief');
  _is_ward   boolean := public.has_role(auth.uid(), 'ward_admin');
  _is_const  boolean := public.has_role(auth.uid(), 'constituency_admin');
  _is_county boolean := public.has_role(auth.uid(), 'county_admin');
BEGIN
  -- Chief approval transition
  IF NEW.chief_approved IS DISTINCT FROM OLD.chief_approved THEN
    IF NEW.chief_approved = true THEN
      IF NOT _is_chief THEN
        RAISE EXCEPTION 'Only chiefs may grant chief approval';
      END IF;
      NEW.chief_approved_by := auth.uid();
      NEW.chief_approved_at := now();
    ELSE
      IF NOT _is_super THEN
        RAISE EXCEPTION 'Only super admin can revoke chief approval';
      END IF;
      NEW.chief_approved_by := NULL;
      NEW.chief_approved_at := NULL;
      NEW.ward_approved := false;
      NEW.ward_approved_by := NULL;
      NEW.ward_approved_at := NULL;
      NEW.constituency_approved := false;
      NEW.constituency_approved_by := NULL;
      NEW.constituency_approved_at := NULL;
      NEW.county_approved := false;
      NEW.county_approved_by := NULL;
      NEW.county_approved_at := NULL;
    END IF;
  END IF;

  -- Ward approval transition
  IF NEW.ward_approved IS DISTINCT FROM OLD.ward_approved THEN
    IF NEW.ward_approved = true THEN
      IF NOT NEW.chief_approved THEN
        RAISE EXCEPTION 'Ward approval requires chief approval first';
      END IF;
      IF NOT _is_ward THEN
        RAISE EXCEPTION 'Only ward admins may grant ward approval';
      END IF;
      NEW.ward_approved_by := auth.uid();
      NEW.ward_approved_at := now();
    ELSE
      IF NOT _is_super THEN
        RAISE EXCEPTION 'Only super admin can revoke ward approval';
      END IF;
      NEW.ward_approved_by := NULL;
      NEW.ward_approved_at := NULL;
      NEW.constituency_approved := false;
      NEW.constituency_approved_by := NULL;
      NEW.constituency_approved_at := NULL;
      NEW.county_approved := false;
      NEW.county_approved_by := NULL;
      NEW.county_approved_at := NULL;
    END IF;
  END IF;

  -- Constituency approval transition
  IF NEW.constituency_approved IS DISTINCT FROM OLD.constituency_approved THEN
    IF NEW.constituency_approved = true THEN
      IF NOT NEW.ward_approved THEN
        RAISE EXCEPTION 'Constituency approval requires ward approval first';
      END IF;
      IF NOT _is_const THEN
        RAISE EXCEPTION 'Only constituency admins may grant constituency approval';
      END IF;
      NEW.constituency_approved_by := auth.uid();
      NEW.constituency_approved_at := now();
    ELSE
      IF NOT _is_super THEN
        RAISE EXCEPTION 'Only super admin can revoke constituency approval';
      END IF;
      NEW.constituency_approved_by := NULL;
      NEW.constituency_approved_at := NULL;
      NEW.county_approved := false;
      NEW.county_approved_by := NULL;
      NEW.county_approved_at := NULL;
    END IF;
  END IF;

  -- County approval transition
  IF NEW.county_approved IS DISTINCT FROM OLD.county_approved THEN
    IF NEW.county_approved = true THEN
      IF NOT NEW.constituency_approved THEN
        RAISE EXCEPTION 'County approval requires constituency approval first';
      END IF;
      IF NOT _is_county THEN
        RAISE EXCEPTION 'Only county admins may grant county approval';
      END IF;
      NEW.county_approved_by := auth.uid();
      NEW.county_approved_at := now();
    ELSE
      IF NOT _is_super THEN
        RAISE EXCEPTION 'Only super admin can revoke county approval';
      END IF;
      NEW.county_approved_by := NULL;
      NEW.county_approved_at := NULL;
    END IF;
  END IF;

  -- Auto-verify when all four are approved
  IF NEW.chief_approved AND NEW.ward_approved AND NEW.constituency_approved AND NEW.county_approved THEN
    IF NEW.status IS DISTINCT FROM 'verified'::document_status THEN
      NEW.status := 'verified'::document_status;
      NEW.verified_by := auth.uid();
      NEW.verified_at := now();
      NEW.rejection_reason := NULL;
    END IF;
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS enforce_doc_approval_trigger ON public.documents;
CREATE TRIGGER enforce_doc_approval_trigger
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_doc_approval();

-- ============================================================
-- 3. audit_document — log chief approvals
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
    VALUES (auth.uid(), 'document.created', 'document', NEW.id,
      jsonb_build_object('status', NEW.status, 'title', NEW.title));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
      VALUES (auth.uid(), 'document.status_changed', 'document', NEW.id,
        jsonb_build_object('from', OLD.status, 'to', NEW.status, 'reason', NEW.rejection_reason));
    END IF;
    IF OLD.chief_approved IS DISTINCT FROM NEW.chief_approved AND NEW.chief_approved THEN
      INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
      VALUES (auth.uid(), 'document.chief_approved', 'document', NEW.id,
        jsonb_build_object('category', NEW.chief_category));
    END IF;
    IF OLD.ward_approved IS DISTINCT FROM NEW.ward_approved AND NEW.ward_approved THEN
      INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
      VALUES (auth.uid(), 'document.ward_approved', 'document', NEW.id, '{}'::jsonb);
    END IF;
    IF OLD.constituency_approved IS DISTINCT FROM NEW.constituency_approved AND NEW.constituency_approved THEN
      INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
      VALUES (auth.uid(), 'document.constituency_approved', 'document', NEW.id, '{}'::jsonb);
    END IF;
    IF OLD.county_approved IS DISTINCT FROM NEW.county_approved AND NEW.county_approved THEN
      INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
      VALUES (auth.uid(), 'document.county_approved', 'document', NEW.id, '{}'::jsonb);
    END IF;
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
      VALUES (auth.uid(), 'document.deleted', 'document', NEW.id, '{}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- ============================================================
-- 4. is_admin includes chief; admin_can_access_user includes chief at ward
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('chief','ward_admin','constituency_admin','county_admin','super_admin')
  )
$function$;

CREATE OR REPLACE FUNCTION public.admin_can_access_user(_target_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'county_admin')
      AND (SELECT county_id FROM public.profiles WHERE id = auth.uid())
        = (SELECT county_id FROM public.profiles WHERE id = _target_user)
      AND (SELECT county_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    )
    OR (
      public.has_role(auth.uid(), 'constituency_admin')
      AND (SELECT constituency_id FROM public.profiles WHERE id = auth.uid())
        = (SELECT constituency_id FROM public.profiles WHERE id = _target_user)
      AND (SELECT constituency_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    )
    OR (
      public.has_role(auth.uid(), 'ward_admin')
      AND (SELECT ward_id FROM public.profiles WHERE id = auth.uid())
        = (SELECT ward_id FROM public.profiles WHERE id = _target_user)
      AND (SELECT ward_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    )
    OR (
      public.has_role(auth.uid(), 'chief')
      AND (SELECT ward_id FROM public.profiles WHERE id = auth.uid())
        = (SELECT ward_id FROM public.profiles WHERE id = _target_user)
      AND (SELECT ward_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    )
$function$;

-- ============================================================
-- 5. Profile geo validation supports chief
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_profile_geo_after_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _profile public.profiles%ROWTYPE;
  _uid uuid;
BEGIN
  _uid := COALESCE(NEW.user_id, OLD.user_id);
  SELECT * INTO _profile FROM public.profiles WHERE id = _uid;
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.role = 'ward_admin' AND (_profile.ward_id IS NULL OR _profile.constituency_id IS NULL OR _profile.county_id IS NULL) THEN
      RAISE EXCEPTION 'Cannot assign ward_admin: profile missing ward/constituency/county';
    ELSIF NEW.role = 'chief' AND (_profile.ward_id IS NULL OR _profile.constituency_id IS NULL OR _profile.county_id IS NULL) THEN
      RAISE EXCEPTION 'Cannot assign chief: profile missing ward/constituency/county';
    ELSIF NEW.role = 'constituency_admin' AND (_profile.constituency_id IS NULL OR _profile.county_id IS NULL OR _profile.ward_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Cannot assign constituency_admin: profile geo invalid';
    ELSIF NEW.role = 'county_admin' AND (_profile.county_id IS NULL OR _profile.constituency_id IS NOT NULL OR _profile.ward_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Cannot assign county_admin: profile geo invalid';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_profile_geo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
BEGIN
  SELECT role INTO _role
  FROM public.user_roles
  WHERE user_id = NEW.id
  ORDER BY CASE role
    WHEN 'super_admin' THEN 1
    WHEN 'county_admin' THEN 2
    WHEN 'constituency_admin' THEN 3
    WHEN 'ward_admin' THEN 4
    WHEN 'chief' THEN 5
    WHEN 'student' THEN 6
  END
  LIMIT 1;

  IF _role IS NULL THEN
    RETURN NEW;
  END IF;

  IF _role = 'ward_admin' OR _role = 'chief' THEN
    IF NEW.ward_id IS NULL OR NEW.constituency_id IS NULL OR NEW.county_id IS NULL THEN
      RAISE EXCEPTION '% requires county_id, constituency_id, and ward_id', _role;
    END IF;
  ELSIF _role = 'constituency_admin' THEN
    IF NEW.constituency_id IS NULL OR NEW.county_id IS NULL THEN
      RAISE EXCEPTION 'constituency_admin requires county_id and constituency_id';
    END IF;
    IF NEW.ward_id IS NOT NULL THEN
      RAISE EXCEPTION 'constituency_admin must not have ward_id';
    END IF;
  ELSIF _role = 'county_admin' THEN
    IF NEW.county_id IS NULL THEN
      RAISE EXCEPTION 'county_admin requires county_id';
    END IF;
    IF NEW.constituency_id IS NOT NULL OR NEW.ward_id IS NOT NULL THEN
      RAISE EXCEPTION 'county_admin must not have constituency_id or ward_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 6. Promote RPC supports chief
-- ============================================================
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(_target uuid, _role app_role, _county uuid, _constituency uuid, _ward uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can promote users';
  END IF;

  IF auth.uid() = _target THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;

  IF _role = 'ward_admin' OR _role = 'chief' THEN
    IF _ward IS NULL OR _constituency IS NULL OR _county IS NULL THEN
      RAISE EXCEPTION '% requires county, constituency, and ward', _role;
    END IF;
  ELSIF _role = 'constituency_admin' THEN
    IF _constituency IS NULL OR _county IS NULL THEN
      RAISE EXCEPTION 'constituency_admin requires county and constituency';
    END IF;
    _ward := NULL;
  ELSIF _role = 'county_admin' THEN
    IF _county IS NULL THEN
      RAISE EXCEPTION 'county_admin requires county';
    END IF;
    _constituency := NULL;
    _ward := NULL;
  ELSIF _role = 'super_admin' THEN
    _county := NULL;
    _constituency := NULL;
    _ward := NULL;
  ELSE
    RAISE EXCEPTION 'Invalid role for promotion: %', _role;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target;

  UPDATE public.profiles
    SET county_id = _county,
        constituency_id = _constituency,
        ward_id = _ward,
        updated_at = now()
    WHERE id = _target;

  INSERT INTO public.user_roles (user_id, role) VALUES (_target, _role);

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    auth.uid(),
    'ADMIN_PROMOTION',
    'profiles',
    _target,
    jsonb_build_object(
      'assigned_role', _role,
      'county_id', _county,
      'constituency_id', _constituency,
      'ward_id', _ward
    )
  );
END;
$function$;

-- ============================================================
-- 7. Chief UPDATE policy on documents
-- ============================================================
DROP POLICY IF EXISTS "chief update scoped docs" ON public.documents;
CREATE POLICY "chief update scoped docs"
  ON public.documents
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'chief') AND public.admin_can_access_user(user_id));

-- ============================================================
-- 8. Storage: replace narrow admin-read with admin-role-based read
-- ============================================================
DROP POLICY IF EXISTS "admins read scoped files" ON storage.objects;
DROP POLICY IF EXISTS "admins read student documents" ON storage.objects;
CREATE POLICY "admins read student documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'student-documents'
    AND public.is_admin(auth.uid())
  );

-- ============================================================
-- 9. Recommendation letter bucket + policies
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chief-letters', 'chief-letters', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chiefs upload letters" ON storage.objects;
CREATE POLICY "chiefs upload letters"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'chief-letters'
    AND public.has_role(auth.uid(), 'chief')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "admins read letters" ON storage.objects;
CREATE POLICY "admins read letters"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'chief-letters'
    AND public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "students read own letters" ON storage.objects;
CREATE POLICY "students read own letters"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'chief-letters'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
