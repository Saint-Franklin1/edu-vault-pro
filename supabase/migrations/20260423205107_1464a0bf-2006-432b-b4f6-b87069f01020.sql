
-- =========================================================
-- MODULE 1: BURSARIES — application_link + ownership policies
-- =========================================================

ALTER TABLE public.bursaries
  ADD COLUMN IF NOT EXISTS application_link text;

UPDATE public.bursaries SET application_link = '' WHERE application_link IS NULL;
ALTER TABLE public.bursaries ALTER COLUMN application_link SET NOT NULL;

-- Replace SELECT policy with role-aware scoping
DROP POLICY IF EXISTS "public read bursaries" ON public.bursaries;

CREATE POLICY "students read all bursaries"
ON public.bursaries FOR SELECT
USING (
  deleted_at IS NULL
  AND auth.uid() IS NOT NULL
  AND public.has_role(auth.uid(), 'student')
);

CREATE POLICY "admins read scoped bursaries"
ON public.bursaries FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'county_admin')
      AND (
        county_id IS NULL
        OR county_id = (SELECT county_id FROM public.profiles WHERE id = auth.uid())
      )
    )
    OR (
      public.has_role(auth.uid(), 'constituency_admin')
      AND (
        constituency_id IS NULL
        OR constituency_id = (SELECT constituency_id FROM public.profiles WHERE id = auth.uid())
      )
    )
    OR (
      public.has_role(auth.uid(), 'ward_admin')
      AND (
        ward_id IS NULL
        OR ward_id = (SELECT ward_id FROM public.profiles WHERE id = auth.uid())
      )
    )
  )
);

-- Strict ownership for UPDATE (covers soft-delete via deleted_at)
DROP POLICY IF EXISTS "admins update own bursaries" ON public.bursaries;

CREATE POLICY "creator updates own bursary"
ON public.bursaries FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "super admin updates any bursary"
ON public.bursaries FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Extend bursary audit
CREATE OR REPLACE FUNCTION public.audit_bursary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
    VALUES (auth.uid(), 'bursary.created', 'bursary', NEW.id,
      jsonb_build_object('title', NEW.title, 'application_link', NEW.application_link));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
      VALUES (auth.uid(), 'bursary.deleted', 'bursary', NEW.id, jsonb_build_object('title', NEW.title));
    ELSE
      INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
      VALUES (auth.uid(), 'bursary.updated', 'bursary', NEW.id,
        jsonb_build_object(
          'description_changed', OLD.description IS DISTINCT FROM NEW.description,
          'deadline_changed', OLD.deadline IS DISTINCT FROM NEW.deadline,
          'link_changed', OLD.application_link IS DISTINCT FROM NEW.application_link
        ));
    END IF;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS audit_bursary_trg ON public.bursaries;
CREATE TRIGGER audit_bursary_trg
AFTER INSERT OR UPDATE ON public.bursaries
FOR EACH ROW EXECUTE FUNCTION public.audit_bursary();

-- =========================================================
-- MODULE 3: DOCUMENTS — hierarchical approval
-- =========================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ward_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS constituency_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS county_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ward_approved_by uuid,
  ADD COLUMN IF NOT EXISTS ward_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS constituency_approved_by uuid,
  ADD COLUMN IF NOT EXISTS constituency_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS county_approved_by uuid,
  ADD COLUMN IF NOT EXISTS county_approved_at timestamptz;

-- Immutable order constraint (boolean-only, no time funcs)
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS approval_order_check;

ALTER TABLE public.documents
  ADD CONSTRAINT approval_order_check
  CHECK (
    (NOT constituency_approved OR ward_approved)
    AND (NOT county_approved OR constituency_approved)
  );

-- Replace single broad UPDATE policy with role-scoped policies
DROP POLICY IF EXISTS "admins update scoped docs" ON public.documents;

CREATE POLICY "ward admin update scoped docs"
ON public.documents FOR UPDATE
USING (
  public.has_role(auth.uid(), 'ward_admin')
  AND public.admin_can_access_user(user_id)
);

CREATE POLICY "constituency admin update scoped docs"
ON public.documents FOR UPDATE
USING (
  public.has_role(auth.uid(), 'constituency_admin')
  AND public.admin_can_access_user(user_id)
);

CREATE POLICY "county admin update scoped docs"
ON public.documents FOR UPDATE
USING (
  public.has_role(auth.uid(), 'county_admin')
  AND public.admin_can_access_user(user_id)
);

CREATE POLICY "super admin update any doc"
ON public.documents FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'));

-- Approval enforcement trigger (server-side stage gating + auto-verify)
CREATE OR REPLACE FUNCTION public.enforce_doc_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_super boolean := public.has_role(auth.uid(), 'super_admin');
  _is_ward  boolean := public.has_role(auth.uid(), 'ward_admin');
  _is_const boolean := public.has_role(auth.uid(), 'constituency_admin');
  _is_county boolean := public.has_role(auth.uid(), 'county_admin');
BEGIN
  -- Ward approval transition
  IF NEW.ward_approved IS DISTINCT FROM OLD.ward_approved THEN
    IF NEW.ward_approved = true THEN
      IF NOT (_is_super OR _is_ward) THEN
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
      IF NOT (_is_super OR _is_const) THEN
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
      IF NOT (_is_super OR _is_county) THEN
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

  -- Auto-verify when all three are approved
  IF NEW.ward_approved AND NEW.constituency_approved AND NEW.county_approved THEN
    IF NEW.status IS DISTINCT FROM 'verified'::document_status THEN
      NEW.status := 'verified'::document_status;
      NEW.verified_by := auth.uid();
      NEW.verified_at := now();
      NEW.rejection_reason := NULL;
    END IF;
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS enforce_doc_approval_trg ON public.documents;
CREATE TRIGGER enforce_doc_approval_trg
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.enforce_doc_approval();

-- Extend document audit with approval events
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

DROP TRIGGER IF EXISTS audit_document_trg ON public.documents;
CREATE TRIGGER audit_document_trg
AFTER INSERT OR UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.audit_document();

-- =========================================================
-- MODULE 2: REALTIME publication for instant sync
-- =========================================================

ALTER TABLE public.documents REPLICA IDENTITY FULL;
ALTER TABLE public.bursaries REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bursaries;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bursary_applications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
