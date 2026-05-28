-- Phase 9b: Disponibilités hebdomadaires + profil colonnes manquantes
-- Run this in your Supabase SQL editor

-- ============================================================
-- 1. profiles — colonnes manquantes
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS font_family  TEXT,
  ADD COLUMN IF NOT EXISTS dispos_base  JSONB;

-- ============================================================
-- 2. dispos_hebdo — disponibilités soumises par l'employé
-- ============================================================

CREATE TABLE IF NOT EXISTS dispos_hebdo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  semaine_du    DATE NOT NULL,
  dispos        JSONB NOT NULL DEFAULT '{}',
  statut        TEXT NOT NULL DEFAULT 'brouillon'
                  CHECK (statut IN ('brouillon', 'soumis')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, restaurant_id, semaine_du)
);

CREATE INDEX IF NOT EXISTS idx_dispos_hebdo_restaurant ON dispos_hebdo (restaurant_id, semaine_du);
CREATE INDEX IF NOT EXISTS idx_dispos_hebdo_user       ON dispos_hebdo (user_id);

-- ============================================================
-- 3. couverture_minimale — besoins en personnel par jour/service
-- ============================================================

CREATE TABLE IF NOT EXISTS couverture_minimale (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  jour          TEXT NOT NULL CHECK (jour IN ('lun','mar','mer','jeu','ven','sam')),
  service       TEXT NOT NULL CHECK (service IN ('midi','soir')),
  nb_personnes  INTEGER NOT NULL DEFAULT 2,
  bar_requis    BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (restaurant_id, jour, service)
);

CREATE INDEX IF NOT EXISTS idx_couverture_restaurant ON couverture_minimale (restaurant_id);

-- ============================================================
-- 4. RLS — dispos_hebdo
-- ============================================================

ALTER TABLE dispos_hebdo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dispos_hebdo_select" ON dispos_hebdo;
DROP POLICY IF EXISTS "dispos_hebdo_write_employe" ON dispos_hebdo;
DROP POLICY IF EXISTS "dispos_hebdo_write_gerant" ON dispos_hebdo;

-- Employees see only their own; managers see all for their restaurant
CREATE POLICY "dispos_hebdo_select" ON dispos_hebdo
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles u
      WHERE u.id = auth.uid()
        AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
    )
  );

-- Employees can insert/update their own
CREATE POLICY "dispos_hebdo_write_employe" ON dispos_hebdo
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Managers can insert/update any row
CREATE POLICY "dispos_hebdo_write_gerant" ON dispos_hebdo
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles u
      WHERE u.id = auth.uid()
        AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
    )
  );

-- ============================================================
-- 5. RLS — couverture_minimale
-- ============================================================

ALTER TABLE couverture_minimale ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couverture_select" ON couverture_minimale;
DROP POLICY IF EXISTS "couverture_all_gerant" ON couverture_minimale;

-- Everyone can read (needed to display coverage in employee view)
CREATE POLICY "couverture_select" ON couverture_minimale
  FOR SELECT USING (true);

-- Only managers can write
CREATE POLICY "couverture_all_gerant" ON couverture_minimale
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles u
      WHERE u.id = auth.uid()
        AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
    )
  );

-- ============================================================
-- 6. updated_at trigger for dispos_hebdo
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS
$$BEGIN NEW.updated_at = now(); RETURN NEW; END;$$;

DROP TRIGGER IF EXISTS dispos_hebdo_updated_at ON dispos_hebdo;
CREATE TRIGGER dispos_hebdo_updated_at
  BEFORE UPDATE ON dispos_hebdo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
