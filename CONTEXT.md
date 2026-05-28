# CONTEXT.md — GestionResto
## Document de référence complet pour Claude Code
### Lis ce fichier AVANT de faire quoi que ce soit dans ce projet.

---

## 1. VUE D'ENSEMBLE DU PROJET

**Nom de l'app :** GestionResto
**URL de production :** gestionresto.vercel.app
**Type :** Progressive Web App (PWA) — installable sur iOS et Android
**Stack :** Next.js 16 + Supabase + Vercel + TypeScript + Tailwind CSS

### Restaurants
| ID | Nom | Détails |
|----|-----|---------|
| 1  | Le Carré | Restaurant principal, 42 places (35 salle + 7 bar) |
| 2  | Le Caméléon | Nouveau restaurant en ouverture |

---

## 2. STRUCTURE DE L'ÉQUIPE

### Front of House — Le Carré
| Nom | Rôle | Notes |
|-----|------|-------|
| Marc | Gérant / Maître d'hôtel | Gère FOH, finances, marketing, réservations (OpenTable) |
| J-F | Responsable bar/vin | Peut aussi être serveur |
| Noah | Serveur/Barman | Flexible, peut faire bar et salle |
| Mireille | Serveuse | Pas de bar |
| Marius | Serveur | Pas de bar |
| + 2 serveurs | À embaucher | |
| + 1 barman/barmaid | À embaucher | |
| + 1 busboy | À embaucher | Temps partiel |

### Cuisine — gérée par Yann (chef exécutif)
Jérôme, Kervin, Joey, Alex, Misha, Romain + plongeurs Armando, Abner

---

## 3. NIVEAUX D'ACCÈS

### Deux niveaux seulement :

**GÉRANT** (Marc + qui il choisit)
- Accès total à tout
- Crée/modifie/archive les comptes employés
- Publie les horaires
- Saisit les pourboires
- Importe les heures Maître-D
- Approuve les échanges de shifts
- Voit les finances complètes
- Configure les shifts, rôles, taux horaires

**EMPLOYÉ** (tous les autres)
- Voit son horaire (lecture seule)
- Voit ses heures importées (lecture seule)
- Voit sa paie : salaire + pourboires + total virement (lecture seule)
- Voit ses notifications
- Peut proposer un échange de shift
- Peut modifier : langue, thème, mot de passe uniquement
- NE VOIT PAS les données des autres employés
- NE VOIT PAS les finances

---

## 4. SYSTÈME DE POURBOIRES

### Règles fondamentales
- **Pool 100% partagé** — tous les pourboires vont dans un pool commun
- **Pas de distinction carte/espèces** pour l'employé — il voit seulement le total à virer
- **Virement bancaire unique** — le restaurant encaisse le cash physique et vire le montant total à chaque employé
- **Arrondi au quart d'heure** le plus proche (ex: 6h22 = 6h15, 6h23 = 6h30)

### Coefficients par rôle
| Rôle | Coefficient |
|------|-------------|
| Gérant/Maître d'hôtel | 1.0 |
| Serveur/Serveuse | 1.0 |
| Barman/Barmaid | 1.0 |
| Busboy | 0.5 |

### Formule de calcul
```
Points individuels = Coefficient × Heures travaillées
Part individuelle = (Points individuels ÷ Total des points) × Pool total
```

### Cotes (déductibles avant répartition)
- Configurables par le gérant (ex: 5% pour la cuisine)
- Activables/désactivables par shift
- Plusieurs cotes possibles

### Ce que l'employé voit dans son app
```
Salaire (Xh × $Y/h)     $XXX.XX
Pourboires (X shifts)    $XXX.XX
─────────────────────────────────
Virement total           $XXX.XX
```
Séparés mais avec grand total. Pas de carte/espèces visibles.

---

## 5. SYSTÈME DE PAIE

### Taux horaire
- Configurable individuellement par employé par le gérant
- Visible par le gérant pour tout le monde
- Visible par l'employé pour lui-même seulement

### Heures
- **Gérées par Maître-D** (logiciel de caisse/pointage du restaurant)
- Le gérant **importe un fichier Excel** exporté de Maître-D
- Mapping des colonnes configurable une fois (nom, date, heures, shift)
- Les heures apparaissent pour l'employé **seulement après import** par le gérant
- L'employé voit ses heures en lecture seule — pas de contestation dans l'app

### Estimation semaine prochaine
- Basée sur l'horaire publié
- Heures estimées × taux horaire = salaire estimé
- Pourboires estimés basés sur les moyennes passées
- Clairement indiqué "estimation"

---

## 6. HORAIRES

### Types de shifts (configurables par le gérant)
| Nom | Début | Fin | Couleur |
|-----|-------|-----|---------|
| Ouverture | 10:30 | 16:00 | #F4A261 |
| Midi | 11:30 | 16:00 | #F4A261 |
| Soir | 17:00 | 23:00 | #7EB8F7 |
| Journée | 11:30 | 23:00 | #82E0AA |
| Fermeture | 17:00 | 00:00 | #C39BD3 |

Le gérant peut ajouter/renommer/modifier les couleurs et heures des shifts.

### Échanges de shifts
- Un employé propose un échange à un collègue
- **Seulement entre employés du même rôle** (ex: serveur ↔ serveur)
- Un employé peut avoir plusieurs rôles (ex: Noah = serveur + barman)
- L'autre employé accepte ou refuse
- Le gérant approuve ou refuse finalement
- Notifications à toutes les étapes

### Jours d'opération — Le Carré
- Ouvert : Lundi au Samedi
- Fermé : Dimanche
- Marc absent le lundi (mais le resto est ouvert — J-F assume)
- Mireille : disponibilités flexibles, communiquées 2 semaines à l'avance

---

## 7. NOTIFICATIONS

### Types
- `horaire` — horaire publié ou modifié
- `heures` — heures importées disponibles
- `echange` — demande/acceptation/refus/approbation d'échange
- `system` — messages système

### Canal
- Push in-app uniquement (pas d'email pour l'instant)
- Badge sur l'icône de navigation

---

## 8. STYLE VISUEL

### Principe
- Design moderne, épuré, premium
- Inspiré des apps de restauration haut de gamme
- Mobile-first, max-width 480px, centré

### Couleurs par défaut (thème "Or noir")
```
Fond principal:    #080808
Surface 1:         #111111
Surface 2:         #1A1A1A
Surface 3:         #222222
Accent (or):       #C9A84C
Accent clair:      #E8C96A
Texte:             #F0EBE3
Texte secondaire:  rgba(240,235,227,0.5)
Texte faible:      rgba(240,235,227,0.18)
Bordure:           rgba(240,235,227,0.08)
Bordure accent:    rgba(201,168,76,0.3)
Danger:            #E07070
Succès:            #72BA80
Avertissement:     #E0A850
Info:              #7EB8F7
```

### 11 Thèmes disponibles
Or noir, Minuit, Bordeaux, Forêt, Ardoise, Cuivre, Améthyste, Océan, Ivoire, Brume, Craie

### Typographie
- Titres : Georgia / Playfair Display, font-weight 300
- Corps : Georgia, serif
- Chiffres/monospace : Courier New
- Labels : 10-11px, letter-spacing 0.1-0.16em, uppercase

### Composants réutilisables existants
- `components/Header.tsx` — header sticky avec logo, nom resto, déconnexion
- `components/Navigation.tsx` — nav bottom fixe, différente selon rôle

---

## 9. RÔLES DANS L'APP

```typescript
type Role = 'admin' | 'gerant' | 'bar' | 'serveur' | 'busboy'
```

| Rôle | Couleur | Icône |
|------|---------|-------|
| admin | #E07070 | 🔧 |
| gerant | #C9A84C | 👔 |
| bar | #7EB8F7 | 🍸 |
| serveur | #82E0AA | 🍽️ |
| busboy | #C39BD3 | ✨ |

Un employé peut avoir **plusieurs rôles** (ex: Noah = ['serveur', 'bar'])

---

## 10. BASE DE DONNÉES SUPABASE

### Tables
```sql
restaurants       — id, nom, ville, actif
profiles          — id (= auth.users.id), nom, roles[], taux_horaire, restaurant_ids[], lang, theme, actif
shift_types       — id, restaurant_id, nom, debut, fin, couleur
horaire_shifts    — id, restaurant_id, user_id, shift_type_id, date, statut
echanges          — id, demandeur_id, recepteur_id, shift_demandeur_id, shift_recepteur_id, statut
pool_shifts       — id, restaurant_id, date, service, pool_total, statut
heures_employes   — id, user_id, pool_shift_id, date, heures, source
notifications     — id, user_id, type, message, lu, created_at
```

### RLS (Row Level Security) activé sur toutes les tables
- Employé voit seulement ses propres données
- Gérant voit tout

---

## 11. STRUCTURE DES FICHIERS

```
app/
├── page.tsx                    → redirect vers /login
├── layout.tsx                  → layout principal PWA
├── globals.css
├── (auth)/
│   └── login/
│       └── page.tsx            → page de connexion ✅
└── (app)/
    ├── dashboard/
    │   └── page.tsx            → accueil ✅
    ├── horaire/
    │   └── page.tsx            → horaire hebdomadaire
    ├── pourboires/
    │   └── page.tsx            → paie & pourboires
    ├── finances/
    │   └── page.tsx            → finances (gérant seulement)
    ├── equipe/
    │   └── page.tsx            → gestion équipe (gérant seulement)
    ├── notifications/
    │   └── page.tsx            → notifications
    └── reglages/
        └── page.tsx            → réglages compte

components/
├── Header.tsx                  → header ✅
└── Navigation.tsx              → navigation bottom ✅

lib/
└── supabase.ts                 → client Supabase ✅

types/
└── index.ts                    → types TypeScript ✅
```

---

## 12. IMPORT MAÎTRE-D

- Maître-D est le logiciel de caisse/pointage du restaurant
- Il peut exporter les heures en fichier Excel (.xlsx)
- Le gérant importe ce fichier dans l'app
- Mapping des colonnes configurable une fois (à tester avec un vrai fichier)
- Les colonnes typiques : nom employé, date, heures travaillées, type de shift

---

## 13. MULTI-ÉTABLISSEMENTS

- Un utilisateur peut appartenir à plusieurs restaurants
- Le gérant peut switcher entre Le Carré et Le Caméléon depuis le header
- Chaque restaurant a ses propres shifts, horaires, pourboires
- Les données sont isolées par restaurant

---

## 14. PWA

- Installable sur iOS (Safari → Partager → Sur l'écran d'accueil)
- Installable sur Android (Chrome → bannière automatique)
- Manifest configuré dans `public/manifest.json`
- Fonctionne hors-ligne pour les données en cache
- URL : gestionresto.vercel.app

---

## 15. LANGUE

- Bilingue FR/EN
- Chaque utilisateur choisit sa langue dans les réglages
- Sauvegardé dans `profiles.lang`
- Par défaut : français

---

## NOTES IMPORTANTES POUR LE DÉVELOPPEMENT

1. **Toujours vérifier l'auth** au chargement de chaque page — rediriger vers `/` si non connecté
2. **Respecter les niveaux d'accès** — vérifier `profile.roles` avant d'afficher les données sensibles
3. **Pas de distinction carte/espèces** visible pour l'employé dans les pourboires
4. **Arrondi au quart d'heure** pour tous les calculs d'heures
5. **Mobile-first** — maxWidth 480px, navigation en bas fixe, padding-bottom 80px pour le contenu
6. **Thème sauvegardé** dans `profiles.theme` — à appliquer dynamiquement
7. **Pool_total** dans `pool_shifts` = total brut (carte + espèces combinés)
8. Les heures viennent de `heures_employes` importées depuis Maître-D — pas de saisie manuelle par l'employé
