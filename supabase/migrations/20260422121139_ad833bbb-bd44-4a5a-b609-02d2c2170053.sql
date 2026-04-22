-- Create bursary_applications table for students to apply to programs
CREATE TABLE IF NOT EXISTS public.bursary_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bursary_id uuid NOT NULL REFERENCES public.bursaries(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bursary_id, student_id)
);

-- Status check constraint
ALTER TABLE public.bursary_applications
  ADD CONSTRAINT bursary_applications_status_check
  CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'withdrawn'));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bursary_applications_bursary ON public.bursary_applications(bursary_id);
CREATE INDEX IF NOT EXISTS idx_bursary_applications_student ON public.bursary_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_bursary_applications_status ON public.bursary_applications(status);

-- Enable RLS
ALTER TABLE public.bursary_applications ENABLE ROW LEVEL SECURITY;

-- Students can read their own applications
CREATE POLICY "students read own applications"
  ON public.bursary_applications
  FOR SELECT
  USING (student_id = auth.uid());

-- Students can create their own applications
CREATE POLICY "students insert own applications"
  ON public.bursary_applications
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Students can update (e.g. withdraw) their own applications when still pending
CREATE POLICY "students update own pending applications"
  ON public.bursary_applications
  FOR UPDATE
  USING (student_id = auth.uid() AND status IN ('pending', 'withdrawn'));

-- Admins can read applications for students within their geographic scope
CREATE POLICY "admins read scoped applications"
  ON public.bursary_applications
  FOR SELECT
  USING (public.admin_can_access_user(student_id));

-- Admins can update (review) applications within their scope
CREATE POLICY "admins update scoped applications"
  ON public.bursary_applications
  FOR UPDATE
  USING (public.admin_can_access_user(student_id));

-- Auto-update timestamp trigger
CREATE TRIGGER update_bursary_applications_updated_at
  BEFORE UPDATE ON public.bursary_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Audit trigger for application lifecycle
CREATE OR REPLACE FUNCTION public.audit_bursary_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
    VALUES (auth.uid(), 'bursary_application.created', 'bursary_application', NEW.id,
      jsonb_build_object('bursary_id', NEW.bursary_id, 'status', NEW.status));
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
    VALUES (auth.uid(), 'bursary_application.status_changed', 'bursary_application', NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'notes', NEW.review_notes));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_bursary_application_trigger
  AFTER INSERT OR UPDATE ON public.bursary_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_bursary_application();