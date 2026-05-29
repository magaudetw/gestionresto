-- Fix "permission denied for table profiles" on manager create/update
--
-- Root cause A: service_role and authenticated may not have INSERT/UPDATE
--   grant on this table (depends on when ALTER DEFAULT PRIVILEGES was applied)
-- Root cause B: no RLS INSERT/UPDATE policies exist for managers, so even
--   a direct authenticated call fails the RLS check

-- ── 1. Ensure table-level GRANT for all relevant roles ──────────────────────
GRANT INSERT          ON public.profiles TO authenticated, service_role;
GRANT UPDATE          ON public.profiles TO authenticated, service_role;
GRANT DELETE          ON public.profiles TO service_role;
-- (SELECT was already granted in 20260528_profiles_rls_fix.sql)

-- ── 2. RLS: managers can INSERT any profile ──────────────────────────────────
DROP POLICY IF EXISTS "Managers can insert profiles" ON profiles;

CREATE POLICY "Managers can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_current_user_roles() @> ARRAY['gerant'::text]
    OR public.get_current_user_roles() @> ARRAY['admin'::text]
  );

-- ── 3. RLS: managers can UPDATE any profile ──────────────────────────────────
-- Replaces the existing "Users can update own profile" scope for managers
DROP POLICY IF EXISTS "Managers can update any profile" ON profiles;

CREATE POLICY "Managers can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    public.get_current_user_roles() @> ARRAY['gerant'::text]
    OR public.get_current_user_roles() @> ARRAY['admin'::text]
  )
  WITH CHECK (
    public.get_current_user_roles() @> ARRAY['gerant'::text]
    OR public.get_current_user_roles() @> ARRAY['admin'::text]
  );

-- The existing "Users can update own profile" policy stays and covers employees
-- updating their own preferences (theme, lang, font_family, dispos_base).
-- Both policies coexist — Postgres evaluates them with OR logic.
