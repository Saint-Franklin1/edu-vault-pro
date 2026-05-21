
-- =========================================================================
-- 1. Enum for application stages
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.application_stage AS ENUM (
    'submitted',
    'ward_reviewed',
    'constituency_reviewed',
    'county_approved',
    'disbursed',
    'rejected',
    'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- 2. Extend bursary_applications
-- =========================================================================
ALTER TABLE public.bursary_applications
  ADD COLUMN IF NOT EXISTS institution_name text,
  ADD COLUMN IF NOT EXISTS course text,
  ADD COLUMN IF NOT EXISTS study_level text,
  ADD COLUMN IF NOT EXISTS year_of_study int,
  ADD COLUMN IF NOT EXISTS admission_number text,
  ADD COLUMN IF NOT EXISTS expected_completion_year int,
  ADD COLUMN IF NOT EXISTS tuition_required numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upkeep_required numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_fees numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_requested numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parents_status text,
  ADD COLUMN IF NOT EXISTS guardian_name text,
  ADD COLUMN IF NOT EXISTS guardian_relationship text,
  ADD COLUMN IF NOT EXISTS guardian_occupation text,
  ADD COLUMN IF NOT EXISTS household_income_bracket text,
  ADD COLUMN IF NOT EXISTS siblings_in_school int,
  ADD COLUMN IF NOT EXISTS has_disability boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_branch text,
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS mpesa_number text,
  ADD COLUMN IF NOT EXISTS declaration_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS recommended_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS approved_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS current_stage public.application_stage NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS fee_structure_doc_id uuid;

-- Backfill current_stage from legacy status
UPDATE public.bursary_applications
  SET current_stage = CASE
    WHEN status = 'approved' THEN 'county_approved'::public.application_stage
    WHEN status = 'rejected' THEN 'rejected'::public.application_stage
    WHEN status = 'withdrawn' THEN 'withdrawn'::public.application_stage
    ELSE 'submitted'::public.application_stage
  END
  WHERE current_stage = 'submitted'
    AND status IS NOT NULL
    AND status <> 'pending';

-- =========================================================================
-- 3. Review events timeline
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.application_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.bursary_applications(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_role app_role,
  from_stage public.application_stage,
  to_stage public.application_stage NOT NULL,
  notes text,
  amount_recommended numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.application_review_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student read own review events"
  ON public.application_review_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bursary_applications a
    WHERE a.id = application_id AND a.student_id = auth.uid()
  ));

CREATE POLICY "admin read scoped review events"
  ON public.application_review_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bursary_applications a
    WHERE a.id = application_id AND public.admin_can_access_user(a.student_id)
  ));

-- =========================================================================
-- 4. Disbursements
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.bursary_applications(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  channel text NOT NULL CHECK (channel IN ('bank','mpesa','cheque')),
  reference_number text NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL,
  receipt_path text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student read own disbursements"
  ON public.disbursements FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bursary_applications a
    WHERE a.id = application_id AND a.student_id = auth.uid()
  ));

CREATE POLICY "admin read scoped disbursements"
  ON public.disbursements FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bursary_applications a
    WHERE a.id = application_id AND public.admin_can_access_user(a.student_id)
  ));

CREATE POLICY "county/super insert disbursements"
  ON public.disbursements FOR INSERT
  WITH CHECK (
    recorded_by = auth.uid()
    AND (
      public.has_role(auth.uid(),'super_admin')
      OR public.has_role(auth.uid(),'county_admin')
    )
    AND EXISTS (
      SELECT 1 FROM public.bursary_applications a
      WHERE a.id = application_id AND public.admin_can_access_user(a.student_id)
    )
  );

-- =========================================================================
-- 5. Storage bucket for disbursement receipts
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('disbursement-receipts', 'disbursement-receipts', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Scoped admins read disbursement receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'disbursement-receipts'
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'county_admin')
      OR public.has_role(auth.uid(), 'constituency_admin')
      OR public.has_role(auth.uid(), 'ward_admin')
    )
  );

CREATE POLICY "Students read own disbursement receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'disbursement-receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "County/super upload disbursement receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'disbursement-receipts'
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'county_admin')
    )
  );

-- =========================================================================
-- 6. Stage progression trigger
-- =========================================================================
CREATE OR REPLACE FUNCTION public.enforce_application_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_super  boolean := public.has_role(auth.uid(), 'super_admin');
  _is_ward   boolean := public.has_role(auth.uid(), 'ward_admin');
  _is_const  boolean := public.has_role(auth.uid(), 'constituency_admin');
  _is_county boolean := public.has_role(auth.uid(), 'county_admin');
  _actor_role app_role;
BEGIN
  IF NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN
    -- Determine acting role
    IF _is_super THEN _actor_role := 'super_admin';
    ELSIF _is_county THEN _actor_role := 'county_admin';
    ELSIF _is_const THEN _actor_role := 'constituency_admin';
    ELSIF _is_ward THEN _actor_role := 'ward_admin';
    ELSE _actor_role := 'student';
    END IF;

    -- Allowed transitions
    IF NEW.current_stage = 'ward_reviewed' THEN
      IF NOT (_is_ward OR _is_super) THEN
        RAISE EXCEPTION 'Only ward admins can move to ward_reviewed';
      END IF;
      IF OLD.current_stage <> 'submitted' THEN
        RAISE EXCEPTION 'ward_reviewed requires submitted';
      END IF;

    ELSIF NEW.current_stage = 'constituency_reviewed' THEN
      IF NOT (_is_const OR _is_super) THEN
        RAISE EXCEPTION 'Only constituency admins can move to constituency_reviewed';
      END IF;
      IF OLD.current_stage <> 'ward_reviewed' THEN
        RAISE EXCEPTION 'constituency_reviewed requires ward_reviewed first';
      END IF;

    ELSIF NEW.current_stage = 'county_approved' THEN
      IF NOT (_is_county OR _is_super) THEN
        RAISE EXCEPTION 'Only county admins can approve';
      END IF;
      IF OLD.current_stage <> 'constituency_reviewed' THEN
        RAISE EXCEPTION 'county_approved requires constituency_reviewed first';
      END IF;
      IF NEW.approved_amount IS NULL OR NEW.approved_amount <= 0 THEN
        RAISE EXCEPTION 'approved_amount required for county_approved';
      END IF;

    ELSIF NEW.current_stage = 'disbursed' THEN
      IF NOT (_is_county OR _is_super) THEN
        RAISE EXCEPTION 'Only county/super admin can mark disbursed';
      END IF;
      IF OLD.current_stage <> 'county_approved' THEN
        RAISE EXCEPTION 'disbursed requires county_approved first';
      END IF;

    ELSIF NEW.current_stage = 'rejected' THEN
      IF NOT (_is_ward OR _is_const OR _is_county OR _is_super) THEN
        RAISE EXCEPTION 'Only admins can reject';
      END IF;
      NEW.rejected_by := auth.uid();
      NEW.rejected_at := now();
      IF NEW.rejection_reason IS NULL OR length(trim(NEW.rejection_reason)) = 0 THEN
        RAISE EXCEPTION 'rejection_reason required';
      END IF;

    ELSIF NEW.current_stage = 'withdrawn' THEN
      IF NEW.student_id <> auth.uid() AND NOT _is_super THEN
        RAISE EXCEPTION 'Only the student or super admin can withdraw';
      END IF;
    END IF;

    -- Mirror to legacy status for backward compat
    NEW.status := CASE NEW.current_stage
      WHEN 'submitted' THEN 'pending'
      WHEN 'ward_reviewed' THEN 'under_review'
      WHEN 'constituency_reviewed' THEN 'under_review'
      WHEN 'county_approved' THEN 'approved'
      WHEN 'disbursed' THEN 'approved'
      WHEN 'rejected' THEN 'rejected'
      WHEN 'withdrawn' THEN 'withdrawn'
    END;

    -- Log event
    INSERT INTO public.application_review_events
      (application_id, actor_id, actor_role, from_stage, to_stage, notes, amount_recommended)
    VALUES
      (NEW.id, auth.uid(), _actor_role, OLD.current_stage, NEW.current_stage,
       NEW.review_notes, NEW.recommended_amount);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_application_stage ON public.bursary_applications;
CREATE TRIGGER trg_enforce_application_stage
  BEFORE UPDATE ON public.bursary_applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_stage();

-- Log initial submission
CREATE OR REPLACE FUNCTION public.log_application_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.application_review_events
    (application_id, actor_id, actor_role, from_stage, to_stage, notes)
  VALUES
    (NEW.id, auth.uid(), 'student', NULL, NEW.current_stage, NEW.message);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_application_submitted ON public.bursary_applications;
CREATE TRIGGER trg_log_application_submitted
  AFTER INSERT ON public.bursary_applications
  FOR EACH ROW EXECUTE FUNCTION public.log_application_submitted();

-- =========================================================================
-- 7. Reporting RPCs (security definer, scope-aware via admin_can_access_user)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.report_application_summary(_from date, _to date)
RETURNS TABLE(
  total_applications bigint,
  pending bigint,
  approved bigint,
  rejected bigint,
  disbursed bigint,
  funds_requested numeric,
  funds_approved numeric,
  funds_disbursed numeric,
  avg_disbursement numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH apps AS (
    SELECT a.*
    FROM public.bursary_applications a
    WHERE public.admin_can_access_user(a.student_id)
      AND a.created_at::date BETWEEN _from AND _to
  ),
  paid AS (
    SELECT d.application_id, sum(d.amount) AS amt
    FROM public.disbursements d
    WHERE d.paid_at::date BETWEEN _from AND _to
      AND EXISTS (SELECT 1 FROM apps WHERE apps.id = d.application_id)
    GROUP BY d.application_id
  )
  SELECT
    count(*)::bigint,
    count(*) FILTER (WHERE current_stage IN ('submitted','ward_reviewed','constituency_reviewed'))::bigint,
    count(*) FILTER (WHERE current_stage IN ('county_approved','disbursed'))::bigint,
    count(*) FILTER (WHERE current_stage = 'rejected')::bigint,
    count(*) FILTER (WHERE current_stage = 'disbursed')::bigint,
    COALESCE(sum(amount_requested),0),
    COALESCE(sum(approved_amount) FILTER (WHERE current_stage IN ('county_approved','disbursed')),0),
    COALESCE((SELECT sum(amt) FROM paid),0),
    COALESCE((SELECT avg(amt) FROM paid),0)
  FROM apps;
$$;

CREATE OR REPLACE FUNCTION public.report_by_program(_from date, _to date)
RETURNS TABLE(
  bursary_id uuid,
  title text,
  applicants bigint,
  approved bigint,
  rejected bigint,
  disbursed_amount numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    b.id, b.title,
    count(a.*)::bigint,
    count(a.*) FILTER (WHERE a.current_stage IN ('county_approved','disbursed'))::bigint,
    count(a.*) FILTER (WHERE a.current_stage = 'rejected')::bigint,
    COALESCE(sum(d.amount),0)
  FROM public.bursaries b
  JOIN public.bursary_applications a ON a.bursary_id = b.id
  LEFT JOIN public.disbursements d ON d.application_id = a.id
  WHERE public.admin_can_access_user(a.student_id)
    AND a.created_at::date BETWEEN _from AND _to
  GROUP BY b.id, b.title
  ORDER BY count(a.*) DESC;
$$;

CREATE OR REPLACE FUNCTION public.report_rejections_by_reason(_from date, _to date)
RETURNS TABLE(reason text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(NULLIF(trim(rejection_reason),''),'(unspecified)') AS reason,
         count(*)::bigint
  FROM public.bursary_applications
  WHERE public.admin_can_access_user(student_id)
    AND current_stage = 'rejected'
    AND COALESCE(rejected_at, updated_at)::date BETWEEN _from AND _to
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.report_disbursements(_from date, _to date)
RETURNS TABLE(
  disbursement_id uuid,
  application_id uuid,
  student_name text,
  bursary_title text,
  amount numeric,
  channel text,
  reference_number text,
  paid_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT d.id, d.application_id, p.full_name, b.title,
         d.amount, d.channel, d.reference_number, d.paid_at
  FROM public.disbursements d
  JOIN public.bursary_applications a ON a.id = d.application_id
  JOIN public.profiles p ON p.id = a.student_id
  JOIN public.bursaries b ON b.id = a.bursary_id
  WHERE public.admin_can_access_user(a.student_id)
    AND d.paid_at::date BETWEEN _from AND _to
  ORDER BY d.paid_at DESC;
$$;
