# GestionResto — Contexte technique
> Lis ce fichier au début de chaque session. Il remplace tous les anciens CONTEXT_*.md.
> Dernière mise à jour : 2026-06-01

---

## 1. Vue d'ensemble

| | |
|---|---|
| **App** | GestionResto — PWA de gestion de restaurant |
| **URL prod** | https://gestionresto.vercel.app |
| **Stack** | Next.js 16 · React 19 · Supabase · TypeScript · Vercel |
| **CSS** | `globals.css` (CSS custom properties) + Tailwind (breakpoints uniquement) |

### Restaurants
| ID | Nom | Notes |
|----|-----|-------|
| 1 | Le Carré | Principal, 42 places |
| 2 | Le Caméléon | En ouverture |

---

## 2. Rôles

```typescript
type Role = 'admin' | 'gerant' | 'bar' | 'serveur' | 'busboy'
```

| Rôle | Accès |
|------|-------|
| admin | Tout + gestion des types de rôles |
| gerant | Tout sauf admin : horaires, finances, équipe, import, réglages restaurant |
| bar / serveur / busboy | Lecture seule : son horaire, sa paie, ses notifications |

Un profil peut avoir **plusieurs rôles** (ex: Noah = `['serveur', 'bar']`).

---

## 3. Structure des fichiers

```
app/
├── (auth)/
│   ├── login/page.tsx            — connexion + mot de passe oublié
│   ├── callback/page.tsx         — handler OAuth / magic-link / reset
│   └── reset-password/page.tsx   — formulaire nouveau mot de passe
├── (app)/
│   ├── layout.tsx                — enveloppe AuthProvider
│   ├── dashboard/page.tsx        — KPIs + vue semaine
│   ├── horaire/page.tsx          — grille semaine (gérant: édition + échanges)
│   ├── equipe/page.tsx           — liste + création/édition employés (gérant)
│   ├── finances/page.tsx         — pool shifts, pourboires, virements (gérant)
│   ├── import/page.tsx           — import Excel Maître-D (gérant)
│   ├── pourboires/page.tsx       — paie de l'employé connecté
│   ├── dispos/page.tsx           — disponibilités hebdo (employé)
│   ├── notifications/page.tsx    — centre de notifications
│   └── reglages/page.tsx         — thème, langue, police + config restaurant (gérant)
│       Tabs gérant: Compte / Apparence / Shifts / Couverture / Cotes [/ Rôles (admin)]
├── api/
│   ├── save-prefs/route.ts           — sauvegarde thème, langue, police
│   ├── manage-profile/route.ts       — créer/modifier un employé
│   ├── manage-shifts/route.ts        — CRUD horaire + publish
│   ├── manage-shifts-config/route.ts — CRUD shift_types
│   ├── manage-cotes/route.ts         — CRUD cotes
│   ├── manage-role-types/route.ts    — CRUD role_types (admin)
│   ├── manage-pool-shifts/route.ts   — insert/calculate/delete pool_shifts
│   └── manage-couverture/route.ts    — upsert couverture_minimale (role×service×jour)
└── globals.css                       — tous les tokens de design + blocs [data-theme]

components/
├── AppShell.tsx     — layout responsive : Header mobile + Sidebar desktop + Navigation mobile
├── Header.tsx       — barre top mobile
├── Sidebar.tsx      — barre latérale desktop
├── Navigation.tsx   — nav bottom mobile (64px)
├── Topbar.tsx       — topbar desktop
├── KpiCard.tsx      — carte KPI réutilisable
└── ShiftPill.tsx    — badge de shift réutilisable

lib/
├── supabase.ts       — createBrowserClient Supabase
├── themes.ts         — THEMES, getTheme(), applyThemeToDocument(), FONTS, themeSlug()
└── auth-context.tsx  — AuthProvider + useAuth() hook

types/index.ts        — tous les types TypeScript
```

---

## 4. Authentification — `useAuth()`

```typescript
const {
  profile,           // profil Supabase (any)
  userId,            // string | null
  restaurantId,      // string | null — restaurant actif (localStorage)
  restaurantName,    // string
  userRestaurants,   // { id: string; nom: string }[]
  setActiveRestaurant,
  isGerant,          // roles.includes('gerant')
  isAdmin,           // roles.includes('admin')
  isManager,         // isGerant || isAdmin
  lang,              // 'fr' | 'en'
  loading,
  refreshProfile,
} = useAuth()
```

Restaurant actif stocké dans `localStorage['active_restaurant_id']`.

---

## 5. Routes API — pattern standard

Toutes les mutations passent par une route API (jamais directement côté client).

```typescript
// Pattern auth commun à toutes les routes
const authHeader = req.headers.get('Authorization') ?? ''
if (!authHeader.startsWith('Bearer ')) return err('Missing Authorization header', 401)

const userClient = createClient(URL, ANON_KEY, {
  global: { headers: { Authorization: authHeader } },
  auth: { persistSession: false },
})
const { data: { user }, error } = await userClient.auth.getUser()
if (error || !user) return err('Unauthorized', 401)

// Vérifier le rôle dans profiles
const { data: profile } = await userClient.from('profiles').select('roles').eq('id', user.id).single()
const roles: string[] = profile?.roles ?? []
if (!roles.includes('gerant') && !roles.includes('admin')) return err('Forbidden', 403)

// Client admin (service_role) pour l'opération
const admin = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
```

**Variables d'env requises :**
```
NEXT_PUBLIC_SUPABASE_URL        # safe to expose
NEXT_PUBLIC_SUPABASE_ANON_KEY   # safe to expose
SUPABASE_SERVICE_ROLE_KEY       # NE JAMAIS préfixer NEXT_PUBLIC_ — server only
```

### Tableau des routes

| Route | Rôle | Actions | Tables |
|---|---|---|---|
| `save-prefs` | tout connecté | — | `profiles` |
| `manage-profile` | gerant, admin | create, update | `profiles` + Supabase Auth |
| `manage-shifts` | gerant, admin | upsert, delete, publish | `horaire_shifts` |
| `manage-shifts-config` | gerant, admin | upsert, delete | `shift_types` |
| `manage-cotes` | gerant, admin | upsert, archive | `cotes` |
| `manage-role-types` | admin | upsert, archive, restore | `role_types` |
| `manage-pool-shifts` | gerant, admin | insert, calculate, delete | `pool_shifts`, `heures_employes` |
| `manage-couverture` | gerant, admin | upsert | `couverture_minimale` |

---

## 6. Schéma Supabase

```sql
restaurants        id, nom, ville, actif
profiles           id (= auth.users.id), nom, roles[], taux_horaire, restaurant_ids[],
                   lang, theme, font_family, actif
shift_types        id, restaurant_id, nom, debut, fin, couleur
horaire_shifts     id, restaurant_id, user_id, shift_type_id, date, statut
echanges           id, demandeur_id, recepteur_id, shift_demandeur_id, shift_recepteur_id,
                   statut, commentaire, created_at, updated_at
pool_shifts        id, restaurant_id, date, service, pool_total, notes, statut
                   statut: 'brouillon' → 'valide'
heures_employes    id, user_id, pool_shift_id, date, heures, source, montant_employe
notifications      id, user_id, type, message, lu, created_at
cotes              id, restaurant_id, nom, pourcentage, actif
role_types         id, slug, nom, coefficient_pourboire, couleur, icone, actif
couverture_minimale id, restaurant_id, role, service, jour, minimum
                   UNIQUE (restaurant_id, role, service, jour)
dispos_hebdo       id, user_id, restaurant_id, semaine_du, dispos, statut
import_config      id, restaurant_id, col_nom, col_date, col_heures, col_shift, alias_employes
virements          id, restaurant_id, user_id, semaine_du, montant_salaire,
                   montant_pourboires, montant_total, statut, effectue_le
```

**RLS** activé sur toutes les tables. Mutations via routes API uniquement.

---

## 7. Thèmes — 6 thèmes actuels

Définis dans `lib/themes.ts` et dans `app/globals.css` (`[data-theme="slug"]`).

| Nom | Type | Accent | Fond | Sidebar |
|---|---|---|---|---|
| **Professionnel** | Clair (défaut) | `#0B6B73` | `#F5F7FA` | `#0B3D42` |
| Sauge | Clair | `#5A8562` | `#F3F6F1` | `#2A4830` |
| Ardoise bleu | Clair | `#3B6BA0` | `#F0F4F8` | `#1A3252` |
| Minuit pro | Sombre | `#2DC4D0` | `#0A1A1C` | `#061010` |
| Forêt noire | Sombre | `#3EB870` | `#0A1410` | `#060E08` |
| Bordeaux pro | Sombre | `#C2395D` | `#14080E` | `#0A050A` |

- Tous ont `sidebarIsDark: true` et `accentCoral: '#E8855A'`
- `themeSlug('Forêt noire')` → `'foret_noire'`
- `applyThemeToDocument(themeName, fontFamily)` applique le thème au document

---

## 8. Polices — `FONTS` dans `lib/themes.ts`

6 polices disponibles, sauvegardées dans `profiles.font_family`.  
Google Fonts chargées dynamiquement via `<link>` dans le DOM.

---

## 9. Logique métier clé

### Pourboires — calcul pool
```
Points_i = coefficient_i × heures_i        (coefficient depuis role_types.coefficient_pourboire)
Part_i   = (Points_i / ΣPoints) × pool_total
```
Résultat → `heures_employes.montant_employe`  
Déclenché via `/api/manage-pool-shifts` action `calculate`.

### Workflow pool_shifts
```
Gérant saisit → statut: 'brouillon'
Gérant calcule → statut: 'valide' + montant_employe rempli
Virement → marqué 'effectue' par employé
```

### Couverture minimale
Grille 4 rôles × 2 services × 7 jours = 56 cellules.  
Clé state: `role_service_jour` (ex: `'serveur_midi_lun'`).

### Import Maître-D
- Fichiers `.xlsx / .xls / .csv`
- Mapping colonnes sauvegardé dans `localStorage['gr_import_mapping']`
- Arrondi quart d'heure : `Math.round(h * 4) / 4`
- Upsert `heures_employes` + notification `heures` par employé

---

## 10. Migrations SQL en attente

Ces migrations doivent être exécutées dans le **Supabase SQL Editor** si ce n'est pas encore fait.

### Migration A — couverture_minimale (colonne role + minimum)
Fichier : `migrations/couverture_roles.sql`
```sql
ALTER TABLE couverture_minimale
  ADD COLUMN IF NOT EXISTS role    TEXT,
  ADD COLUMN IF NOT EXISTS minimum INTEGER DEFAULT 0;
```

### Migration B — couverture_minimale (colonne jour + contrainte unique finale)
À exécuter APRÈS la migration A :
```sql
ALTER TABLE couverture_minimale
  ADD COLUMN IF NOT EXISTS jour TEXT NOT NULL DEFAULT 'lun'
  CHECK (jour IN ('lun','mar','mer','jeu','ven','sam','dim'));

ALTER TABLE couverture_minimale
  DROP CONSTRAINT IF EXISTS couverture_minimale_restaurant_id_role_service_key;

ALTER TABLE couverture_minimale
  DROP CONSTRAINT IF EXISTS couverture_minimale_unique;

ALTER TABLE couverture_minimale
  ADD CONSTRAINT couverture_minimale_unique
  UNIQUE (restaurant_id, role, service, jour);
```

---

## 11. Navigation par rôle

**Gérant/Admin :**
```
Dashboard → Horaire → Finances → Équipe → Import → Notifications → Réglages
```

**Employé :**
```
Dashboard → Horaire → Paie → Notifications → Réglages
```

---

## 12. Règles de développement

- Toute mutation Supabase → route API avec JWT + rôle (jamais directement côté client)
- `.env*` dans `.gitignore` — ne jamais commit
- `SUPABASE_SERVICE_ROLE_KEY` sans préfixe `NEXT_PUBLIC_`
- Mobile-first, `maxWidth: 480px`, `paddingBottom: 100px` pour le contenu
- Couleurs via `var(--accent)`, `var(--bg)`, etc. (jamais hardcodées)
- Styles inline uniquement quand la valeur doit être interpolée en JS : `background: \`\${t.accent}22\``
- Ne pas toucher `lib/supabase.ts`, `lib/auth-context.tsx`, `types/index.ts` sans bonne raison
