-- Full schema migration for GestionResto
-- Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS guards)

-- ── 1. restaurants ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurants (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom   TEXT NOT NULL,
  ville TEXT NOT NULL DEFAULT 'Montréal',
  actif BOOLEAN NOT NULL DEFAULT true
);

GRANT SELECT ON public.restaurants TO anon, authenticated, service_role;

INSERT INTO public.restaurants (nom, ville, actif)
SELECT 'Le Carré', 'Montréal', true
WHERE NOT EXISTS (SELECT 1 FROM public.restaurants WHERE nom = 'Le Carré');

INSERT INTO public.restaurants (nom, ville, actif)
SELECT 'Le Caméléon', 'Montréal', true
WHERE NOT EXISTS (SELECT 1 FROM public.restaurants WHERE nom = 'Le Caméléon');

-- ── 2. couverture_minimale ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.couverture_minimale (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  jour          TEXT NOT NULL CHECK (jour IN ('lun','mar','mer','jeu','ven','sam')),
  service       TEXT NOT NULL CHECK (service IN ('midi','soir')),
  nb_personnes  INT  NOT NULL DEFAULT 0,
  bar_requis    BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (restaurant_id, jour, service)
);

GRANT ALL ON public.couverture_minimale TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.couverture_minimale TO authenticated;

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

-- ── 3. horaire_shifts ─────────────────────────────────────────────────────────
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

-- ── 4. echanges ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.echanges (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demandeur_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recepteur_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift_demandeur_id  UUID NOT NULL REFERENCES public.horaire_shifts(id) ON DELETE CASCADE,
  shift_recepteur_id  UUID NOT NULL REFERENCES public.horaire_shifts(id) ON DELETE CASCADE,
  statut              TEXT NOT NULL DEFAULT 'en_attente'
                        CHECK (statut IN ('en_attente','accepte','refuse','approuve','rejete')),
  commentaire         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.echanges TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.echanges TO authenticated;

ALTER TABLE public.echanges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can access echanges" ON public.echanges;
CREATE POLICY "Participants can access echanges"
  ON public.echanges FOR ALL TO authenticated
  USING (
    demandeur_id = auth.uid()
    OR recepteur_id = auth.uid()
    OR public.get_current_user_roles() @> ARRAY['gerant'::text]
    OR public.get_current_user_roles() @> ARRAY['admin'::text]
  )
  WITH CHECK (
    demandeur_id = auth.uid()
    OR public.get_current_user_roles() @> ARRAY['gerant'::text]
    OR public.get_current_user_roles() @> ARRAY['admin'::text]
  );

-- ── 5. notifications ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'info',
  message    TEXT NOT NULL,
  lu         BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_uid_lu ON public.notifications (user_id, lu);

GRANT ALL ON public.notifications TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notifications" ON public.notifications;
CREATE POLICY "Users manage own notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    OR public.get_current_user_roles() @> ARRAY['gerant'::text]
    OR public.get_current_user_roles() @> ARRAY['admin'::text]
  );

-- ── 6. dispos_hebdo ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dispos_hebdo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  semaine_du    DATE NOT NULL,
  dispos        JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, restaurant_id, semaine_du)
);

GRANT ALL ON public.dispos_hebdo TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.dispos_hebdo TO authenticated;

ALTER TABLE public.dispos_hebdo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees manage own dispos" ON public.dispos_hebdo;
CREATE POLICY "Employees manage own dispos"
  ON public.dispos_hebdo FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_current_user_roles() @> ARRAY['gerant'::text]
    OR public.get_current_user_roles() @> ARRAY['admin'::text]
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.get_current_user_roles() @> ARRAY['gerant'::text]
    OR public.get_current_user_roles() @> ARRAY['admin'::text]
  );

-- ── 7. heures_employes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.heures_employes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  heures        NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.heures_employes TO service_role;
GRANT SELECT ON public.heures_employes TO authenticated;

ALTER TABLE public.heures_employes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own heures" ON public.heures_employes;
CREATE POLICY "Users read own heures"
  ON public.heures_employes FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_current_user_roles() @> ARRAY['gerant'::text]
    OR public.get_current_user_roles() @> ARRAY['admin'::text]
  );

-- ── 8. cotes ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cotes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,
  pourcentage   NUMERIC(5,2) NOT NULL DEFAULT 0,
  actif         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.cotes TO service_role;
GRANT SELECT ON public.cotes TO authenticated;

ALTER TABLE public.cotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers manage cotes" ON public.cotes;
CREATE POLICY "Managers manage cotes"
  ON public.cotes FOR ALL TO authenticated
  USING  (public.get_current_user_roles() @> ARRAY['gerant'::text]
       OR public.get_current_user_roles() @> ARRAY['admin'::text])
  WITH CHECK (public.get_current_user_roles() @> ARRAY['gerant'::text]
           OR public.get_current_user_roles() @> ARRAY['admin'::text]);

DROP POLICY IF EXISTS "All authenticated read cotes" ON public.cotes;
CREATE POLICY "All authenticated read cotes"
  ON public.cotes FOR SELECT TO authenticated USING (true);

-- ── 9. profiles — missing columns ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme       TEXT DEFAULT 'Lumière',
  ADD COLUMN IF NOT EXISTS lang        TEXT DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'DM Sans',
  ADD COLUMN IF NOT EXISTS font_size   TEXT DEFAULT 'md',
  ADD COLUMN IF NOT EXISTS restaurant_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS taux_horaire NUMERIC(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actif BOOLEAN DEFAULT true;

GRANT SELECT ON public.profiles TO service_role;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING  (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── 10. get_current_user_roles() — create if missing ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_current_user_roles()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(roles, '{}')
  FROM public.profiles
  WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_roles() TO authenticated;
