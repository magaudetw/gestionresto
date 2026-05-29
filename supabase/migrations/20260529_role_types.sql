-- role_types table + fix GRANTs for cotes and shift_types

-- ── role_types ──────────────────────────────────────────────────────────────
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

-- Unique index: global roles (NULL restaurant) keyed on slug alone
CREATE UNIQUE INDEX IF NOT EXISTS role_types_global_slug_unique
  ON public.role_types (slug)
  WHERE restaurant_id IS NULL;

-- Unique index: restaurant-specific roles
CREATE UNIQUE INDEX IF NOT EXISTS role_types_restaurant_slug_unique
  ON public.role_types (slug, restaurant_id)
  WHERE restaurant_id IS NOT NULL;

-- RLS
ALTER TABLE public.role_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_types_select" ON public.role_types;
CREATE POLICY "role_types_select" ON public.role_types
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "role_types_admin_write" ON public.role_types;
CREATE POLICY "role_types_admin_write" ON public.role_types
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND 'admin' = ANY(roles)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND 'admin' = ANY(roles)
    )
  );

GRANT SELECT           ON public.role_types TO authenticated;
GRANT ALL              ON public.role_types TO service_role;

-- Default global role types
INSERT INTO public.role_types (restaurant_id, nom, slug, coefficient_pourboire, couleur, icone)
VALUES (NULL, 'Admin',            'admin',   1.0, '#E07070', '🔧')
ON CONFLICT (slug) WHERE restaurant_id IS NULL DO NOTHING;

INSERT INTO public.role_types (restaurant_id, nom, slug, coefficient_pourboire, couleur, icone)
VALUES (NULL, 'Gérant',           'gerant',  1.0, '#C9A84C', '👔')
ON CONFLICT (slug) WHERE restaurant_id IS NULL DO NOTHING;

INSERT INTO public.role_types (restaurant_id, nom, slug, coefficient_pourboire, couleur, icone)
VALUES (NULL, 'Barman/Barmaid',   'bar',     1.0, '#7EB8F7', '🍸')
ON CONFLICT (slug) WHERE restaurant_id IS NULL DO NOTHING;

INSERT INTO public.role_types (restaurant_id, nom, slug, coefficient_pourboire, couleur, icone)
VALUES (NULL, 'Serveur/Serveuse', 'serveur', 1.0, '#82E0AA', '🍽️')
ON CONFLICT (slug) WHERE restaurant_id IS NULL DO NOTHING;

INSERT INTO public.role_types (restaurant_id, nom, slug, coefficient_pourboire, couleur, icone)
VALUES (NULL, 'Busboy',           'busboy',  0.5, '#C39BD3', '✨')
ON CONFLICT (slug) WHERE restaurant_id IS NULL DO NOTHING;
