-- ============ DOCUMENT VERSIONING ============

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS document_type text;

CREATE INDEX IF NOT EXISTS idx_documents_user_type_active
  ON public.documents (user_id, document_type)
  WHERE deleted_at IS NULL;

-- Replace any existing active document of the same type for the same user.
-- Hard-delete the old DB row and remove the old file from storage.
CREATE OR REPLACE FUNCTION public.replace_prior_document_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  _old RECORD;
BEGIN
  IF NEW.document_type IS NULL THEN
    RETURN NEW;
  END IF;

  FOR _old IN
    SELECT id, storage_path
    FROM public.documents
    WHERE user_id = NEW.user_id
      AND document_type = NEW.document_type
      AND id <> NEW.id
  LOOP
    -- Remove the old file from storage
    DELETE FROM storage.objects
    WHERE bucket_id = 'student-documents'
      AND name = _old.storage_path;

    -- Hard-delete the old document row
    DELETE FROM public.documents WHERE id = _old.id;

    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
    VALUES (auth.uid(), 'document.superseded', 'document', _old.id,
      jsonb_build_object(
        'replaced_by', NEW.id,
        'document_type', NEW.document_type
      ));
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_replace_prior_document_version ON public.documents;
CREATE TRIGGER trg_replace_prior_document_version
AFTER INSERT ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.replace_prior_document_version();

-- ============ SUPER ADMIN HANDOVER ============

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'handover_status') THEN
    CREATE TYPE public.handover_status AS ENUM (
      'pending_email_verification',
      'pending_ai_review',
      'approved',
      'rejected',
      'expired'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.super_admin_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiated_by uuid NOT NULL,            -- existing super admin who started handover
  new_user_id uuid,                      -- auth.users id of the new admin (set after signup)
  full_name text NOT NULL,
  phone text NOT NULL,
  national_id_number text NOT NULL,
  email text NOT NULL,
  national_id_photo_path text,
  selfie_photo_path text,
  ai_match_score numeric,                -- 0..1
  ai_reasoning text,
  status public.handover_status NOT NULL DEFAULT 'pending_email_verification',
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_handovers_initiated_by ON public.super_admin_handovers (initiated_by);
CREATE INDEX IF NOT EXISTS idx_handovers_email ON public.super_admin_handovers (lower(email));

DROP TRIGGER IF EXISTS trg_handovers_updated_at ON public.super_admin_handovers;
CREATE TRIGGER trg_handovers_updated_at
BEFORE UPDATE ON public.super_admin_handovers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.super_admin_handovers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admin read handovers" ON public.super_admin_handovers;
CREATE POLICY "super admin read handovers"
ON public.super_admin_handovers
FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR new_user_id = auth.uid()
);

DROP POLICY IF EXISTS "super admin insert handovers" ON public.super_admin_handovers;
CREATE POLICY "super admin insert handovers"
ON public.super_admin_handovers
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  AND initiated_by = auth.uid()
);

DROP POLICY IF EXISTS "super admin update handovers" ON public.super_admin_handovers;
CREATE POLICY "super admin update handovers"
ON public.super_admin_handovers
FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'));

-- Storage bucket for handover ID + selfie photos (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('handover-ids', 'handover-ids', false)
ON CONFLICT (id) DO NOTHING;

-- Only super admins can read/write into handover-ids bucket
DROP POLICY IF EXISTS "super admin read handover photos" ON storage.objects;
CREATE POLICY "super admin read handover photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'handover-ids' AND public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super admin upload handover photos" ON storage.objects;
CREATE POLICY "super admin upload handover photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'handover-ids' AND public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super admin delete handover photos" ON storage.objects;
CREATE POLICY "super admin delete handover photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'handover-ids' AND public.has_role(auth.uid(), 'super_admin'));

-- RPC: finalize an approved handover by promoting the new user to super_admin
CREATE OR REPLACE FUNCTION public.finalize_super_admin_handover(_handover_id uuid, _new_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _h public.super_admin_handovers%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can finalize a handover';
  END IF;

  SELECT * INTO _h FROM public.super_admin_handovers WHERE id = _handover_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Handover not found';
  END IF;

  IF _h.status <> 'approved' THEN
    RAISE EXCEPTION 'Handover must be approved before finalization';
  END IF;

  -- Update the new user's profile
  UPDATE public.profiles
  SET full_name = _h.full_name,
      phone = _h.phone,
      county_id = NULL,
      constituency_id = NULL,
      ward_id = NULL,
      updated_at = now()
  WHERE id = _new_user;

  -- Replace any existing roles with super_admin
  DELETE FROM public.user_roles WHERE user_id = _new_user;
  INSERT INTO public.user_roles (user_id, role) VALUES (_new_user, 'super_admin');

  UPDATE public.super_admin_handovers
  SET new_user_id = _new_user,
      completed_at = now()
  WHERE id = _handover_id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), 'super_admin.handover_finalized', 'super_admin_handovers', _handover_id,
    jsonb_build_object('new_user_id', _new_user));
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_super_admin_handover(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_super_admin_handover(uuid, uuid) FROM anon, public;