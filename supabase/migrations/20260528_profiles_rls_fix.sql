-- Fix: RLS helper function was in auth schema where authenticated role has no EXECUTE permission.
-- Move it to public schema and add the required grant.

-- 1. Drop broken function
DROP FUNCTION IF EXISTS auth.get_my_roles();

-- 2. Create helper in public schema (SECURITY DEFINER + SET search_path prevents inlining)
CREATE OR REPLACE FUNCTION public.get_current_user_roles()
  RETURNS text[]
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT roles FROM public.profiles WHERE id = auth.uid()
$$;

-- 3. Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.get_current_user_roles() TO authenticated;

-- 4. Ensure table-level permissions are present
GRANT SELECT           ON public.profiles TO anon, authenticated;
GRANT UPDATE           ON public.profiles TO authenticated;

-- 5. Recreate the broken manager policy using the correct function
DROP POLICY IF EXISTS "Managers can read all profiles" ON profiles;

CREATE POLICY "Managers can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_roles() @> ARRAY['gerant'::text]
    OR public.get_current_user_roles() @> ARRAY['admin'::text]
  );
