-- Enforce that students must have complete geo (county, constituency, ward)
-- before they can upload documents. This guarantees the chief and admins
-- can see them via admin_can_access_user(), which matches on ward_id.

CREATE OR REPLACE FUNCTION public.enforce_student_geo_on_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM public.profiles WHERE id = NEW.user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', NEW.user_id;
  END IF;

  IF _p.county_id IS NULL OR _p.constituency_id IS NULL OR _p.ward_id IS NULL THEN
    RAISE EXCEPTION 'Complete your profile (county, constituency, ward) before uploading documents';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_student_geo_on_document ON public.documents;
CREATE TRIGGER trg_enforce_student_geo_on_document
BEFORE INSERT ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.enforce_student_geo_on_document();

-- Attach the doc approval enforcement trigger if it isn't attached yet
-- (the function existed but no trigger was bound to it — this is why
-- the approval chain was not actually being enforced at the DB level).
DROP TRIGGER IF EXISTS trg_enforce_doc_approval ON public.documents;
CREATE TRIGGER trg_enforce_doc_approval
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.enforce_doc_approval();

-- Attach audit triggers for documents (function exists, trigger was missing)
DROP TRIGGER IF EXISTS trg_audit_document ON public.documents;
CREATE TRIGGER trg_audit_document
AFTER INSERT OR UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.audit_document();

-- Updated_at trigger for documents
DROP TRIGGER IF EXISTS trg_documents_updated_at ON public.documents;
CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Profile geo validation trigger (function existed, no trigger)
DROP TRIGGER IF EXISTS trg_validate_profile_geo ON public.profiles;
CREATE TRIGGER trg_validate_profile_geo
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_profile_geo();

-- user_roles -> profile geo validation
DROP TRIGGER IF EXISTS trg_validate_profile_geo_after_role ON public.user_roles;
CREATE TRIGGER trg_validate_profile_geo_after_role
AFTER INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.validate_profile_geo_after_role();