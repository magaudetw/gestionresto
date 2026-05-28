-- Phase 8: Finances section — virements table
-- Run this in your Supabase SQL editor

-- ============================================================
-- 1. virements — one row per employee per week, tracks payment status
-- ============================================================

CREATE TABLE IF NOT EXISTS virements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id      UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  semaine_du         DATE NOT NULL,
  montant_salaire    NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_pourboires NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_total      NUMERIC(10,2) NOT NULL DEFAULT 0,
  statut             TEXT NOT NULL DEFAULT 'en_attente'
                       CHECK (statut IN ('en_attente', 'effectue')),
  effectue_le        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, user_id, semaine_du)
);

CREATE INDEX IF NOT EXISTS idx_virements_restaurant ON virements (restaurant_id, semaine_du DESC);
CREATE INDEX IF NOT EXISTS idx_virements_user       ON virements (user_id);

-- ============================================================
-- 2. RLS
-- ============================================================

ALTER TABLE virements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "virements_select"    ON virements;
DROP POLICY IF EXISTS "virements_all_gerant" ON virements;

-- Employees see only their own virements
CREATE POLICY "virements_select" ON virements
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles u
      WHERE u.id = auth.uid()
        AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
    )
  );

-- Only managers can write
CREATE POLICY "virements_all_gerant" ON virements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles u
      WHERE u.id = auth.uid()
        AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
    )
  );
