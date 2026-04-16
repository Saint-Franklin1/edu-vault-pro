CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE public.app_role AS ENUM ('student','ward_admin','constituency_admin','county_admin','super_admin');
CREATE TYPE public.document_status AS ENUM ('pending','in_queue','verified','rejected');

CREATE TABLE public.counties (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.constituencies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  county_id uuid NOT NULL REFERENCES public.counties(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (county_id, name)
);

CREATE TABLE public.wards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  constituency_id uuid NOT NULL REFERENCES public.constituencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (constituency_id, name)
);

CREATE INDEX idx_constituencies_county ON public.constituencies(county_id);
CREATE INDEX idx_wards_constituency ON public.wards(constituency_id);

ALTER TABLE public.counties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constituencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geo public read counties" ON public.counties FOR SELECT USING (true);
CREATE POLICY "geo public read constituencies" ON public.constituencies FOR SELECT USING (true);
CREATE POLICY "geo public read wards" ON public.wards FOR SELECT USING (true);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  full_name text,
  phone text,
  county_id uuid REFERENCES public.counties(id),
  constituency_id uuid REFERENCES public.constituencies(id),
  ward_id uuid REFERENCES public.wards(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('ward_admin','constituency_admin','county_admin','super_admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_my_geo()
RETURNS TABLE(county_id uuid, constituency_id uuid, ward_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT county_id, constituency_id, ward_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.admin_can_access_user(_target_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;

CREATE POLICY "users read own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "admins read scoped profiles" ON public.profiles FOR SELECT USING (public.admin_can_access_user(id));
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "public read minimal profile for verify" ON public.profiles FOR SELECT USING (true);

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "super admin read roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super admin insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super admin update roles" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super admin delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  storage_path text NOT NULL,
  file_name text,
  file_size bigint,
  mime_type text,
  status public.document_status NOT NULL DEFAULT 'pending',
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_documents_user ON public.documents(user_id);
CREATE INDEX idx_documents_status ON public.documents(status);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students read own docs" ON public.documents FOR SELECT USING (user_id = auth.uid() AND deleted_at IS NULL);
CREATE POLICY "students insert own docs" ON public.documents FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "students update own docs" ON public.documents FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "admins read scoped docs" ON public.documents FOR SELECT USING (public.admin_can_access_user(user_id) AND deleted_at IS NULL);
CREATE POLICY "admins update scoped docs" ON public.documents FOR UPDATE USING (public.admin_can_access_user(user_id));
CREATE POLICY "public read verified docs" ON public.documents FOR SELECT USING (status = 'verified' AND deleted_at IS NULL);

CREATE TABLE public.bursaries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  county_id uuid REFERENCES public.counties(id),
  constituency_id uuid REFERENCES public.constituencies(id),
  ward_id uuid REFERENCES public.wards(id),
  deadline date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE public.bursaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read bursaries" ON public.bursaries FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "admins create bursaries in scope" ON public.bursaries FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (public.has_role(auth.uid(), 'county_admin') AND county_id = (SELECT county_id FROM public.profiles WHERE id = auth.uid()))
  OR (public.has_role(auth.uid(), 'constituency_admin') AND constituency_id = (SELECT constituency_id FROM public.profiles WHERE id = auth.uid()))
  OR (public.has_role(auth.uid(), 'ward_admin') AND ward_id = (SELECT ward_id FROM public.profiles WHERE id = auth.uid()))
);
CREATE POLICY "admins update own bursaries" ON public.bursaries FOR UPDATE USING (
  created_by = auth.uid() OR public.has_role(auth.uid(), 'super_admin')
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated insert audit" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "super admin read audit" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.log_action(_action text, _entity text, _entity_id uuid, _metadata jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), _action, _entity, _entity_id, _metadata);
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bursaries_updated BEFORE UPDATE ON public.bursaries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  IF NEW.email = 'franklinsabsabi1994@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.audit_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
    VALUES (auth.uid(), 'document.created', 'document', NEW.id, jsonb_build_object('status', NEW.status, 'title', NEW.title));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
      VALUES (auth.uid(), 'document.status_changed', 'document', NEW.id, jsonb_build_object('from', OLD.status, 'to', NEW.status, 'reason', NEW.rejection_reason));
    END IF;
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
      VALUES (auth.uid(), 'document.deleted', 'document', NEW.id, '{}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_audit_document AFTER INSERT OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.audit_document();

CREATE OR REPLACE FUNCTION public.audit_bursary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
    VALUES (auth.uid(), 'bursary.created', 'bursary', NEW.id, jsonb_build_object('title', NEW.title));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_audit_bursary AFTER INSERT ON public.bursaries FOR EACH ROW EXECUTE FUNCTION public.audit_bursary();

INSERT INTO storage.buckets (id, name, public)
VALUES ('student-documents', 'student-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "students upload own folder" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "students read own files" ON storage.objects FOR SELECT USING (
  bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "students delete own files" ON storage.objects FOR DELETE USING (
  bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "admins read scoped files" ON storage.objects FOR SELECT USING (
  bucket_id = 'student-documents' AND public.admin_can_access_user(((storage.foldername(name))[1])::uuid)
);