-- ═══════════════════════════════════════════════════════════════════════════
-- GESTIONRESTO v3 — AUDIT ET CORRECTIONS BASE DE DONNÉES
-- Exécuter dans Supabase SQL Editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. TABLES DE BASE ────────────────────────────────────────────────────────

-- restaurants
CREATE TABLE IF NOT EXISTS public.restaurants (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom        text NOT NULL,
  ville      text,
  actif      boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- profiles (liée à auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id              uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nom             text,
  roles           text[]    DEFAULT '{}',
  taux_horaire    numeric(8,2) DEFAULT 0,
  restaurant_ids  uuid[]    DEFAULT '{}',
  lang            text      DEFAULT 'fr',
  theme           text      DEFAULT 'Or noir',
  font_family     text      DEFAULT 'var(--font-dm-sans), DM Sans, sans-serif',
  font_size       text      DEFAULT 'md',
  actif           boolean   DEFAULT true,
  dispos_base     jsonb,
  created_at      timestamptz DEFAULT now()
);

-- Colonnes manquantes sur profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_family  text DEFAULT 'var(--font-dm-sans), DM Sans, sans-serif';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS font_size    text DEFAULT 'md';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dispos_base  jsonb;

-- shift_types
CREATE TABLE IF NOT EXISTS public.shift_types (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  nom           text NOT NULL,
  debut         text NOT NULL,
  fin           text NOT NULL,
  couleur       text DEFAULT '#7EB8F7',
  actif         boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.shift_types ADD COLUMN IF NOT EXISTS actif boolean DEFAULT true;

-- horaire_shifts
CREATE TABLE IF NOT EXISTS public.horaire_shifts (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift_type_id uuid REFERENCES public.shift_types(id) ON DELETE SET NULL,
  date          date NOT NULL,
  statut        text DEFAULT 'brouillon',  -- brouillon | publie
  created_at    timestamptz DEFAULT now()
);

-- echanges
CREATE TABLE IF NOT EXISTS public.echanges (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  demandeur_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  recepteur_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift_demandeur_id  uuid REFERENCES public.horaire_shifts(id) ON DELETE CASCADE,
  shift_recepteur_id  uuid REFERENCES public.horaire_shifts(id) ON DELETE CASCADE,
  statut              text DEFAULT 'en_attente',
  commentaire         text,
  created_at          timestamptz DEFAULT now()
);
ALTER TABLE public.echanges ADD COLUMN IF NOT EXISTS commentaire text;

-- pool_shifts
CREATE TABLE IF NOT EXISTS public.pool_shifts (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  date          date NOT NULL,
  service       text NOT NULL,  -- midi | soir
  pool_total    numeric(10,2) DEFAULT 0,
  pool_carte    numeric(10,2) DEFAULT 0,
  pool_especes  numeric(10,2) DEFAULT 0,
  statut        text DEFAULT 'ouvert',  -- ouvert | ferme
  notes         text,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.pool_shifts ADD COLUMN IF NOT EXISTS pool_carte   numeric(10,2) DEFAULT 0;
ALTER TABLE public.pool_shifts ADD COLUMN IF NOT EXISTS pool_especes numeric(10,2) DEFAULT 0;
ALTER TABLE public.pool_shifts ADD COLUMN IF NOT EXISTS notes        text;

-- heures_employes
CREATE TABLE IF NOT EXISTS public.heures_employes (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  pool_shift_id uuid REFERENCES public.pool_shifts(id) ON DELETE SET NULL,
  date         date NOT NULL,
  heures       numeric(5,2) NOT NULL,
  source       text DEFAULT 'import',  -- import | manuel
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.heures_employes ADD COLUMN IF NOT EXISTS source text DEFAULT 'import';

-- notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       text NOT NULL,  -- horaire | heures | echange | system
  message    text NOT NULL,
  lu         boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- cotes (déductibles pourboires)
CREATE TABLE IF NOT EXISTS public.cotes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  nom           text NOT NULL,
  pourcentage   numeric(5,2) NOT NULL,
  actif         boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- dispos_hebdo
CREATE TABLE IF NOT EXISTS public.dispos_hebdo (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  semaine_du    date NOT NULL,
  dispos        jsonb NOT NULL DEFAULT '{}',
  note          text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(user_id, semaine_du)
);
ALTER TABLE public.dispos_hebdo ADD COLUMN IF NOT EXISTS note text;

-- couverture_minimale
CREATE TABLE IF NOT EXISTS public.couverture_minimale (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  jour          text NOT NULL,  -- lun | mar | mer | jeu | ven | sam
  service       text NOT NULL,  -- midi | soir
  nb_personnes  int DEFAULT 0,
  bar_requis    boolean DEFAULT false,
  UNIQUE(restaurant_id, jour, service)
);

-- import_config
CREATE TABLE IF NOT EXISTS public.import_config (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  mapping       jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- virements
CREATE TABLE IF NOT EXISTS public.virements (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  pool_shift_id uuid REFERENCES public.pool_shifts(id) ON DELETE SET NULL,
  montant       numeric(10,2) NOT NULL,
  date          date NOT NULL,
  statut        text DEFAULT 'en_attente',  -- en_attente | envoye | confirme
  created_at    timestamptz DEFAULT now()
);

-- role_types
CREATE TABLE IF NOT EXISTS public.role_types (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id        uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  nom                  text NOT NULL,
  slug                 text NOT NULL,
  coefficient_pourboire numeric(3,2) DEFAULT 1.0,
  couleur              text DEFAULT '#7EB8F7',
  icone                text DEFAULT '👤',
  actif                boolean DEFAULT true,
  created_at           timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS role_types_global_slug_unique
  ON public.role_types (slug) WHERE restaurant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS role_types_restaurant_slug_unique
  ON public.role_types (slug, restaurant_id) WHERE restaurant_id IS NOT NULL;

-- ── 2. RLS (Row Level Security) ──────────────────────────────────────────────

ALTER TABLE public.restaurants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_types       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horaire_shifts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.echanges          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_shifts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heures_employes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispos_hebdo      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couverture_minimale ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_types        ENABLE ROW LEVEL SECURITY;

-- ── 3. GRANTS service_role ───────────────────────────────────────────────────

GRANT ALL ON public.restaurants        TO service_role;
GRANT ALL ON public.profiles           TO service_role;
GRANT ALL ON public.shift_types        TO service_role;
GRANT ALL ON public.horaire_shifts     TO service_role;
GRANT ALL ON public.echanges           TO service_role;
GRANT ALL ON public.pool_shifts        TO service_role;
GRANT ALL ON public.heures_employes    TO service_role;
GRANT ALL ON public.notifications      TO service_role;
GRANT ALL ON public.cotes              TO service_role;
GRANT ALL ON public.dispos_hebdo       TO service_role;
GRANT ALL ON public.couverture_minimale TO service_role;
GRANT ALL ON public.import_config      TO service_role;
GRANT ALL ON public.virements          TO service_role;
GRANT ALL ON public.role_types         TO service_role;

-- ── 4. DONNÉES PAR DÉFAUT ───────────────────────────────────────────────────

-- 5 rôles globaux par défaut (restaurant_id = NULL = global)
INSERT INTO public.role_types (nom, slug, coefficient_pourboire, couleur, icone, actif)
VALUES
  ('Admin',    'admin',   1.0, '#E07070', '🔧', true),
  ('Gérant',   'gerant',  1.0, '#C9A84C', '👔', true),
  ('Bar',      'bar',     1.0, '#7EB8F7', '🍸', true),
  ('Serveur',  'serveur', 1.0, '#82E0AA', '🍽️', true),
  ('Busboy',   'busboy',  0.5, '#C39BD3', '✨', true)
ON CONFLICT (slug) WHERE restaurant_id IS NULL DO NOTHING;

-- ── 5. VÉRIFICATION — liste les tables manquantes ───────────────────────────

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'restaurants', 'profiles', 'shift_types', 'horaire_shifts',
    'echanges', 'pool_shifts', 'heures_employes', 'notifications',
    'cotes', 'dispos_hebdo', 'couverture_minimale', 'import_config',
    'virements', 'role_types'
  )
ORDER BY table_name;
