-- Phase 5: Shift exchange system schema updates
-- Run this migration in your Supabase SQL editor

-- ============================================================
-- 1. Echanges table: add missing columns
-- ============================================================

ALTER TABLE echanges
  ADD COLUMN IF NOT EXISTS commentaire  TEXT,
  ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL;

-- ============================================================
-- 2. Statut: migrate from old enum values to new ones
--    Old: en_attente_employe | en_attente_gerant | approuve | refuse | refuse_gerant
--    New: en_attente | accepte | refuse | approuve | rejete
-- ============================================================

-- If statut is a text column, just update existing rows:
UPDATE echanges SET statut = 'en_attente' WHERE statut = 'en_attente_employe';
UPDATE echanges SET statut = 'accepte'    WHERE statut = 'en_attente_gerant';
UPDATE echanges SET statut = 'rejete'     WHERE statut = 'refuse_gerant';
-- 'approuve' and 'refuse' stay the same

-- If statut is a PostgreSQL ENUM type, run this instead
-- (check with: \d echanges)
-- ALTER TYPE echange_statut RENAME VALUE 'en_attente_employe' TO 'en_attente';
-- ALTER TYPE echange_statut ADD VALUE IF NOT EXISTS 'accepte';
-- ALTER TYPE echange_statut ADD VALUE IF NOT EXISTS 'rejete';
-- Then update rows as above, then optionally remove old values.
--
-- Simplest approach if you have an enum: convert to text
-- ALTER TABLE echanges ALTER COLUMN statut TYPE TEXT;

-- ============================================================
-- 3. Auto-update updated_at on row changes
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS echanges_updated_at ON echanges;
CREATE TRIGGER echanges_updated_at
  BEFORE UPDATE ON echanges
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 4. Row Level Security
-- ============================================================

ALTER TABLE echanges ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "echanges_select" ON echanges;
DROP POLICY IF EXISTS "echanges_insert" ON echanges;
DROP POLICY IF EXISTS "echanges_update" ON echanges;
DROP POLICY IF EXISTS "echanges_delete" ON echanges;

-- Employees see only their own exchanges (as sender or receiver)
-- Managers (gerant/admin) see all exchanges in their restaurant(s)
-- We use the users table to check roles

CREATE POLICY "echanges_select" ON echanges
  FOR SELECT USING (
    auth.uid() = demandeur_id
    OR auth.uid() = recepteur_id
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
    )
  );

CREATE POLICY "echanges_insert" ON echanges
  FOR INSERT WITH CHECK (
    auth.uid() = demandeur_id
  );

CREATE POLICY "echanges_update" ON echanges
  FOR UPDATE USING (
    -- Employee can update if they are demandeur or recepteur
    auth.uid() = demandeur_id
    OR auth.uid() = recepteur_id
    -- Manager can update any exchange
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
    )
  );

CREATE POLICY "echanges_delete" ON echanges
  FOR DELETE USING (
    auth.uid() = demandeur_id
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND (u.roles @> ARRAY['gerant'] OR u.roles @> ARRAY['admin'])
    )
  );

-- ============================================================
-- 5. Indexes for common query patterns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_echanges_demandeur  ON echanges (demandeur_id);
CREATE INDEX IF NOT EXISTS idx_echanges_recepteur  ON echanges (recepteur_id);
CREATE INDEX IF NOT EXISTS idx_echanges_statut     ON echanges (statut);
CREATE INDEX IF NOT EXISTS idx_echanges_created_at ON echanges (created_at DESC);
