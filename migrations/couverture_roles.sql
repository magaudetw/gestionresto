-- Migration: add role/minimum columns to couverture_minimale for roles×services matrix
-- Run this in the Supabase SQL editor before using the new Couverture tab.

ALTER TABLE couverture_minimale
  ADD COLUMN IF NOT EXISTS role    TEXT,
  ADD COLUMN IF NOT EXISTS minimum INTEGER DEFAULT 0;

-- Add unique constraint for the new model (role × service per restaurant)
-- Drop the old one first if it exists under a known name.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'couverture_minimale_restaurant_id_role_service_key'
  ) THEN
    ALTER TABLE couverture_minimale
      ADD CONSTRAINT couverture_minimale_restaurant_id_role_service_key
      UNIQUE (restaurant_id, role, service);
  END IF;
END $$;
