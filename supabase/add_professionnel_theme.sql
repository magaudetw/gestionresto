-- Nouveau thème par défaut : Professionnel
ALTER TABLE public.profiles ALTER COLUMN theme SET DEFAULT 'Professionnel';

-- Vérification
SELECT id, nom, theme FROM public.profiles ORDER BY nom;
