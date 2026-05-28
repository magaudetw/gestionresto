-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Managers can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Security-definer helper: reads current user's roles bypassing RLS
-- (SECURITY DEFINER runs as owner = postgres superuser, so RLS is skipped)
CREATE OR REPLACE FUNCTION auth.get_my_roles()
  RETURNS text[]
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT roles FROM profiles WHERE id = auth.uid()
$$;

-- Policy 1: authenticated user can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy 2: gerant or admin can read all profiles
-- Uses security-definer function to avoid infinite recursion
CREATE POLICY "Managers can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    auth.get_my_roles() @> ARRAY['gerant'::text]
    OR auth.get_my_roles() @> ARRAY['admin'::text]
  );

-- Policy 3: authenticated user can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
