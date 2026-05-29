-- Fix: ensure theme/lang/font_family columns exist + service_role permissions
-- Run this in Supabase SQL editor

-- ── 1. Add missing preference columns ─────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme       TEXT DEFAULT 'Lumière',
  ADD COLUMN IF NOT EXISTS lang        TEXT DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'DM Sans';

-- ── 2. service_role must be able to SELECT profiles (needed for manage-profile) ─
GRANT SELECT ON public.profiles TO service_role;

-- ── 3. RLS: any user can update their own preference columns ───────────────────
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING  (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
