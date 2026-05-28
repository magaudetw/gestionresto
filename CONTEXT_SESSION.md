# CONTEXT_SESSION.md — Résumé de session
## À lire au début de chaque nouvelle session Claude Code

---

## ÉTAT ACTUEL DU PROJET

**Déployé en production :** https://gestionresto.vercel.app  
**Dernière mise en prod :** 2026-05-27  
**Stack :** Next.js 16.2.6 · React 19 · Supabase · TypeScript · Tailwind CSS · recharts · SheetJS (xlsx)

---

## FICHIERS CRÉÉS / MODIFIÉS DANS CETTE SESSION

### Nouveaux fichiers
| Fichier | Description |
|---------|-------------|
| `lib/themes.ts` | 11 thèmes + 6 polices. Fonctions `getTheme()`, `THEME_NAMES`, `FONTS` |
| `app/(app)/horaire/page.tsx` | Horaire hebdo + mode édition gérant + échanges de shifts |
| `app/(app)/pourboires/page.tsx` | Paie employé : salaire + pourboires + liste shifts |
| `app/(app)/notifications/page.tsx` | Notifications Supabase, marquer lu/tout lire |
| `app/(app)/reglages/page.tsx` | Thème (11), police (6 + Google Fonts), langue FR/EN, reset mdp |
| `app/(app)/equipe/page.tsx` | Liste employés + modal création/édition (gérant seulement) |
| `app/(app)/finances/page.tsx` | Finances gérant : KPIs, graphe recharts, tableau pool_shifts, cotes |
| `app/(app)/import/page.tsx` | Import Excel Maître-D : drag&drop, mapping colonnes, notifications |

### Fichiers modifiés
| Fichier | Changement |
|---------|------------|
| `app/(app)/dashboard/page.tsx` | Vue gérant (shifts today, échanges, heures semaine, dernier import) + vue employé (prochain shift, paie estimée, notifs) |
| `types/index.ts` | Ajout `EchangeStatut`, `font_family`, `pool_carte`, `pool_especes`, `pool_shift_id`, `Cote`, `ImportMapping` |
| `components/Navigation.tsx` | Nav gérant : remplacement Paie→Finances, ajout Import (`/import`) |

---

## ARCHITECTURE DES PAGES

```
app/
├── page.tsx                    → redirect vers /login
├── layout.tsx                  → PWA layout (Geist font)
├── (auth)/login/page.tsx       ✅ existait déjà
└── (app)/
    ├── dashboard/page.tsx      ✅ amélioré
    ├── horaire/page.tsx        ✅ édition + échanges
    ├── pourboires/page.tsx     ✅
    ├── finances/page.tsx       ✅ gérant seulement
    ├── equipe/page.tsx         ✅ gérant + modal
    ├── import/page.tsx         ✅ gérant seulement
    ├── notifications/page.tsx  ✅
    └── reglages/page.tsx       ✅

lib/
├── supabase.ts                 → client Supabase (inchangé)
└── themes.ts                   ✅ NOUVEAU

components/
├── Header.tsx                  → inchangé
└── Navigation.tsx              ✅ modifié

types/index.ts                  ✅ modifié
```

---

## SYSTÈME DE THÈMES (`lib/themes.ts`)

11 thèmes : Or noir (défaut), Minuit, Bordeaux, Forêt, Ardoise, Cuivre, Améthyste, Océan, Ivoire, Brume, Craie  
Sauvegardé dans `profiles.theme`

Chaque page utilise le pattern :
```typescript
const t = getTheme(profile?.theme)
// Utiliser t.fond, t.surface1, t.surface2, t.accent, t.accentClair,
// t.texte, t.texteSecondaire, t.texteFaible, t.border, t.borderAccent, t.isDark
```

6 polices : Georgia (défaut), Playfair Display, Cormorant, Lora, Helvetica, Courier New  
Sauvegardé dans `profiles.font_family` (⚠️ colonne à créer dans Supabase si pas existante)  
Google Fonts chargées dynamiquement via `<link>` dans le DOM.

---

## NAVIGATION PAR RÔLE

**Gérant (gerant/admin) :**
```
🏠 Dashboard → 📅 Horaire → 📊 Finances → 👥 Équipe → 📥 Import → 🔔 Alertes → ⚙️ Réglages
```

**Employé :**
```
🏠 Dashboard → 📅 Horaire → 💰 Paie → 🔔 Alertes → ⚙️ Réglages
```

---

## LOGIQUE MÉTIER IMPLÉMENTÉE

### Horaire — mode édition (gérant)
- Bouton "Modifier l'horaire" → `editMode = true`
- Chaque jour : bouton "+ Ajouter un shift" → popover bottom-sheet
- Sélection employé + type de shift → `INSERT horaire_shifts` avec `statut: 'brouillon'`
- Bouton "Publier" → `UPDATE statut = 'publie'` + `INSERT notifications` type `horaire` pour tous les employés

### Échanges de shifts
```
Employé A: bouton 🔄 sur son shift
  → modal: choisir collègue (même rôle) + son shift
  → INSERT echanges (statut: 'en_attente_employe') + notif à B

Employé B: badge ⚡ sur le shift + boutons Accepter/Refuser
  → Accepter: statut → 'en_attente_gerant' + notif gérant
  → Refuser: statut → 'refuse' + notif à A

Gérant: section "Échanges en attente" en bas de /horaire
  → Approuver: swap user_id dans horaire_shifts + statut 'approuve' + notifs A et B
  → Refuser: statut 'refuse_gerant' + notifs A et B
```

### Import Maître-D (`/import`)
- Drag & drop `.xlsx/.xls/.csv`
- Mapping colonnes sauvegardé dans `localStorage` (clé: `gr_import_mapping`)
- Matching employé par nom (partial, case-insensitive)
- Dates : ISO string OU numéro sériel Excel
- Arrondi quart d'heure : `Math.round(h * 4) / 4`
- Upsert dans `heures_employes` sur `(user_id, date)`
- Notification `heures` envoyée à chaque employé importé

### Cotes (`/finances`)
- Pas de table Supabase — stockées dans `localStorage` (clé: `gr_cotes`)
- Défaut : `[{ nom: 'Cuisine', pourcentage: 5, actif: true }]`
- Si une vraie table `cotes` est créée dans Supabase, migration à prévoir

---

## SCHÉMA SUPABASE UTILISÉ

```sql
-- Tables existantes utilisées
restaurants       (id, nom, ville, actif)
profiles          (id, nom, roles[], taux_horaire, restaurant_ids[], lang, theme, actif)
                  + font_family TEXT (à ajouter si absent)
shift_types       (id, restaurant_id, nom, debut, fin, couleur)
horaire_shifts    (id, restaurant_id, user_id, shift_type_id, date, statut)
echanges          (id, demandeur_id, recepteur_id, shift_demandeur_id, shift_recepteur_id, statut, created_at)
pool_shifts       (id, restaurant_id, date, service, pool_total, pool_carte, pool_especes, statut)
heures_employes   (id, user_id, pool_shift_id, date, heures, source, created_at)
notifications     (id, user_id, type, message, lu, created_at)
```

**Statuts échange :** `en_attente_employe` | `en_attente_gerant` | `approuve` | `refuse` | `refuse_gerant`

---

## POINTS D'ATTENTION / TODO NEXT SESSION

1. **`profiles.font_family`** — colonne à créer dans Supabase dashboard si elle n'existe pas encore
   ```sql
   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS font_family TEXT;
   ```

2. **`heures_employes.created_at`** — utilisé dans `/dashboard` pour "dernier import", vérifier que la colonne existe avec `DEFAULT now()`

3. **`pool_shifts.pool_carte` / `pool_especes`** — utilisés dans `/finances`, vérifier que les colonnes existent

4. **Cotes** — actuellement en localStorage. Si persistance Supabase souhaitée :
   ```sql
   CREATE TABLE cotes (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, restaurant_id UUID, nom TEXT, pourcentage NUMERIC, actif BOOLEAN DEFAULT true);
   ```

5. **RLS Supabase** — les policies doivent permettre aux gérants de lire/écrire toutes les données du restaurant. À vérifier/configurer.

6. **Page `/finances`** — chiffre d'affaires réel non implémenté (pas de table CA dans le schéma). Seul `pool_shifts.pool_total` est utilisé.

7. **Échanges** — `allEmployees` dans `/horaire` est chargé seulement pour les gérants. Pour les employés, la liste des collègues compatibles vient d'un appel séparé à prévoir si la liste est vide.

8. **Navigation** — supprimé `/pourboires` de la nav gérant (remplacé par `/finances`). Gérant peut quand même aller sur `/pourboires` manuellement.

---

## DÉPENDANCES NPM AJOUTÉES

```json
"recharts": "^3.8.1"
```
(xlsx était déjà présent : `"xlsx": "^0.18.5"`)

---

## COMMANDES UTILES

```bash
npm run dev          # dev local
npx vercel --prod    # déployer en production
npx tsc --noEmit     # vérifier TypeScript
```
