-- Phase 7: Maître-D import system
-- Run this in your Supabase SQL editor

-- ============================================================
-- 1. import_config — one row per restaurant, stores column mapping + aliases
-- ============================================================

CREATE TABLE IF NOT EXISTS import_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  col_nom         TEXT NOT NULL DEFAULT '',
  col_date        TEXT NOT NULL DEFAULT '',
  col_heures      TEXT NOT NULL DEFAULT '',
  col_shift       TEXT DEFAULT '',
  alias_employes  JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. import_logs — one row per import operation for history + undo
-- ============================================================

CREATE TABLE IF NOT EXISTS import_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  fichier_nom     TEXT NOT NULL DEFAULT '',
  nb_lignes       INTEGER NOT NULL DEFAULT 0,
  nb_employes     INTEGER NOT NULL DEFAULT 0,
  batch_id        UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_logs_restaurant ON import_logs (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_logs_batch     ON import_logs (batch_id);

-- ============================================================
-- 3. heures_employes — add import_batch_id column + update source check
-- ============================================================

ALTER TABLE heures_employes
  ADD COLUMN IF NOT EXISTS import_batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_heures_employes_batch ON heures_employes (import_batch_id)
  WHERE import_batch_id IS NOT NULL;

-- Update source CHECK if it exists (drop + recreate)
ALTER TABLE heures_employes DROP CONSTRAINT IF EXISTS heures_employes_source_check;
ALTER TABLE heures_employes ADD CONSTRAINT heures_employes_source_check
  CHECK (source IN ('import', 'manuel', 'maitre_d'));

-- ============================================================
-- 4. RLS — import_config (manager only)
-- ============================================================

ALTER TABLE import_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_config_gerant" ON import_config;

CREATE POLICY "import_config_gerant" ON import_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles u
      WHERE u.id = auth.uid()
        AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
    )
  );

-- ============================================================
-- 5. RLS — import_logs (manager only)
-- ============================================================

ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_logs_gerant" ON import_logs;

CREATE POLICY "import_logs_gerant" ON import_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles u
      WHERE u.id = auth.uid()
        AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
    )
  );
