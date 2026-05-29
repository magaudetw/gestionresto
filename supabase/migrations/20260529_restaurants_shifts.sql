-- Phase: restaurants table + horaire_shifts + RLS fixes + font_size
-- Run this in Supabase SQL Editor

-- ── 1. restaurants table (may already exist) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurants (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom   TEXT NOT NULL,
  ville TEXT NOT NULL DEFAULT 'Montréal',
  actif BOOLEAN NOT NULL DEFAULT true
);

GRANT SELECT ON public.restaurants TO anon, authenticated, service_role;

-- Insert defaults if they don't exist yet
INSERT INTO public.restaurants (nom, ville, actif)
SELECT 'Le Carré', 'Montréal', true
WHERE NOT EXISTS (SELECT 1 FROM public.restaurants WHERE nom = 'Le Carré');

INSERT INTO public.restaurants (nom, ville, actif)
SELECT 'Le Caméléon', 'Montréal', true
WHERE NOT EXISTS (SELECT 1 FROM public.restaurants WHERE nom = 'Le Caméléon');

-- ── 2. horaire_shifts table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.horaire_shifts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id)    ON DELETE CASCADE,
  shift_type_id UUID NOT NULL REFERENCES public.shift_types(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  statut        TEXT NOT NULL DEFAULT 'brouillon'
                  CHECK (statut IN ('brouillon', 'publie')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_horaire_shifts_rid_date ON public.horaire_shifts (restaurant_id, date);
CREATE INDEX IF NOT EXISTS idx_horaire_shifts_uid_date ON public.horaire_shifts (user_id, date);

GRANT ALL ON public.horaire_shifts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.horaire_shifts TO authenticated;

ALTER TABLE public.horaire_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can manage shifts" ON public.horaire_shifts;
CREATE POLICY "Managers can manage shifts"
  ON public.horaire_shifts FOR ALL TO authenticated
  USING  (public.get_current_user_roles() @> ARRAY['gerant'::text]
       OR public.get_current_user_roles() @> ARRAY['admin'::text])
  WITH CHECK (public.get_current_user_roles() @> ARRAY['gerant'::text]
           OR public.get_current_user_roles() @> ARRAY['admin'::text]);

DROP POLICY IF EXISTS "Employees read own shifts" ON public.horaire_shifts;
CREATE POLICY "Employees read own shifts"
  ON public.horaire_shifts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── 3. couverture_minimale RLS (table exists, just add policies) ─────────────
ALTER TABLE public.couverture_minimale ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers manage couverture" ON public.couverture_minimale;
CREATE POLICY "Managers manage couverture"
  ON public.couverture_minimale FOR ALL TO authenticated
  USING  (public.get_current_user_roles() @> ARRAY['gerant'::text]
       OR public.get_current_user_roles() @> ARRAY['admin'::text])
  WITH CHECK (public.get_current_user_roles() @> ARRAY['gerant'::text]
           OR public.get_current_user_roles() @> ARRAY['admin'::text]);

DROP POLICY IF EXISTS "All authenticated read couverture" ON public.couverture_minimale;
CREATE POLICY "All authenticated read couverture"
  ON public.couverture_minimale FOR SELECT TO authenticated USING (true);

-- ── 4. font_size column on profiles ─────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS font_size TEXT DEFAULT 'md';
