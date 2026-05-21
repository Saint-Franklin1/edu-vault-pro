## Goal

Extend the existing bursary module so it behaves like the HELB portal: students complete a structured funding application (not just a free-text message), admins review and disburse through a hierarchical workflow, and the system produces disbursement / rejection reports with totals.

The current `bursary_applications` table only stores `message`, `status`, `review_notes`. That is too thin for HELB-style funding. We will extend it and add a disbursements table plus reporting views/pages.

---

## 1. HELB-style application form

Students will fill a multi-section application (similar to HELB's loan application):

- **Personal & academic**: institution name, course, year of study, admission/registration number, study level (secondary / TVET / undergrad / postgrad), expected completion year.
- **Funding need**: tuition required (KES), upkeep required (KES), other fees, total requested amount, fees structure document.
- **Household / sponsor info**: parents alive (both/father/mother/none), guardian name & relationship, guardian occupation, monthly household income bracket, number of siblings in school, disability status.
- **Banking / disbursement**: bank name, branch, account name, account number (or M-Pesa number) for payout.
- **Declaration**: checkbox + auto-stamped declaration date.

Verification of identity & residency continues to use the existing verified documents chain (chief → ward → constituency → county). Only students whose **profile is complete** and who have at least one **verified** document of type `national_id` / `birth_certificate` (configurable) can submit.

### UI changes
- Replace the single "Apply in-app" dialog in `src/pages/StudentBursaries.tsx` with a multi-step form (Personal → Funding → Household → Banking → Review & submit).
- New page `src/pages/StudentApplicationDetail.tsx` for the student to view their submitted application, status timeline, admin notes, and disbursement record.
- Add validation with `zod`.

---

## 2. HELB-style hierarchical review & disbursement

Admin review will mirror the document approval chain so the same scope rules apply:

`pending → ward_reviewed → constituency_reviewed → county_approved → disbursed | rejected | withdrawn`

- Ward admin: initial vetting, can request more info or recommend amount.
- Constituency admin: confirms recommendation, may adjust amount.
- County admin: final approval, sets `approved_amount` and marks `disbursed` once payment is made (records reference, date, channel).
- Super admin: full visibility, can revoke at any stage.
- Chief: read-only for own ward (no funding decisions, matches your earlier rule that chief only handles document verification).

Each transition writes to `audit_logs` and to a new `application_review_events` table (so the student timeline can render every step with who/when/notes).

### UI changes
- Rework `src/pages/AdminApplications.tsx` into a HELB-style review screen showing the full application, attached verified documents, recommended vs approved amount, action buttons appropriate to the current stage and the admin's role, and a notes field per action.
- Add `src/pages/AdminDisbursements.tsx` for county admins / super admin to record the actual payout (amount, date, channel, reference number, receipt upload to a new `disbursement-receipts` bucket).

---

## 3. Reports & analytics

New page `src/pages/AdminReports.tsx` (linked from admin/super-admin nav) with HELB-style KPIs and breakdowns, scoped to the admin's geography:

- **Headline KPIs**: total applications, approved count, rejected count, pending count, total funds requested, total funds approved, total funds disbursed, average disbursement.
- **Breakdowns** (tables + simple bar charts via `recharts`, already common in Lovable projects):
  - By bursary program (title, applicants, approved, disbursed amount).
  - By geography (county / constituency / ward depending on admin scope).
  - By rejection reason (grouped count of `review_notes` category + free-text examples).
  - By study level / institution.
- **Detail tables** with filters (status, date range, bursary, geography):
  - Approved students: name, institution, approved amount, disbursed amount, date, reference.
  - Rejected students: name, stage rejected at, reason, reviewer.
- **Export**: CSV download for each table; PDF summary using `jspdf` for the headline report.

Super admin sees system-wide figures; lower admins see only their scope (enforced via `admin_can_access_user` and a SECURITY DEFINER reporting function so RLS still holds).

---

## 4. Data model changes (migrations)

New enum and columns (single migration, awaiting your approval):

- Extend `bursary_applications`:
  - `institution_name text`, `course text`, `study_level text`, `year_of_study int`, `admission_number text`, `expected_completion_year int`
  - `tuition_required numeric`, `upkeep_required numeric`, `other_fees numeric`, `amount_requested numeric`
  - `parents_status text`, `guardian_name text`, `guardian_relationship text`, `guardian_occupation text`, `household_income_bracket text`, `siblings_in_school int`, `has_disability boolean`
  - `bank_name text`, `bank_branch text`, `account_name text`, `account_number text`, `mpesa_number text`
  - `declaration_signed_at timestamptz`
  - `recommended_amount numeric`, `approved_amount numeric`
  - `current_stage` (enum: `submitted`, `ward_reviewed`, `constituency_reviewed`, `county_approved`, `disbursed`, `rejected`, `withdrawn`)
  - `rejection_reason text`, `rejected_by uuid`, `rejected_at timestamptz`
  - `fee_structure_doc_id uuid` (link to `documents`)
- New table `application_review_events`: `application_id`, `actor_id`, `actor_role`, `from_stage`, `to_stage`, `notes`, `amount_recommended`, `created_at`.
- New table `disbursements`: `application_id`, `amount`, `channel` (`bank` / `mpesa` / `cheque`), `reference_number`, `paid_at`, `recorded_by`, `receipt_path`.
- New storage bucket `disbursement-receipts` (private), with RLS allowing only scoped admins + the owning student to read.
- New reporting RPCs (SECURITY DEFINER, scope-aware):
  - `report_application_summary(_from date, _to date)` → KPI row.
  - `report_applications_by_program(...)`, `report_rejections_by_reason(...)`, `report_disbursements(...)`.
- Triggers:
  - Enforce stage progression order (mirrors document `enforce_doc_approval`).
  - Auto-set `rejected_at` / `rejected_by` on transition to `rejected`.
  - Write each transition into `application_review_events` and `audit_logs`.

---

## 5. Routing & navigation

Add to `src/App.tsx`:
- `/student/applications/:id` → `StudentApplicationDetail`
- `/admin/disbursements` → `AdminDisbursements` (county admin + super admin)
- `/admin/reports` → `AdminReports` (all admin roles, data scoped server-side)

Add nav entries in `AppShell` for admin and student dashboards.

---

## Out of scope (call out for confirmation later)
- No real money movement / payment gateway integration — disbursement is recorded, not executed.
- No SMS notifications to students (can be added later via an edge function if you want).
- No changes to chief workflow or document versioning.

Once you approve, I'll run the migration first, then build the UI in this order: application form → admin review → disbursements → reports.
