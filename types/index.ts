export type Role = 'admin' | 'gerant' | 'bar' | 'serveur' | 'busboy'

export type Lang = 'fr' | 'en'

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
  actif: boolean
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
  statut: 'pending' | 'accepte' | 'refuse' | 'approuve'
  created_at: string
}

export interface PoolShift {
  id: string
  restaurant_id: string
  date: string
  service: string
  pool_total: number
  statut: 'ouvert' | 'ferme'
}

export interface HeuresEmploye {
  id: string
  user_id: string
  date: string
  heures: number
  source: 'import' | 'manuel'
}

export interface Notification {
  id: string
  user_id: string
  type: 'horaire' | 'heures' | 'echange' | 'system'
  message: string
  lu: boolean
  created_at: string
}