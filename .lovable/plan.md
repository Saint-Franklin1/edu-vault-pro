
# Elimu Vault v2 — Implementation Plan

A geographically scoped student document wallet + bursary platform on React + Tailwind + Supabase, with all access control enforced via RLS.

## Setup
- Connect external Supabase project `bxbhpehfbwchumcwnpyk` via the Supabase integration (you'll be prompted to authorize).
- Install `@supabase/supabase-js`, `qrcode.react`, `react-router-dom`, `zod`, `react-hook-form`.

## Database (migrations)
- Enable `uuid-ossp`.
- **Geography**: `counties`, `constituencies`, `wards` — seeded with full Kenya dataset (47 counties, ~290 constituencies, ~1,450 wards).
- **profiles**: id (FK auth.users), email, county_id, constituency_id, ward_id, full_name, phone, created_at, deleted_at. *No role column here.*
- **app_role enum**: `student | ward_admin | constituency_admin | county_admin | super_admin`.
- **user_roles**: (user_id, role) — separate table per security standard.
- **has_role(uuid, app_role)** SECURITY DEFINER function (avoids RLS recursion).
- **get_user_geo()** SECURITY DEFINER returning the caller's county/constituency/ward (used by admin policies).
- **documents**: status enum (`pending|in_queue|verified|rejected`), file metadata, verifier, rejection reason, soft-delete.
- **bursaries**: scoped by county/constituency/ward, deadline, soft-delete.
- **audit_logs**: append-only, written from triggers + client RPC.
- **Trigger**: on `auth.users` insert → create profile row + assign `student` role by default.
- **Trigger**: on documents insert/update/delete → write audit_logs row.

## Row Level Security (all tables)
- **profiles**: user reads own; admins read profiles within their geographic scope; only super_admin can change roles (via user_roles policies).
- **user_roles**: user reads own roles; only super_admin can insert/update/delete.
- **documents**:
  - Student: SELECT/INSERT/soft-DELETE own (where deleted_at IS NULL).
  - Ward admin: SELECT + UPDATE docs whose owner's ward_id = admin's ward_id.
  - Constituency admin: scoped by constituency.
  - County admin: scoped by county.
  - Super admin: all.
  - **Public SELECT**: only rows where `status='verified' AND deleted_at IS NULL` — needed for the public QR page (file_url stays in a private bucket, so metadata is visible but files require signed URLs).
- **bursaries**: public SELECT (active only); admins INSERT/UPDATE within their scope; super_admin all.
- **counties/constituencies/wards**: public SELECT.
- **audit_logs**: insert-only for authenticated; SELECT only for super_admin.

## Storage
- Private bucket `student-documents`.
- Upload policy: path must start with `auth.uid()/`.
- Read policy: owner OR admin within scope (uses `has_role` + geo helper) OR public for verified docs (signed URLs only, generated client-side from authenticated student or admin sessions; QR page shows verified metadata + a "view" link that creates a signed URL when a student is logged in).
- Client validation: max 5 MB; mime ∈ {pdf, png, jpeg}; reject empty.

## Pre-seeded super admin
- Migration upserts role `super_admin` for the auth user with email `franklinsabsabi1994@gmail.com`. You'll sign up once with that email/password (`Frank@1994.`) and the role attaches automatically on first login.

## Frontend

**Auth**: `/auth` page (signup/login, email+password, `emailRedirectTo: window.location.origin`). `onAuthStateChange` listener set up before `getSession`. Role-aware redirect after login.

**Student dashboard** (`/student`):
- Profile completion gate: must select county → constituency → ward (cascading dropdowns) before uploading.
- `UploadForm` with drag-drop, mime/size validation, progress.
- `DocumentList` with `StatusBadge` (pending/in_queue/verified/rejected), rejection reasons, soft-delete.
- `QRCodeDisplay` linking to `/verify/:user_id`.
- `BursaryList` filtered to student's geography.
- Realtime: subscribe to own documents row updates (status changes appear instantly).

**Admin dashboard** (`/admin`):
- `AdminStats` (counts by status within scope).
- `ScopedDocumentsTable` with `StatusFilters` (RLS does the actual scoping).
- `VerificationPanel` — approve / reject with reason, sets `verified_by`, `verified_at`.
- `BursaryForm` — create bursaries scoped to admin's geography (super_admin can target any).
- Audit log viewer (super_admin only).
- Realtime: subscribe to scoped documents inserts/updates.

**Public QR page** (`/verify/:user_id`):
- No auth required.
- Shows student name + list of verified document titles + verified-at dates.
- Read via RLS public-verified policy. No file downloads on the public page.

**Layout / UX**:
- Tailwind + shadcn components already present.
- Clean semantic design tokens defined in `index.css` (primary/secondary/accent in HSL, light + dark).
- Sidebar navigation, role-aware menu, toast notifications for all mutations.

## Audit logging
- DB triggers handle document + bursary lifecycle.
- Client RPC `log_action(action, entity, entity_id, metadata)` for login/logout and admin views.

## Out of scope (per your spec)
- No edge functions.
- No hard deletes anywhere.
- No client-side security filtering — every list relies on RLS.
