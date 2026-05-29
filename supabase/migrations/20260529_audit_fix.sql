-- ============================================================
-- AUDIT FIX — GestionResto
-- Root cause: profiles.restaurant_ids was int4[], shift_types.restaurant_id
-- was integer — both need to reference the UUID restaurants table.
-- ============================================================

BEGIN;

-- ── 1. Fix shift_types.restaurant_id: int4 → UUID ───────────────────────────

ALTER TABLE public.shift_types ADD COLUMN restaurant_id_uuid UUID;

DO $$
DECLARE
  carre_uuid   UUID;
  cameleon_uuid UUID;
BEGIN
  SELECT id INTO carre_uuid   FROM public.restaurants WHERE nom = 'Le Carré'    LIMIT 1;
  SELECT id INTO cameleon_uuid FROM public.restaurants WHERE nom = 'Le Caméléon' LIMIT 1;

  UPDATE public.shift_types
  SET restaurant_id_uuid = CASE restaurant_id
    WHEN 1 THEN carre_uuid
    WHEN 2 THEN cameleon_uuid
    ELSE NULL
  END;
END $$;

-- Remove rows with unknown restaurant (can't satisfy NOT NULL)
DELETE FROM public.shift_types WHERE restaurant_id_uuid IS NULL;

ALTER TABLE public.shift_types DROP COLUMN restaurant_id;
ALTER TABLE public.shift_types RENAME COLUMN restaurant_id_uuid TO restaurant_id;
ALTER TABLE public.shift_types ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.shift_types ADD CONSTRAINT fk_shift_types_restaurant
  FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- RLS on shift_types
ALTER TABLE public.shift_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers manage shift_types" ON public.shift_types;
CREATE POLICY "Managers manage shift_types"
  ON public.shift_types FOR ALL TO authenticated
  USING  (public.get_current_user_roles() @> ARRAY['gerant'::text]
       OR public.get_current_user_roles() @> ARRAY['admin'::text])
  WITH CHECK (public.get_current_user_roles() @> ARRAY['gerant'::text]
           OR public.get_current_user_roles() @> ARRAY['admin'::text]);

DROP POLICY IF EXISTS "All read shift_types" ON public.shift_types;
CREATE POLICY "All read shift_types"
  ON public.shift_types FOR SELECT TO authenticated USING (true);

-- ── 2. Fix profiles.restaurant_ids: int4[] → text[] with UUIDs ──────────────

ALTER TABLE public.profiles ADD COLUMN restaurant_ids_new TEXT[] DEFAULT '{}';

DO $$
DECLARE
  carre_uuid   TEXT;
  cameleon_uuid TEXT;
BEGIN
  SELECT id::text INTO carre_uuid   FROM public.restaurants WHERE nom = 'Le Carré'    LIMIT 1;
  SELECT id::text INTO cameleon_uuid FROM public.restaurants WHERE nom = 'Le Caméléon' LIMIT 1;

  -- Profiles with only restaurant 1
  UPDATE public.profiles
  SET restaurant_ids_new = ARRAY[carre_uuid]
  WHERE  (1 = ANY(restaurant_ids)) AND NOT (2 = ANY(restaurant_ids));

  -- Profiles with only restaurant 2
  UPDATE public.profiles
  SET restaurant_ids_new = ARRAY[cameleon_uuid]
  WHERE  (2 = ANY(restaurant_ids)) AND NOT (1 = ANY(restaurant_ids));

  -- Profiles with both restaurants
  UPDATE public.profiles
  SET restaurant_ids_new = ARRAY[carre_uuid, cameleon_uuid]
  WHERE  (1 = ANY(restaurant_ids)) AND (2 = ANY(restaurant_ids));
END $$;

ALTER TABLE public.profiles DROP COLUMN restaurant_ids;
ALTER TABLE public.profiles RENAME COLUMN restaurant_ids_new TO restaurant_ids;

-- ── 3. Add email column to profiles ─────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';

-- ── 4. Profiles RLS — SELECT policies ───────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Managers read restaurant profiles" ON public.profiles;
CREATE POLICY "Managers read restaurant profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.get_current_user_roles() @> ARRAY['gerant'::text]
    OR public.get_current_user_roles() @> ARRAY['admin'::text]
  );

-- ── 5. Add missing columns to heures_employes ────────────────────────────────
ALTER TABLE public.heures_employes
  ADD COLUMN IF NOT EXISTS source          TEXT    DEFAULT 'import'
    CHECK (source IN ('import','manuel','maitre_d')),
  ADD COLUMN IF NOT EXISTS import_batch_id UUID,
  ADD COLUMN IF NOT EXISTS pool_shift_id   UUID,
  ADD COLUMN IF NOT EXISTS montant_employe NUMERIC(8,2);

DROP POLICY IF EXISTS "Managers write heures_employes" ON public.heures_employes;
CREATE POLICY "Managers write heures_employes"
  ON public.heures_employes FOR ALL TO authenticated
  USING  (public.get_current_user_roles() @> ARRAY['gerant'::text]
       OR public.get_current_user_roles() @> ARRAY['admin'::text])
  WITH CHECK (public.get_current_user_roles() @> ARRAY['gerant'::text]
           OR public.get_current_user_roles() @> ARRAY['admin'::text]);

-- ── 6. Create pool_shifts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pool_shifts (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID    NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  date          DATE    NOT NULL,
  service       TEXT    NOT NULL CHECK (service IN ('midi','soir')),
  pool_total    NUMERIC(10,2) NOT NULL DEFAULT 0,
  pool_carte    NUMERIC(10,2)          DEFAULT 0,
  pool_especes  NUMERIC(10,2)          DEFAULT 0,
  nb_employes   INT                    DEFAULT 0,
  statut        TEXT    NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert','ferme','valide')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, date, service)
);

GRANT ALL    ON public.pool_shifts TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.pool_shifts TO authenticated;
ALTER TABLE public.pool_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers manage pool_shifts" ON public.pool_shifts;
CREATE POLICY "Managers manage pool_shifts"
  ON public.pool_shifts FOR ALL TO authenticated
  USING  (public.get_current_user_roles() @> ARRAY['gerant'::text]
       OR public.get_current_user_roles() @> ARRAY['admin'::text])
  WITH CHECK (public.get_current_user_roles() @> ARRAY['gerant'::text]
           OR public.get_current_user_roles() @> ARRAY['admin'::text]);

DROP POLICY IF EXISTS "All read pool_shifts" ON public.pool_shifts;
CREATE POLICY "All read pool_shifts"
  ON public.pool_shifts FOR SELECT TO authenticated USING (true);

-- ── 7. Create virements ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.virements (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id      UUID    NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id            UUID    NOT NULL REFERENCES public.profiles(id)    ON DELETE CASCADE,
  semaine_du         DATE    NOT NULL,
  montant_salaire    NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_pourboires NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_total      NUMERIC(10,2) NOT NULL DEFAULT 0,
  statut             TEXT    NOT NULL DEFAULT 'en_attente'
                       CHECK (statut IN ('en_attente','effectue')),
  effectue_le        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL    ON public.virements TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.virements TO authenticated;
ALTER TABLE public.virements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers manage virements" ON public.virements;
CREATE POLICY "Managers manage virements"
  ON public.virements FOR ALL TO authenticated
  USING  (public.get_current_user_roles() @> ARRAY['gerant'::text]
       OR public.get_current_user_roles() @> ARRAY['admin'::text])
  WITH CHECK (public.get_current_user_roles() @> ARRAY['gerant'::text]
           OR public.get_current_user_roles() @> ARRAY['admin'::text]);

DROP POLICY IF EXISTS "Employees read own virements" ON public.virements;
CREATE POLICY "Employees read own virements"
  ON public.virements FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── 8. Create import_config ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.import_config (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  col_nom        TEXT NOT NULL DEFAULT '',
  col_date       TEXT NOT NULL DEFAULT '',
  col_heures     TEXT NOT NULL DEFAULT '',
  col_shift      TEXT NOT NULL DEFAULT '',
  alias_employes JSONB NOT NULL DEFAULT '{}',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id)
);

GRANT ALL    ON public.import_config TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.import_config TO authenticated;
ALTER TABLE public.import_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers manage import_config" ON public.import_config;
CREATE POLICY "Managers manage import_config"
  ON public.import_config FOR ALL TO authenticated
  USING  (public.get_current_user_roles() @> ARRAY['gerant'::text]
       OR public.get_current_user_roles() @> ARRAY['admin'::text])
  WITH CHECK (public.get_current_user_roles() @> ARRAY['gerant'::text]
           OR public.get_current_user_roles() @> ARRAY['admin'::text]);

-- ── 9. Create import_logs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.import_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  fichier_nom   TEXT NOT NULL DEFAULT '',
  nb_lignes     INT  NOT NULL DEFAULT 0,
  nb_employes   INT  NOT NULL DEFAULT 0,
  batch_id      UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL    ON public.import_logs TO service_role;
GRANT SELECT, INSERT, DELETE ON public.import_logs TO authenticated;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers manage import_logs" ON public.import_logs;
CREATE POLICY "Managers manage import_logs"
  ON public.import_logs FOR ALL TO authenticated
  USING  (public.get_current_user_roles() @> ARRAY['gerant'::text]
       OR public.get_current_user_roles() @> ARRAY['admin'::text])
  WITH CHECK (public.get_current_user_roles() @> ARRAY['gerant'::text]
           OR public.get_current_user_roles() @> ARRAY['admin'::text]);

COMMIT;
