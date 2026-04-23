

## Fix bursary visibility, document sync & add hierarchical approval

Extend the existing system without breaking it. Roles stay in `user_roles` (never on `profiles`). All policies use the existing `has_role()` and `admin_can_access_user()` security-definer helpers — no new recursion risk.

### Module 1 — Bursary visibility, application link, ownership

**DB migration**
- `bursaries.application_link text` — added nullable, backfill empty rows to `''`, then `SET NOT NULL`.
- Replace the public `admins update own bursaries` UPDATE policy with a stricter pair:
  - `creator updates own bursary` — `USING (created_by = auth.uid())`
  - `super_admin updates any bursary` — `USING (has_role(auth.uid(),'super_admin'))`
- Soft-delete is an UPDATE on `deleted_at`, so the same policies cover delete intent. No DELETE policy needed (table already blocks DELETE).
- Tighten SELECT: replace the wide-open `public read bursaries` with two policies:
  - `students read all open bursaries` (any authenticated student sees all non-deleted)
  - `admins read scoped bursaries` — `super_admin` sees all; county/constituency/ward admins see rows whose scope id matches their own profile geo OR rows that are open (all geo cols null). Implemented via `has_role()` + `get_my_geo()` so no recursion.
- Audit trigger extended: log `bursary.updated` on UPDATE and `bursary.deleted` when `deleted_at` flips.

**UI changes**
- `AdminBursaries.tsx`
  - "Application link" required input on create form; editable in the Edit dialog (description, deadline, application_link editable; title + scope locked).
  - Table shows full description (no `truncate`), deadline, scope chip, link button.
  - "Apply Now" button → `window.open(application_link,'_blank','noopener,noreferrer')`.
  - Soft-delete button (creator or super_admin only) — sets `deleted_at = now()`.
- `StudentBursaries.tsx`
  - Card shows full description and an "Apply Now" external-link button (opens `application_link`) in addition to the in-app "Apply" flow.

### Module 2 — Document visibility sync (admins)

The existing `admins read scoped docs` policy is correct, but documents only show if the admin's own profile geo matches at the admin's level. Two real fixes:

- **Migration**: enable realtime publication for `public.documents` and `public.bursaries` (`ALTER PUBLICATION supabase_realtime ADD TABLE …`) so the existing `postgres_changes` subscriptions in `AdminDashboard.tsx` and `AdminBursaries.tsx` actually fire.
- **UI**: `AdminDashboard.tsx` already has a realtime channel — confirmed working once publication is enabled. Add a dedicated "Pending documents" filter shortcut card (clickable count) and ensure new uploads appear without refresh.

### Module 3 — Hierarchical approval workflow

**DB migration on `documents`**
- Add `ward_approved boolean default false`, `constituency_approved boolean default false`, `county_approved boolean default false`, plus `ward_approved_by/at`, `constituency_approved_by/at`, `county_approved_by/at` (uuid + timestamptz) for audit.
- Immutable CHECK constraint enforcing order:
  ```
  CHECK (
    (NOT constituency_approved OR ward_approved)
    AND (NOT county_approved OR constituency_approved)
  )
  ```
- Replace the broad `admins update scoped docs` UPDATE policy with role-specific scoped policies (via `has_role()` + `admin_can_access_user()`):
  - `ward_admin` may UPDATE in-scope docs
  - `constituency_admin` may UPDATE in-scope docs
  - `county_admin` may UPDATE in-scope docs
  - `super_admin` may UPDATE any
- BEFORE UPDATE trigger `enforce_doc_approval`:
  - Reject ward approval unless actor is ward_admin/super_admin and `OLD.ward_approved=false`.
  - Reject constituency approval unless `ward_approved=true` and actor is constituency_admin/super_admin.
  - Reject county approval unless `constituency_approved=true` and actor is county_admin/super_admin.
  - When all three flags become true, auto-set `status='verified'`, `verified_by=auth.uid()`, `verified_at=now()`.
  - On any approval change, set the matching `*_approved_by/at` columns server-side.
- Audit trigger extended: log `document.ward_approved`, `document.constituency_approved`, `document.county_approved`, `document.fully_verified`.

**UI on `AdminDashboard.tsx`**
- Add "Approval stage" column with badges: Pending → Ward Approved → Constituency Approved → Fully Verified (or Rejected).
- Replace single "Verify" button with stage-aware action shown only to the right role:
  - Ward admin sees "Approve (Ward)" if `!ward_approved`.
  - Constituency admin sees "Approve (Constituency)" only when `ward_approved && !constituency_approved`.
  - County admin sees "Approve (County)" only when `constituency_approved && !county_approved`.
  - Super admin sees whichever next step is available plus a "Force verify" override.
- Reject remains available at any stage (sets `status='rejected'`, captures `rejection_reason`).

### Module 4 — Audit logging

Already covered above — extend `audit_bursary` and `audit_document` triggers to log update/delete/approval events with actor + metadata. All writes flow through these triggers, so coverage is complete and tamper-resistant.

### Module 5 — Final UI polish

- Bursary cards: full description, scope chip, deadline, "Apply Now" external button, in-app "Apply" flow preserved.
- Documents: visible across admin dashboards in real time; status + approval-stage indicator.
- Approval: step-based UI driven by current flags + actor role; impossible transitions hidden and rejected at DB.

### Files touched

- **New migration** — `application_link` column, replacement bursary policies, approval columns + check + trigger, replacement document update policies, realtime publication, audit additions.
- **Edit** `src/pages/AdminBursaries.tsx` — application_link field, full description, Apply Now, soft-delete.
- **Edit** `src/pages/StudentBursaries.tsx` — Apply Now external button alongside existing apply flow.
- **Edit** `src/pages/AdminDashboard.tsx` — approval-stage column, role-gated approval buttons, override for super admin.
- **Edit** `src/components/StatusBadge.tsx` — add a small `ApprovalStageBadge` (or extend) for ward/constituency/county/fully verified.

### Security guarantees

- Roles never read from `profiles` — always via `has_role()` (no recursion).
- Approval order enforced both by CHECK constraint and BEFORE UPDATE trigger; client cannot skip stages.
- Only creator or super_admin may edit/soft-delete bursaries.
- All approval and bursary lifecycle events written to `audit_logs` server-side.
- Existing features (auth, promotion RPC, applications, geo validation) untouched.

