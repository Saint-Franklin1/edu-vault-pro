UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email = 'franklinsabsabi1994@gmail.com';

DO $$ BEGIN
  CREATE TYPE public.admin_status AS ENUM ('active','suspended','banned','deleted');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_status public.admin_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid;

CREATE OR REPLACE FUNCTION public.set_admin_status(_target uuid, _status public.admin_status, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can change admin status';
  END IF;
  UPDATE public.profiles
    SET admin_status = _status,
        status_reason = _reason,
        status_changed_at = now(),
        status_changed_by = auth.uid(),
        deleted_at = CASE WHEN _status = 'deleted' THEN now() ELSE NULL END
    WHERE id = _target;
  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), 'admin.status_changed', 'profile', _target,
          jsonb_build_object('status', _status, 'reason', _reason));
END $$;