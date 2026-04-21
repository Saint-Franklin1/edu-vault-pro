-- 1. Geography validation function
CREATE OR REPLACE FUNCTION public.validate_profile_geo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
BEGIN
  -- Get the user's highest role (admin > student)
  SELECT role INTO _role
  FROM public.user_roles
  WHERE user_id = NEW.id
  ORDER BY CASE role
    WHEN 'super_admin' THEN 1
    WHEN 'county_admin' THEN 2
    WHEN 'constituency_admin' THEN 3
    WHEN 'ward_admin' THEN 4
    WHEN 'student' THEN 5
  END
  LIMIT 1;

  -- No role yet (new signup) → skip validation
  IF _role IS NULL THEN
    RETURN NEW;
  END IF;

  IF _role = 'ward_admin' THEN
    IF NEW.ward_id IS NULL OR NEW.constituency_id IS NULL OR NEW.county_id IS NULL THEN
      RAISE EXCEPTION 'ward_admin requires county_id, constituency_id, and ward_id';
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
$$;

DROP TRIGGER IF EXISTS validate_profile_geo_trigger ON public.profiles;
CREATE TRIGGER validate_profile_geo_trigger
  BEFORE INSERT OR UPDATE OF county_id, constituency_id, ward_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_geo();

-- 2. Mirror trigger on user_roles to re-validate profile after role change
CREATE OR REPLACE FUNCTION public.validate_profile_geo_after_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    ELSIF NEW.role = 'constituency_admin' AND (_profile.constituency_id IS NULL OR _profile.county_id IS NULL OR _profile.ward_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Cannot assign constituency_admin: profile geo invalid';
    ELSIF NEW.role = 'county_admin' AND (_profile.county_id IS NULL OR _profile.constituency_id IS NOT NULL OR _profile.ward_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Cannot assign county_admin: profile geo invalid';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS validate_role_geo_trigger ON public.user_roles;
CREATE TRIGGER validate_role_geo_trigger
  AFTER INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_geo_after_role();

-- 3. find_user_by_email RPC (super admin only)
CREATE OR REPLACE FUNCTION public.find_user_by_email(_email text)
RETURNS TABLE(id uuid, email text, full_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can search users';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.full_name
  FROM public.profiles p
  WHERE lower(p.email) = lower(trim(_email))
    AND p.deleted_at IS NULL
  LIMIT 1;
END;
$$;

-- 4. promote_user_to_admin RPC (super admin only, atomic role + geo)
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(
  _target uuid,
  _role app_role,
  _county uuid,
  _constituency uuid,
  _ward uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only super admins
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can promote users';
  END IF;

  -- Block self-promotion
  IF auth.uid() = _target THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;

  -- Validate role/geo matrix
  IF _role = 'ward_admin' THEN
    IF _ward IS NULL OR _constituency IS NULL OR _county IS NULL THEN
      RAISE EXCEPTION 'ward_admin requires county, constituency, and ward';
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

  -- Update geo first (with role still old, validation trigger will accept it because old role had its own scope or none)
  -- To avoid trigger conflicts, temporarily clear roles, set geo, then add new role.
  DELETE FROM public.user_roles WHERE user_id = _target;

  UPDATE public.profiles
    SET county_id = _county,
        constituency_id = _constituency,
        ward_id = _ward,
        updated_at = now()
    WHERE id = _target;

  INSERT INTO public.user_roles (user_id, role) VALUES (_target, _role);

  -- Audit log
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
$$;