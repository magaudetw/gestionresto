ALTER TABLE public.profiles ALTER COLUMN theme SET DEFAULT 'Or noir';
ALTER TABLE public.profiles ALTER COLUMN font_family SET DEFAULT 'var(--font-dm-sans), DM Sans, sans-serif';
UPDATE public.profiles SET font_family = 'var(--font-dm-sans), DM Sans, sans-serif' WHERE font_family = 'DM Sans';
UPDATE public.profiles SET theme = CASE theme WHEN 'lumiere' THEN 'Lumière' WHEN 'or_noir' THEN 'Or noir' WHEN 'foret' THEN 'Forêt' WHEN 'amethyste' THEN 'Améthyste' WHEN 'ocean' THEN 'Océan' WHEN 'minuit' THEN 'Minuit' WHEN 'bordeaux' THEN 'Bordeaux' WHEN 'ardoise' THEN 'Ardoise' WHEN 'cuivre' THEN 'Cuivre' WHEN 'ivoire' THEN 'Ivoire' WHEN 'brume' THEN 'Brume' WHEN 'craie' THEN 'Craie' ELSE theme END WHERE theme IN ('lumiere','or_noir','foret','amethyste','ocean','minuit','bordeaux','ardoise','cuivre','ivoire','brume','craie');
SELECT id, nom, theme, font_family, font_size FROM public.profiles ORDER BY nom;
