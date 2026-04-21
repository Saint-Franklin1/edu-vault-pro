

## Add Manual Admin Promotion Flow

Extend (not replace) the existing role system with a dedicated, super-admin-only **Admin Promotion Panel** that searches a user by email, assigns an admin role, and writes geographic scope — all enforced by RLS, a security-definer RPC, a validation trigger, and an audit log entry.

### Architectural reconciliation

The spec assumes `profiles.role`, but this project (correctly) stores roles in a separate `public.user_roles` table to prevent privilege escalation. We will keep that pattern and adapt the spec:

- "Set role" = insert/replace row in `user_roles`
- "Set scope" = update `county_id / constituency_id / ward_id` on `profiles`
- Both happen atomically inside one SECURITY DEFINER RPC

### 1. Database migration

**a. Geography validation trigger** on `profiles` (replaces the proposed CHECK because role lives in `user_roles`):

```text
trigger validate_admin_geo BEFORE INSERT OR UPDATE on profiles
  → looks up highest role in user_roles for NEW.id
  → enforces:
      ward_admin         → county_id, constituency_id, ward_id all NOT NULL
      constituency_admin → county_id, constituency_id NOT NULL; ward_id NULL
      county_admin       → county_id NOT NULL; constituency_id, ward_id NULL
      super_admin/student → no geo requirement
  → raises EXCEPTION on violation
```

A mirrored trigger on `user_roles` re-validates the target profile after a role insert/update so the two tables stay consistent.

**b. RPC `promote_user_to_admin`** (SECURITY DEFINER):

Inputs: `_target uuid, _role app_role, _county uuid, _constituency uuid, _ward uuid`

Logic:
1. Assert caller `has_role(auth.uid(), 'super_admin')` — else raise.
2. Assert `auth.uid() <> _target` (block self-promotion).
3. Validate role/geo combination matches the matrix above.
4. `DELETE FROM user_roles WHERE user_id = _target` then `INSERT` the new role (single-role-per-user model).
5. `UPDATE profiles SET county_id, constituency_id, ward_id WHERE id = _target`.
6. `INSERT INTO audit_logs` with action `ADMIN_PROMOTION`, entity `profiles`, metadata `{assigned_role, county_id, constituency_id, ward_id}`.

**c. RPC `find_user_by_email`** (SECURITY DEFINER, super-admin only) — returns `id, email, full_name` so super admin can search across all users without widening `profiles` RLS.

### 2. Frontend — `AdminPromotionPanel`

New component `src/components/AdminPromotionPanel.tsx` mounted as a new card at the top of `src/pages/AdminRoles.tsx` (existing role list stays intact below it).

Card layout (Tailwind, matches existing design tokens):

```text
┌─ Promote user to admin ──────────────────┐
│ Email   [____________________]  [Search] │
│ ── once user found: ──                   │
│ Found: Jane Doe (jane@x.com)             │
│ Role    [ Select role ▾ ]                │
│ County  [ Select ▾ ]                     │
│ Const.  [ Select ▾ ] (hidden for county) │
│ Ward    [ Select ▾ ] (ward_admin only)   │
│ [ Promote user ]  ← disabled until valid │
└──────────────────────────────────────────┘
```

Behavior:
- Email search calls `find_user_by_email` RPC. Shows "no user found" or the matched profile.
- Role dropdown lists `ward_admin | constituency_admin | county_admin | super_admin` (no `student` — it's the default).
- County/constituency/ward dropdowns reuse the existing `GeoSelector` pattern (cascading load from `counties → constituencies → wards`). Fields hide based on selected role.
- Client-side validation enforces the same role/geo matrix; submit button disabled until valid.
- Submit → calls `promote_user_to_admin` RPC. Toast success/error. Refreshes the existing user list.

### 3. Routing & navigation

No new routes. Panel appears on existing `/admin/roles` page (super-admin-only via existing guard). Existing assign/revoke UI remains as a fallback management surface.

### 4. Security guarantees (mapped to spec test cases)

| Test | Enforcement |
|---|---|
| Student promotes | RPC asserts `has_role(super_admin)` → raises |
| Ward admin promotes | Same — only super_admin passes |
| Super admin promotes | Allowed |
| Invalid geography | Trigger + RPC validation raise EXCEPTION |
| Self-promotion | RPC asserts `auth.uid() <> _target` |
| Data leak across scope | Existing `admin_can_access_user` RLS unchanged |
| Constituency/county scope visibility | Existing scoped RLS unchanged |

### 5. Files touched

- **New migration** — geo validation triggers, `promote_user_to_admin` RPC, `find_user_by_email` RPC
- **New** `src/components/AdminPromotionPanel.tsx`
- **Edit** `src/pages/AdminRoles.tsx` — mount the panel above existing cards
- No changes to `useAuth`, routing, RLS policies on existing tables, or any other feature

