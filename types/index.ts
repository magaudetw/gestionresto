export type Role = 'admin' | 'gerant' | 'bar' | 'serveur' | 'busboy'

export type Lang = 'fr' | 'en'

export type Jour = 'lun' | 'mar' | 'mer' | 'jeu' | 'ven' | 'sam'

export type Service = 'midi' | 'soir' | 'les_deux'

export interface DisposBase {
  jours: Jour[]
  services: Service[]
  contraintes: string
}

export type EchangeStatut = 'en_attente' | 'accepte' | 'refuse' | 'approuve' | 'rejete'

export interface Restaurant {
  id: string
  nom: string
  ville: string
  actif: boolean
}

export interface User {
  id: string
  nom: string
  email: string
  roles: Role[]
  taux_horaire: number
  restaurant_ids: string[]
  lang: Lang
  theme: string
  font_family?: string
  actif: boolean
  dispos_base?: DisposBase
}

export interface ShiftType {
  id: string
  restaurant_id: string
  nom: string
  debut: string
  fin: string
  couleur: string
}

export interface HoraireShift {
  id: string
  restaurant_id: string
  user_id: string
  shift_type_id: string
  date: string
  statut: 'brouillon' | 'publie'
}

export interface Echange {
  id: string
  demandeur_id: string
  recepteur_id: string
  shift_demandeur_id: string
  shift_recepteur_id: string
  statut: EchangeStatut
  commentaire?: string
  created_at: string
  updated_at: string
}

export interface PoolShift {
  id: string
  restaurant_id: string
  date: string
  service: string
  pool_total: number
  pool_carte?: number
  pool_especes?: number
  nb_employes?: number
  statut: 'ouvert' | 'ferme' | 'valide'
}

export interface HeuresEmploye {
  id: string
  user_id: string
  pool_shift_id?: string
  date: string
  heures: number
  source: 'import' | 'manuel' | 'maitre_d'
  import_batch_id?: string
  montant_employe?: number
}

export interface Notification {
  id: string
  user_id: string
  type: 'horaire' | 'heures' | 'echange' | 'system'
  message: string
  lu: boolean
  created_at: string
}

export interface DispoHebdo {
  id: string
  user_id: string
  restaurant_id: string
  semaine_du: string
  dispos: Partial<Record<Jour, ('midi' | 'soir')[] | null>>
  statut: 'brouillon' | 'soumis'
  created_at: string
  updated_at: string
}

export interface CouvertureMinimale {
  id: string
  restaurant_id: string
  jour: Jour
  service: 'midi' | 'soir'
  nb_personnes: number
  bar_requis: boolean
}

export interface Cote {
  id: string
  restaurant_id: string
  nom: string
  pourcentage: number
  actif: boolean
}

export interface ImportMapping {
  nom: string
  date: string
  heures: string
  service?: string
}

export interface ImportConfig {
  id: string
  restaurant_id: string
  col_nom: string
  col_date: string
  col_heures: string
  col_shift: string
  alias_employes: Record<string, string>
  updated_at: string
}

export interface ImportLog {
  id: string
  restaurant_id: string
  fichier_nom: string
  nb_lignes: number
  nb_employes: number
  batch_id: string
  created_at: string
}

export interface Virement {
  id: string
  restaurant_id: string
  user_id: string
  semaine_du: string
  montant_salaire: number
  montant_pourboires: number
  montant_total: number
  statut: 'en_attente' | 'effectue'
  effectue_le: string | null
}
