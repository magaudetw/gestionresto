-- Phase 6: Tips (pourboires) system
-- Run this in your Supabase SQL editor

-- ============================================================
-- 1. cotes table (tip deductions, configured per restaurant)
-- ============================================================

CREATE TABLE IF NOT EXISTS cotes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,
  pourcentage   NUMERIC(5,2) NOT NULL CHECK (pourcentage >= 0 AND pourcentage <= 100),
  actif         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cotes_restaurant ON cotes (restaurant_id);

-- Seed example deductions (optional — remove if not needed)
-- INSERT INTO cotes (restaurant_id, nom, pourcentage, actif)
-- SELECT id, 'Cuisine', 5.0, true FROM restaurants WHERE nom = 'Le Carré';

-- ============================================================
-- 2. pool_shifts — add 'valide' to statut
-- ============================================================

-- If statut is a text column:
-- The application already sends 'valide' as a string — nothing to change.

-- If statut is a CHECK constraint:
ALTER TABLE pool_shifts DROP CONSTRAINT IF EXISTS pool_shifts_statut_check;
ALTER TABLE pool_shifts ADD CONSTRAINT pool_shifts_statut_check
  CHECK (statut IN ('ouvert', 'ferme', 'valide'));

-- ============================================================
-- 3. heures_employes — add montant_employe column
-- ============================================================

ALTER TABLE heures_employes
  ADD COLUMN IF NOT EXISTS montant_employe NUMERIC(10,2);

-- ============================================================
-- 4. Row Level Security — cotes
-- ============================================================

ALTER TABLE cotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cotes_select" ON cotes;
DROP POLICY IF EXISTS "cotes_all_gerant" ON cotes;

-- Everyone can read active cotes (needed for pourboires calculation display)
CREATE POLICY "cotes_select" ON cotes
  FOR SELECT USING (actif = true OR EXISTS (
    SELECT 1 FROM profiles u
    WHERE u.id = auth.uid()
      AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
  ));

-- Only managers can insert/update/delete
CREATE POLICY "cotes_all_gerant" ON cotes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles u
      WHERE u.id = auth.uid()
        AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
    )
  );

-- ============================================================
-- 5. Row Level Security — pool_shifts
-- ============================================================

ALTER TABLE pool_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pool_shifts_select" ON pool_shifts;
DROP POLICY IF EXISTS "pool_shifts_all_gerant" ON pool_shifts;

-- Employees can see validated pool_shifts (linked through heures_employes)
CREATE POLICY "pool_shifts_select" ON pool_shifts
  FOR SELECT USING (
    statut = 'valide'
    OR EXISTS (
      SELECT 1 FROM profiles u
      WHERE u.id = auth.uid()
        AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
    )
  );

-- Only managers can write
CREATE POLICY "pool_shifts_all_gerant" ON pool_shifts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles u
      WHERE u.id = auth.uid()
        AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
    )
  );

-- ============================================================
-- 6. Row Level Security — heures_employes
-- ============================================================

ALTER TABLE heures_employes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "heures_employes_select" ON heures_employes;
DROP POLICY IF EXISTS "heures_employes_all_gerant" ON heures_employes;

-- Employees see only their own rows
CREATE POLICY "heures_employes_select" ON heures_employes
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles u
      WHERE u.id = auth.uid()
        AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
    )
  );

-- Only managers can insert/update
CREATE POLICY "heures_employes_all_gerant" ON heures_employes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles u
      WHERE u.id = auth.uid()
        AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
    )
  );

-- ============================================================
-- 7. Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_heures_employes_user    ON heures_employes (user_id);
CREATE INDEX IF NOT EXISTS idx_heures_employes_date    ON heures_employes (date);
CREATE INDEX IF NOT EXISTS idx_heures_employes_pool    ON heures_employes (pool_shift_id);
CREATE INDEX IF NOT EXISTS idx_pool_shifts_date_svc   ON pool_shifts (restaurant_id, date, service);
