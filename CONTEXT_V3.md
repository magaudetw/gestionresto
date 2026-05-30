# GestionResto v3 — Documentation technique

> Référence unique pour l'architecture, le design system, les API et les règles de développement.

---

## 1. Architecture finale

### Stack
- **Framework** : Next.js 16, App Router, TypeScript strict
- **Base de données** : Supabase (PostgreSQL + Auth + RLS)
- **Déploiement** : Vercel
- **CSS** : globals.css avec design tokens + Tailwind pour les breakpoints responsifs uniquement

### Arborescence des fichiers

```
app/
  layout.tsx                    # Root layout — polices Google, globals.css
  page.tsx                      # Redirect → /dashboard (ou /login si non connecté)
  globals.css                   # ← SOURCE UNIQUE de tous les tokens de design

  (auth)/
    login/page.tsx              # Login + mode forgot-password + mode sent
    callback/page.tsx           # Handler OAuth/magic-link/reset-password
    reset-password/page.tsx     # Formulaire nouveau mot de passe

  (app)/
    layout.tsx                  # Enveloppe AuthProvider
    dashboard/page.tsx          # KPIs + vue semaine
    horaire/page.tsx            # Grille semaine × employés (gérant) / vue perso (employé)
    equipe/page.tsx             # Liste + édition des employés (gérant seulement)
    finances/page.tsx           # Pool pourboires + virements (gérant seulement)
    import/page.tsx             # Import CSV heures (gérant seulement)
    pourboires/page.tsx         # Paie & pourboires de l'employé connecté
    dispos/page.tsx             # Disponibilités hebdo de l'employé connecté
    notifications/page.tsx      # Centre de notifications
    reglages/page.tsx           # Préférences thème/langue/police + config restaurant

  api/
    save-prefs/route.ts         # Sauvegarde thème, langue, police (service_role)
    manage-profile/route.ts     # Créer / modifier un employé (gérant, service_role)
    manage-shifts/route.ts      # CRUD horaire + publish + couverture_minimale
    manage-shifts-config/route.ts  # CRUD shift_types (types de quart)
    manage-cotes/route.ts       # CRUD cotes (déductibles pourboires)
    manage-role-types/route.ts  # CRUD role_types (admin seulement)

components/
  AppShell.tsx      # Layout responsive : Header (mobile) + Sidebar (desktop) + Navigation (mobile)
  Header.tsx        # Barre top mobile — restaurant + nom + déconnexion
  Sidebar.tsx       # Barre latérale desktop — nav + switcher de restaurant + profil
  Navigation.tsx    # Barre nav bottom mobile — 64px opaque

lib/
  supabase.ts       # Client browser (createBrowserClient SSR)
  themes.ts         # THEMES, getTheme(), applyThemeToDocument(), FONTS, FONT_SIZES, themeSlug()
  auth-context.tsx  # AuthProvider + useAuth() hook

types/
  index.ts          # Tous les types TypeScript du domaine

supabase/
  audit_v3.sql      # SQL complet — CREATE TABLE IF NOT EXISTS + ALTER + RLS + grants
```

### Flux d'authentification

1. `supabase.auth.signIn` → cookie JWT stocké côté navigateur
2. `AuthProvider` lit le profil via `supabase.from('profiles').select(...)` au mount
3. `useAuth()` expose : `profile`, `userId`, `restaurantId`, `isGerant`, `isAdmin`, `isManager`, `loading`, `refreshProfile`, `restaurantName`, `userRestaurants`, `setActiveRestaurant`
4. Restaurant actif : `localStorage['active_restaurant_id']`
5. Reset mot de passe : login → forgot → email → `/auth/callback` → `/reset-password`

---

## 2. Système de design

### Source unique : `app/globals.css`

Tous les tokens sont définis dans `:root` et dans les blocs `[data-theme="..."]`.  
Ne jamais hardcoder de couleur, taille de police, radius ou shadow dans les composants.

### Espacement

```css
--space-1: 4px    --space-2: 8px    --space-3: 12px   --space-4: 16px
--space-5: 20px   --space-6: 24px   --space-8: 32px   --space-10: 40px
```

### Typographie

Base contrôlée par `applyThemeToDocument()` via `--font-size-base` :

| Taille de police préf. | `--font-size-base` |
|---|---|
| sm | 13px |
| md | 15px (défaut) |
| lg | 17px |
| xl | 19px |

Échelle dérivée (à utiliser dans tout nouveau composant) :

| Token | Calcul | ~px (md) |
|---|---|---|
| `--fz-xs`  | base × 0.750 | 11px |
| `--fz-sm`  | base × 0.875 | 13px |
| `--fz-md`  | base         | 15px |
| `--fz-lg`  | base × 1.125 | 17px |
| `--fz-xl`  | base × 1.250 | 19px |
| `--fz-2xl` | base × 1.500 | 22px |
| `--fz-3xl` | base × 1.875 | 28px |
| `--fz-4xl` | base × 2.250 | 34px |

Tokens numériques legacy (`--fz-7` → `--fz-38`) conservés pour compatibilité.

Polices :
```css
--font-title: 'Cormorant Garamond', Georgia, serif  /* titres, brand */
--font-body:  'DM Sans', system-ui, sans-serif       /* corps, UI */
```

### Couleurs sémantiques (variables CSS)

Ces variables sont définies par thème et changent automatiquement :

```css
/* Fonds */
--bg           /* fond principal */
--surface1     /* cartes, composants */
--surface2     /* éléments imbriqués */
--surface3     /* surbrillance hover */

/* Texte */
--text         /* texte principal */
--text-muted   /* texte secondaire */
--text-faint   /* texte discret, désactivé */
--text-inverse /* texte sur fond coloré */

/* Accent */
--accent        /* couleur principale du thème */
--accent-light  /* variante claire */
--accent-hover  /* état hover */
--accent-text   /* texte sur fond accent */
--accent-subtle /* fond teinté accent (rgba ~12%) */

/* Bordures */
--border        /* bordure standard */
--border-strong /* bordure renforcée */

/* Statuts sémantiques */
--danger   / --danger-subtle
--success  / --success-subtle
--warning  / --warning-subtle
--info     / --info-subtle

/* Sidebar (desktop) */
--sidebar-bg
--sidebar-text
--sidebar-text-muted
--sidebar-text-faint
--sidebar-border
--sidebar-active-bg

/* Ombres */
--shadow-sm / --shadow-md / --shadow-lg / --shadow-accent
```

### Border-radius

```css
--radius-xs: 4px   --radius-sm: 6px    --radius-md: 10px
--radius-lg: 14px  --radius-xl: 20px   --radius-full: 9999px
```

### Z-index

```css
--z-header: 30   --z-sidebar: 40   --z-nav-mobile: 45
--z-modal: 50    --z-toast: 60
```

### Navigation

```css
--nav-h: 64px          /* hauteur barre mobile */
--sidebar-w: 240px     /* largeur sidebar (desktop, ouverte) */
--sidebar-collapsed-w: 52px
```

### Classes utilitaires

```html
<!-- Cartes -->
<div class="card">
  <div class="card-header">Titre</div>
  <div class="card-body">Contenu</div>
</div>

<!-- Boutons -->
<button class="btn btn-primary">Action principale</button>
<button class="btn btn-secondary">Secondaire</button>
<button class="btn btn-danger">Danger</button>
<button class="btn btn-ghost">Ghost</button>

<!-- Champ de saisie -->
<input class="input" />

<!-- Badges -->
<span class="badge badge-success">Actif</span>
<span class="badge badge-danger">Erreur</span>
<span class="badge badge-warning">Attention</span>
<span class="badge badge-info">Info</span>
<span class="badge badge-accent">Accent</span>

<!-- Tableau -->
<div class="table-container">
  <table><thead><tr><th>Col</th></tr></thead>
  <tbody><tr><td>Val</td></tr></tbody></table>
</div>

<!-- Alertes -->
<div class="alert-success">Message de succès</div>
<div class="alert-danger">Erreur</div>
<div class="alert-warning">Avertissement</div>
<div class="alert-info">Information</div>

<!-- Titres de section -->
<h2 class="section-heading">Section</h2>
```

### Système dual : CSS vars + objet TypeScript

Certains composants (notamment Sidebar) utilisent les deux systèmes en parallèle :

- **CSS vars** via `data-theme` → pour les classes utilitaires et les styles statiques
- **Objet `Theme`** de `getTheme()` → pour les styles inline dynamiques qui dépendent de la valeur JS

Règle : préférer CSS vars. Utiliser l'objet `Theme` uniquement quand la valeur doit être interpolée dans un style inline JS (ex: `background: \`\${t.accent}28\``).

---

## 3. Routes API

Toutes les routes API suivent le même pattern d'authentification :
1. Vérifier `SUPABASE_SERVICE_ROLE_KEY` dans l'environnement
2. Valider le JWT Bearer dans `Authorization`
3. Vérifier le rôle du caller dans `profiles.roles`
4. Exécuter l'opération via le client `service_role` (bypass RLS)

| Route | Rôle requis | Actions | Tables touchées |
|---|---|---|---|
| `POST /api/save-prefs` | Tout utilisateur connecté | — | `profiles` |
| `POST /api/manage-profile` | gerant, admin | create, update | `profiles` + Supabase Auth |
| `POST /api/manage-shifts` | gerant, admin | upsert, delete, publish, upsert_couverture | `horaire_shifts`, `couverture_minimale` |
| `POST /api/manage-shifts-config` | gerant, admin | upsert, delete | `shift_types` |
| `POST /api/manage-cotes` | gerant, admin | upsert, archive | `cotes` |
| `POST /api/manage-role-types` | admin seulement | upsert, archive, restore | `role_types` |

**Variables d'environnement requises :**
```
NEXT_PUBLIC_SUPABASE_URL      # URL Supabase (safe to expose)
NEXT_PUBLIC_SUPABASE_ANON_KEY # Clé anon (safe to expose)
SUPABASE_SERVICE_ROLE_KEY     # NE PAS préfixer NEXT_PUBLIC_ — server-side only
```

---

## 4. Schéma Supabase

Voir `supabase/audit_v3.sql` pour le SQL complet (CREATE TABLE IF NOT EXISTS + colonnes manquantes + RLS + grants).

| Table | Description principale |
|---|---|
| `restaurants` | Établissements (id, nom, ville, actif) |
| `profiles` | Utilisateurs liés à `auth.users` (rôles, taux horaire, restaurants, préférences) |
| `shift_types` | Types de quart par restaurant (nom, debut, fin, couleur) |
| `horaire_shifts` | Assignations employé × quart × date (statut: brouillon/publie) |
| `echanges` | Demandes d'échange de quart entre employés |
| `pool_shifts` | Pools de pourboires par service (midi/soir) |
| `heures_employes` | Heures travaillées par employé par date (source: import/manuel) |
| `notifications` | Notifications système par utilisateur (type: horaire/heures/echange/system) |
| `cotes` | Déductibles pourboires par restaurant (busboy %, bar %, etc.) |
| `dispos_hebdo` | Disponibilités hebdomadaires soumises par les employés |
| `couverture_minimale` | Nombre minimal d'employés requis par jour/service |
| `import_config` | Configuration du mapping colonnes CSV par restaurant |
| `virements` | Historique des paiements (salaire + pourboires) par employé |
| `role_types` | Types de rôles globaux et par restaurant (coefficient pourboire, couleur) |

**RLS** : activé sur toutes les tables. Les mutations passent par les routes API avec `service_role`.

---

## 5. Thèmes

13 thèmes définis dans `lib/themes.ts` et dans `app/globals.css`.

### Thèmes clairs (4)

| Nom | Accent | Fond |
|---|---|---|
| Lumière | #3B82F6 (bleu) | #F8F9FA |
| Ivoire | #92724A (brun chaud) | #FAF7F2 |
| Brume | #5B7FA6 (bleu ardoise) | #F0F4F8 |
| Craie | #4A4A4A (gris charbon) | #F5F5F0 |

### Thèmes sombres (9)

| Nom | Accent | Fond | Notes |
|---|---|---|---|
| Or noir | #C9A84C (or) | #080808 | |
| Minuit | #58A6FF (bleu GitHub) | #0D1117 | |
| Bordeaux | #9B2335 (bordeaux) | #0F0A0A | |
| Forêt | #4A9B5F (vert) | #0A0F0A | |
| Ardoise | #6B8CAE (bleu ardoise) | #0F1115 | |
| Cuivre | #B87333 (cuivre) | #0F0C08 | |
| Améthyste | #8B5CF6 (violet) | #0D0A12 | |
| Océan | #0EA5E9 (cyan) | #080D12 | |
| **Professionnel** | #5B8DEF (bleu modern) | #F7F8FA (clair) | Hybride : contenu clair + sidebar sombre #1B2340. Défaut nouveaux utilisateurs. |

### Application du thème

```ts
// Applique le thème au document (appel côté client)
import { applyThemeToDocument } from '@/lib/themes'
applyThemeToDocument(themeName, fontFamily, fontSize)
// → data-theme="or_noir" sur <html>
// → document.documentElement.style.setProperty('--font-size-base', '15px')
// → localStorage: gr-theme-fond, gr-theme-texte, gr-theme-slug, gr-font-size
```

`themeSlug()` convertit le nom en slug ASCII (ex: `"Or noir"` → `"or_noir"`).

---

## 6. Règles de développement

### Ajouter une nouvelle page (employé ou gérant)

1. Créer `app/(app)/ma-page/page.tsx` avec `'use client'`
2. Utiliser `useAuth()` pour obtenir `profile`, `restaurantId`, `isManager`
3. Envelopper dans `<AppShell profile={profile}>...</AppShell>` si la page a son propre layout — sinon le layout `(app)/layout.tsx` s'en charge automatiquement via le shell existant
4. Utiliser uniquement des variables CSS (`var(--bg)`, `var(--accent)`, etc.) pour les couleurs
5. Utiliser `var(--fz-sm)`, `var(--fz-md)` etc. pour les tailles de police — jamais de px hardcodés
6. Ajouter le lien dans `NAV_GERANT` ou `NAV_EMPLOYE` dans `Navigation.tsx` et `Sidebar.tsx`

### Ajouter une route API

1. Créer `app/api/mon-endpoint/route.ts`
2. Copier le pattern auth de `manage-shifts/route.ts` (vérifier env → JWT → rôle → admin client)
3. Utiliser `process.env.SUPABASE_SERVICE_ROLE_KEY` (jamais `NEXT_PUBLIC_`)
4. Retourner `NextResponse.json({ ok: true })` ou `{ error: msg }`

### Ajouter un composant

1. Créer dans `components/`
2. Si le composant utilise `usePathname`, `useRouter`, `useState` ou `useEffect` → ajouter `'use client'`
3. Utiliser uniquement CSS vars pour les couleurs, jamais `#xxxxxx` hardcodé
4. Pour les variants dynamiques (style basé sur des props JS), utiliser l'objet `Theme` de `getTheme()`

### Modifier un thème

1. Modifier les valeurs dans `THEMES` dans `lib/themes.ts`
2. Modifier le bloc `[data-theme="slug"]` correspondant dans `globals.css`
3. S'assurer que `themeSlug(nom)` produit le même slug utilisé dans `data-theme`

### Opérations Supabase

- **Lecture** : `supabase.from('table').select(...)` directement côté client (RLS permet la lecture aux utilisateurs connectés)
- **Écriture/mutation** : passer obligatoirement par une route API qui utilise le client `service_role`
- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` côté client

---

## 7. Problèmes connus et TODOs

### Actions manuelles requises (non automatisables)

- [ ] Ajouter `SUPABASE_SERVICE_ROLE_KEY` dans Vercel → Settings → Environment Variables (Production + Preview)
- [ ] Ajouter dans Supabase → Authentication → URL Configuration → Redirect URLs :
  - `https://gestionresto.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`
- [ ] Exécuter `supabase/audit_v3.sql` dans Supabase SQL Editor pour créer les tables manquantes

### Refactoring restant

- [ ] Pages `horaire`, `equipe`, `finances`, `import`, `reglages`, `pourboires`, `dispos`, `notifications` contiennent encore des styles inline avec des valeurs hardcodées — à migrer vers les classes utilitaires `.card`, `.btn-*`, `.input`, etc.
- [ ] `AppShell.tsx` reçoit `profile: any` — à typer avec le type `User` de `types/index.ts`
- [ ] `Sidebar.tsx` reçoit `profile: any` — même chose

### Fonctionnalités incomplètes

- [ ] `dispos/page.tsx` — logique de soumission des disponibilités à compléter
- [ ] `finances/page.tsx` — calcul de répartition des pourboires par coefficient de rôle
- [ ] `import/page.tsx` — parsing CSV + mapping colonnes + preview avant import
- [ ] Notifications temps réel — actuellement polling manuel, pas de Supabase Realtime

### Sécurité

- `.env*` dans `.gitignore` — ne jamais commit
- `SUPABASE_SERVICE_ROLE_KEY` doit rester server-side uniquement (pas de `NEXT_PUBLIC_`)
- Toutes les mutations passent par des routes API avec vérification JWT + rôle

---

*Ce fichier remplace CONTEXT.md et CONTEXT_SESSION.md. Mis à jour : 2026-05-30*
