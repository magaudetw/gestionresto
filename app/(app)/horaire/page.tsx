'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'

import { useAuth } from '@/lib/auth-context'
import type { Jour } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const JOURS: Jour[] = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam']

const JOUR_SHORT: Record<Jour, { fr: string; en: string }> = {
  lun: { fr: 'Lun', en: 'Mon' }, mar: { fr: 'Mar', en: 'Tue' },
  mer: { fr: 'Mer', en: 'Wed' }, jeu: { fr: 'Jeu', en: 'Thu' },
  ven: { fr: 'Ven', en: 'Fri' }, sam: { fr: 'Sam', en: 'Sat' },
}

const JOUR_LONG: Record<Jour, { fr: string; en: string }> = {
  lun: { fr: 'Lundi',    en: 'Monday'    }, mar: { fr: 'Mardi',    en: 'Tuesday'   },
  mer: { fr: 'Mercredi', en: 'Wednesday' }, jeu: { fr: 'Jeudi',    en: 'Thursday'  },
  ven: { fr: 'Vendredi', en: 'Friday'    }, sam: { fr: 'Samedi',   en: 'Saturday'  },
}

const MOIS_FR = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc']
const MOIS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const STATUT_CFG: Record<string, { icon: string; color: string; fr: string; en: string }> = {
  en_attente: { icon: '⏳', color: 'var(--warning)', fr: 'En attente',  en: 'Pending'  },
  accepte:    { icon: '✓',  color: 'var(--info)',    fr: 'Accepté',     en: 'Accepted' },
  refuse:     { icon: '✗',  color: 'var(--danger)',  fr: 'Refusé',      en: 'Declined' },
  approuve:   { icon: '✓✓', color: 'var(--success)', fr: 'Approuvé',   en: 'Approved' },
  rejete:     { icon: '✗',  color: 'var(--danger)',  fr: 'Rejeté',      en: 'Rejected' },
}

const ROLE_LABELS_COV: Record<string, { fr: string; en: string }> = {
  gerant:  { fr: 'Gérant',  en: 'Manager' },
  serveur: { fr: 'Serveur', en: 'Server'  },
  bar:     { fr: 'Bar',     en: 'Bar'     },
  busboy:  { fr: 'Busboy',  en: 'Busboy'  },
}

const ROLE_COLORS: Record<string, string> = {
  gerant:  '#C9A84C',
  serveur: '#82E0AA',
  bar:     '#7EB8F7',
  busboy:  '#C39BD3',
  admin:   '#E07070',
}

const ROLE_SHORT: Record<string, string> = {
  gerant: 'GÉR', serveur: 'SRV', bar: 'BAR', busboy: 'BUS', admin: 'ADM',
}

const ROLE_LABELS: Record<string, string> = {
  gerant: 'Gérant', serveur: 'Serveur', bar: 'Bar', busboy: 'Busboy', admin: 'Admin',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date) { return d.toISOString().split('T')[0] }

function getWeekRange(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5)
  return { monday, saturday }
}

function inferService(debut: string): 'midi' | 'soir' {
  const h = parseInt((debut || '').split(':')[0] || '0')
  return h < 15 ? 'midi' : 'soir'
}

function fmtShiftDate(dateStr: string, lang: 'fr' | 'en', MOIS: string[]): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const fr = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
  const en = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const dow = lang === 'fr' ? fr[d.getDay()] : en[d.getDay()]
  return `${dow} ${d.getDate()} ${MOIS[d.getMonth()]}`
}

function avatarColor(nom: string): string {
  let hash = 0
  for (let i = 0; i < nom.length; i++) hash = nom.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${Math.abs(hash) % 360}, 55%, 45%)`
}

function initiales(nom: string): string {
  return nom.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
}

function dureeShift(debut: string, fin: string): string {
  const [dh, dm] = debut.split(':').map(Number)
  const [fh, fm] = fin.split(':').map(Number)
  let mins = (fh * 60 + fm) - (dh * 60 + dm)
  if (mins < 0) mins += 1440
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h${m}` : `${h}h`
}

function getServices(shiftType: any): ('midi' | 'soir')[] {
  if (!shiftType?.debut || !shiftType?.fin) return []
  function toMins(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }
  const debut = toMins(shiftType.debut)
  let fin = toMins(shiftType.fin)
  if (fin <= debut) fin += 24 * 60
  const MIDI_DEBUT = 12 * 60, MIDI_FIN = 13 * 60
  const SOIR_DEBUT = 18 * 60, SOIR_FIN = 19 * 60
  const services: ('midi' | 'soir')[] = []
  if (debut < MIDI_FIN && fin > MIDI_DEBUT) services.push('midi')
  if (debut < SOIR_FIN && fin > SOIR_DEBUT) services.push('soir')
  return services
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CellModal {
  empId: string
  date: string
  jourKey: Jour
  shiftId?: string
  shiftTypeId?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HorairePage() {
  const { profile, userId, restaurantId: ctxRestaurantId, isManager, loading } = useAuth()
  const [weekOffset, setWeekOffset] = useState(0)
  const [activeTab, setActiveTab]   = useState<'horaire' | 'echanges'>('horaire')

  // Week-specific
  const [shifts, setShifts]           = useState<any[]>([])
  const [shiftTypes, setShiftTypes]   = useState<any[]>([])
  const [allEmployees, setAllEmployees] = useState<any[]>([])
  const [employeeMap, setEmployeeMap] = useState<Record<string, any>>({})
  const [disposHebdo, setDisposHebdo] = useState<any[]>([])
  const [couverture, setCouverture]   = useState<any[]>([])
  const [heuresEmp, setHeuresEmp]     = useState<any[]>([])

  // Exchange (not week-filtered)
  const [echanges, setEchanges]           = useState<any[]>([])
  const [historyEchanges, setHistoryEchanges] = useState<any[]>([])

  // Modals
  const [cellModal, setCellModal]           = useState<CellModal | null>(null)
  const [cellStId, setCellStId]             = useState('')
  const [publishModal, setPublishModal]     = useState(false)
  const [proposeModal, setProposeModal]     = useState<{ shift: any } | null>(null)
  const [proposeColleagueId, setProposeColleagueId]     = useState('')
  const [proposeColleagueShiftId, setProposeColleagueShiftId] = useState('')
  const [colleagueShifts, setColleagueShifts] = useState<any[]>([])
  const [respondModal, setRespondModal]     = useState<{ echange: any } | null>(null)
  const [respondAccept, setRespondAccept]   = useState<boolean | null>(null)
  const [respondComment, setRespondComment] = useState('')
  const [approveModal, setApproveModal]     = useState<{ echange: any } | null>(null)
  const [approveReject, setApproveReject]   = useState<boolean | null>(null)
  const [approveComment, setApproveComment] = useState('')

  const [saving, setSaving] = useState(false)

  // Filtres / affichage
  const [filtreRoles, setFiltreRoles]       = useState<string[]>(['gerant','serveur','bar','busboy'])
  const [showOpenShifts, setShowOpenShifts] = useState(true)
  const [groupByRole, setGroupByRole]       = useState(false)
  const [searchEmploye, setSearchEmploye]   = useState('')

  const router = useRouter()

  function toggleFiltreRole(role: string) {
    setFiltreRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
  }

  // ─── Load exchanges (not week-filtered) ──────────────────────────────────
  const loadEchanges = useCallback(async () => {
    if (!profile || !userId) return
    const SEL = '*, demandeur:demandeur_id(id,nom,roles), recepteur:recepteur_id(id,nom,roles), shift_demandeur:shift_demandeur_id(*,shift_types(*)), shift_recepteur:shift_recepteur_id(*,shift_types(*))'

    if (isManager) {
      const [activeRes, histRes] = await Promise.all([
        supabase.from('echanges').select(SEL)
          .in('statut', ['en_attente', 'accepte'])
          .order('created_at', { ascending: false }),
        supabase.from('echanges').select(SEL)
          .in('statut', ['approuve', 'refuse', 'rejete'])
          .gte('created_at', new Date(Date.now() - 28 * 86400000).toISOString())
          .order('created_at', { ascending: false }),
      ])
      setEchanges(activeRes.data || [])
      setHistoryEchanges(histRes.data || [])
    } else {
      const { data } = await supabase.from('echanges').select(SEL)
        .or(`demandeur_id.eq.${userId},recepteur_id.eq.${userId}`)
        .order('created_at', { ascending: false })
      setEchanges(data || [])
    }
  }, [profile, userId, isManager])

  async function loadShiftTypes() {
    if (!ctxRestaurantId) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    const res = await fetch(
      `/api/manage-shifts-config?restaurant_id=${ctxRestaurantId}`,
      { headers: { Authorization: `Bearer ${session.access_token}` } }
    )
    if (!res.ok) { console.error('[horaire] loadShiftTypes error:', res.status); return }
    const json = await res.json()
    setShiftTypes(json.shifts || [])
  }

  async function loadWeekShifts() {
    if (!ctxRestaurantId || !profile || !userId) return
    const { monday, saturday } = getWeekRange(weekOffset)
    const mondayISO   = isoDate(monday)
    const saturdayISO = isoDate(saturday)

    if (isManager) {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch(
        `/api/manage-shifts?restaurant_id=${ctxRestaurantId}&date_start=${mondayISO}&date_end=${saturdayISO}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      )
      if (!res.ok) { console.error('[horaire] loadWeekShifts error:', res.status); return }
      const json = await res.json()
      setShifts(json.shifts || [])
    } else {
      const { data: shiftsData } = await supabase.from('horaire_shifts')
        .select('*, shift_types(*)')
        .gte('date', mondayISO).lte('date', saturdayISO)
        .eq('user_id', userId)
      setShifts(shiftsData || [])
    }
  }

  // ─── Load week data ───────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!profile || !userId) return
    const { monday, saturday } = getWeekRange(weekOffset)
    const restaurantId = ctxRestaurantId
    const mondayISO = isoDate(monday)
    const saturdayISO = isoDate(saturday)

    await loadWeekShifts()

    if (isManager && restaurantId) {
      const { data: { session } } = await supabase.auth.getSession()
      const authHeader = session?.access_token ? `Bearer ${session.access_token}` : ''
      const [empsRes, disposRes, covJson] = await Promise.all([
        supabase.from('profiles').select('id,nom,roles,taux_horaire,dispos_base')
          .contains('restaurant_ids', [restaurantId]).eq('actif', true).order('nom'),
        supabase.from('dispos_hebdo').select('*').eq('restaurant_id', restaurantId).eq('semaine_du', mondayISO),
        fetch(`/api/manage-couverture?restaurant_id=${restaurantId}`, { headers: { Authorization: authHeader } }).then(r => r.json()),
      ])
      await loadShiftTypes()
      const emps = empsRes.data || []
      setAllEmployees(emps)
      setDisposHebdo(disposRes.data || [])
      setCouverture(covJson.couverture || [])
      const map: Record<string, any> = {}
      emps.forEach((e: any) => { map[e.id] = e })
      setEmployeeMap(map)
    } else if (restaurantId) {
      const [heuresRes, empsRes] = await Promise.all([
        supabase.from('heures_employes').select('*')
          .eq('user_id', userId).gte('date', mondayISO).lte('date', saturdayISO),
        supabase.from('profiles').select('id,nom,roles')
          .contains('restaurant_ids', [restaurantId]).eq('actif', true).order('nom'),
      ])
      setHeuresEmp(heuresRes.data || [])
      const emps = empsRes.data || []
      setAllEmployees(emps)
      const map: Record<string, any> = {}
      emps.forEach((e: any) => { map[e.id] = e })
      setEmployeeMap(map)
    }
  }, [profile, userId, ctxRestaurantId, isManager, weekOffset])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { loadEchanges() }, [loadEchanges])

  useEffect(() => {
    if (!proposeColleagueId || !proposeModal) return
    const { monday, saturday } = getWeekRange(weekOffset)
    supabase.from('horaire_shifts').select('*, shift_types(*)')
      .eq('user_id', proposeColleagueId)
      .gte('date', isoDate(monday)).lte('date', isoDate(saturday))
      .then(({ data }) => setColleagueShifts(data || []))
  }, [proposeColleagueId, proposeModal, weekOffset])

  // ─── Shift CRUD ───────────────────────────────────────────────────────────
  async function callShiftsAPI(action: string, payload: Record<string, unknown>): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/manage-shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ action, payload }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) console.error(`[manage-shifts] ${action}:`, json.error, json.hint ?? '')
    return res.ok
  }

  async function addShift() {
    if (!cellModal || !cellStId) return
    setSaving(true)
    await callShiftsAPI('upsert', {
      restaurant_id: ctxRestaurantId, user_id: cellModal.empId,
      shift_type_id: cellStId, date: cellModal.date,
    })
    setCellModal(null)
    await loadData()
    setSaving(false)
  }

  async function updateShift() {
    if (!cellModal?.shiftId || !cellStId) return
    setSaving(true)
    await callShiftsAPI('upsert', { shift_id: cellModal.shiftId, shift_type_id: cellStId })
    setCellModal(null)
    await loadData()
    setSaving(false)
  }

  async function deleteShift(shiftId: string) {
    setSaving(true)
    await callShiftsAPI('delete', { shift_id: shiftId })
    setCellModal(null)
    await loadData()
    setSaving(false)
  }

  async function publishSchedule() {
    setSaving(true)
    const { monday, saturday } = getWeekRange(weekOffset)
    const lang = profile?.lang || 'fr'
    await callShiftsAPI('publish', {
      restaurant_id: ctxRestaurantId,
      week_start: isoDate(monday), week_end: isoDate(saturday),
    })
    const affectedIds = [...new Set(shifts.map((s: any) => s.user_id as string))]
    const weekLabel = `${monday.getDate()}/${monday.getMonth() + 1} – ${saturday.getDate()}/${saturday.getMonth() + 1}`
    const notifs = affectedIds.map(uid => ({
      user_id: uid, type: 'horaire', lu: false,
      message: lang === 'fr'
        ? `L'horaire de la semaine du ${weekLabel} a été publié.`
        : `The schedule for week ${weekLabel} has been published.`,
    }))
    if (notifs.length > 0) await supabase.from('notifications').insert(notifs)
    setPublishModal(false)
    await loadData()
    setSaving(false)
  }

  // ─── Exchange: Step 1 — Propose ───────────────────────────────────────────
  async function proposeExchange() {
    if (!proposeModal || !proposeColleagueId || !proposeColleagueShiftId || !userId) return
    setSaving(true)
    const lang = profile?.lang || 'fr'
    await supabase.from('echanges').insert({
      demandeur_id: userId, recepteur_id: proposeColleagueId,
      shift_demandeur_id: proposeModal.shift.id,
      shift_recepteur_id: proposeColleagueShiftId, statut: 'en_attente',
    })
    await supabase.from('notifications').insert({
      user_id: proposeColleagueId, type: 'echange', lu: false,
      message: lang === 'fr' ? `${profile.nom} vous propose un échange de shift.` : `${profile.nom} is proposing a shift swap with you.`,
    })
    setProposeModal(null)
    setProposeColleagueId('')
    setProposeColleagueShiftId('')
    await Promise.all([loadData(), loadEchanges()])
    setSaving(false)
  }

  // ─── Exchange: Step 2 — Respond ───────────────────────────────────────────
  async function respondExchange(accept: boolean) {
    if (!respondModal || saving) return
    setSaving(true)
    const lang = profile?.lang || 'fr'
    const e = respondModal.echange
    const comment = respondComment.trim()
    if (accept) {
      await supabase.from('echanges').update({ statut: 'accepte' }).eq('id', e.id)
      const restaurantId = profile?.restaurant_ids?.[0]
      const { data: managers } = await supabase.from('profiles')
        .select('id').contains('restaurant_ids', restaurantId ? [restaurantId] : [])
        .or('roles.cs.{gerant},roles.cs.{admin}')
      const managerNotifs = (managers || []).map((m: any) => ({
        user_id: m.id, type: 'echange', lu: false,
        message: lang === 'fr'
          ? `${e.recepteur?.nom} a accepté l'échange avec ${e.demandeur?.nom}. Approbation requise.`
          : `${e.recepteur?.nom} accepted the swap with ${e.demandeur?.nom}. Approval required.`,
      }))
      if (managerNotifs.length > 0) await supabase.from('notifications').insert(managerNotifs)
      await supabase.from('notifications').insert({
        user_id: e.demandeur_id, type: 'echange', lu: false,
        message: lang === 'fr'
          ? `${e.recepteur?.nom} a accepté votre échange. En attente d'approbation du gérant.`
          : `${e.recepteur?.nom} accepted your swap. Awaiting manager approval.`,
      })
    } else {
      await supabase.from('echanges').update({ statut: 'refuse', ...(comment ? { commentaire: comment } : {}) }).eq('id', e.id)
      await supabase.from('notifications').insert({
        user_id: e.demandeur_id, type: 'echange', lu: false,
        message: lang === 'fr'
          ? `${e.recepteur?.nom} a refusé votre demande d'échange.${comment ? ` Motif : ${comment}` : ''}`
          : `${e.recepteur?.nom} declined your swap request.${comment ? ` Reason: ${comment}` : ''}`,
      })
    }
    setRespondModal(null); setRespondAccept(null); setRespondComment('')
    await loadEchanges()
    setSaving(false)
  }

  // ─── Exchange: Step 3 — Approve/Reject ────────────────────────────────────
  async function approveExchange(approve: boolean) {
    if (!approveModal || saving) return
    setSaving(true)
    const lang = profile?.lang || 'fr'
    const e = approveModal.echange
    const comment = approveComment.trim()
    if (approve) {
      await supabase.from('horaire_shifts').update({ user_id: e.recepteur_id }).eq('id', e.shift_demandeur_id)
      await supabase.from('horaire_shifts').update({ user_id: e.demandeur_id }).eq('id', e.shift_recepteur_id)
      await supabase.from('echanges').update({ statut: 'approuve' }).eq('id', e.id)
      const msg = lang === 'fr' ? 'Votre échange de shift a été approuvé ✓' : 'Your shift swap has been approved ✓'
      await supabase.from('notifications').insert([
        { user_id: e.demandeur_id, type: 'echange', message: msg, lu: false },
        { user_id: e.recepteur_id, type: 'echange', message: msg, lu: false },
      ])
    } else {
      await supabase.from('echanges').update({ statut: 'rejete', ...(comment ? { commentaire: comment } : {}) }).eq('id', e.id)
      const msg = lang === 'fr'
        ? `Votre échange a été rejeté par le gérant.${comment ? ` Motif : ${comment}` : ''}`
        : `Your swap was rejected by the manager.${comment ? ` Reason: ${comment}` : ''}`
      await supabase.from('notifications').insert([
        { user_id: e.demandeur_id, type: 'echange', message: msg, lu: false },
        { user_id: e.recepteur_id, type: 'echange', message: msg, lu: false },
      ])
    }
    setApproveModal(null); setApproveReject(null); setApproveComment('')
    await Promise.all([loadData(), loadEchanges()])
    setSaving(false)
  }

  // ─── Exchange: Cancel ─────────────────────────────────────────────────────
  async function cancelExchange(echangeId: string) {
    if (saving) return
    setSaving(true)
    const lang = profile?.lang || 'fr'
    const e = echanges.find((x: any) => x.id === echangeId)
    if (!e) { setSaving(false); return }
    await supabase.from('echanges').update({ statut: 'refuse' }).eq('id', echangeId)
    await supabase.from('notifications').insert({
      user_id: e.recepteur_id, type: 'echange', lu: false,
      message: lang === 'fr' ? `${profile.nom} a annulé sa demande d'échange.` : `${profile.nom} cancelled their swap request.`,
    })
    await loadEchanges()
    setSaving(false)
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) return <div className="loading-screen"><div className="loading-dot">CHARGEMENT...</div></div>

  const lang = (profile?.lang || 'fr') as 'fr' | 'en'
  const font = profile?.font_family || 'Georgia, serif'
  const MOIS = lang === 'fr' ? MOIS_FR : MOIS_EN

  const { monday, saturday } = getWeekRange(weekOffset)
  const today = isoDate(new Date())
  const weekLabel = `${monday.getDate()} ${MOIS[monday.getMonth()]} – ${saturday.getDate()} ${MOIS[saturday.getMonth()]} ${saturday.getFullYear()}`

  const days: Date[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(d)
  }

  const shiftsByDate: Record<string, any[]> = {}
  shifts.forEach(s => {
    if (!shiftsByDate[s.date]) shiftsByDate[s.date] = []
    shiftsByDate[s.date].push(s)
  })

  // Per-employee per-day lookup (array for multiple shifts)
  const shiftsByEmpDate: Record<string, any[]> = {}
  shifts.forEach(s => {
    const key = `${s.user_id}|${s.date}`
    if (!shiftsByEmpDate[key]) shiftsByEmpDate[key] = []
    shiftsByEmpDate[key].push(s)
  })

  // Keep single-entry map for backward compat
  const shiftByEmpDate: Record<string, any> = {}
  shifts.forEach(s => { shiftByEmpDate[`${s.user_id}|${s.date}`] = s })

  const employees = allEmployees.filter((e: any) => !e.roles?.includes('gerant') && !e.roles?.includes('admin'))
  const brouillonCount = shifts.filter((s: any) => s.statut === 'brouillon').length

  // Exchange groupings
  const pendingApprovalCount = echanges.filter((e: any) => e.statut === 'accepte').length
  const myPendingReceived  = echanges.filter((e: any) => e.recepteur_id === userId && e.statut === 'en_attente')
  const myActiveSent       = echanges.filter((e: any) => e.demandeur_id === userId && e.statut === 'en_attente')
  const myInProgress       = echanges.filter((e: any) =>
    (e.demandeur_id === userId || e.recepteur_id === userId) && e.statut === 'accepte'
  )
  const myHistory = echanges.filter((e: any) =>
    (e.demandeur_id === userId || e.recepteur_id === userId) &&
    ['approuve','refuse','rejete'].includes(e.statut)
  )

  // Filtered employees for the grid
  console.log('[filtres] employes roles:', allEmployees.map((e: any) => ({ nom: e.nom, roles: e.roles })))
  console.log('[filtres] filtreRoles actifs:', filtreRoles)
  let employesFiltres = allEmployees.filter((e: any) =>
    e.roles?.some((r: string) => filtreRoles.includes(r)) &&
    (e.nom || '').toLowerCase().includes(searchEmploye.toLowerCase())
  )
  if (groupByRole) {
    const roleOrder = ['gerant','serveur','bar','busboy']
    employesFiltres = [...employesFiltres].sort((a: any, b: any) => {
      const ra = roleOrder.findIndex(r => a.roles?.includes(r))
      const rb = roleOrder.findIndex(r => b.roles?.includes(r))
      return ra - rb || a.nom.localeCompare(b.nom)
    })
  }

  function getEmpDispoInfo(empId: string, jourKey: Jour): { source: 'hebdo' | 'base' | 'unknown'; available: boolean } {
    const hebdo = disposHebdo.find((x: any) => x.user_id === empId)
    if (hebdo) {
      const svcs = hebdo.dispos?.[jourKey]
      return { source: 'hebdo', available: Array.isArray(svcs) && svcs.length > 0 }
    }
    const emp = employeeMap[empId]
    const base = emp?.dispos_base
    if (base?.jours) return { source: 'base', available: base.jours.includes(jourKey) }
    return { source: 'unknown', available: false }
  }

  function cellBg(empId: string, jourKey: Jour): string | undefined {
    const { source, available } = getEmpDispoInfo(empId, jourKey)
    if (source === 'unknown') return undefined
    if (source === 'hebdo') return available ? 'var(--success-subtle)' : 'var(--danger-subtle)'
    return available ? 'var(--warning-subtle)' : 'color-mix(in srgb, var(--danger) 6%, transparent)'
  }

  function getCoverage(dayIdx: number) {
    const dateStr = isoDate(days[dayIdx])
    const jourKey = JOURS[dayIdx]
    const dayShifts = shiftsByDate[dateStr] || []
    const midiShifts = dayShifts.filter((s: any) => getServices(s.shift_types).includes('midi'))
    const soirShifts = dayShifts.filter((s: any) => getServices(s.shift_types).includes('soir'))
    const needMidi = couverture.filter((c: any) => c.jour === jourKey && c.service === 'midi').reduce((s: number, c: any) => s + (c.minimum ?? 0), 0)
    const needSoir = couverture.filter((c: any) => c.jour === jourKey && c.service === 'soir').reduce((s: number, c: any) => s + (c.minimum ?? 0), 0)
    return {
      midi: { ok: needMidi === 0 || midiShifts.length >= needMidi, have: midiShifts.length, need: needMidi },
      soir: { ok: needSoir === 0 || soirShifts.length >= needSoir, have: soirShifts.length, need: needSoir },
    }
  }

  function covColor(have: number, need: number): string {
    if (need === 0) return 'var(--text-faint)'
    if (have === 0) return 'var(--danger)'
    if (have < need) return 'var(--warning)'
    return 'var(--success)'
  }

  function computeAlerts(): string[] {
    const alerts: string[] = []
    const empShiftCount: Record<string, number> = {}
    for (let i = 0; i < 6; i++) {
      const cov = getCoverage(i)
      const js = JOUR_SHORT[JOURS[i]][lang]
      if (!cov.midi.ok && cov.midi.need > 0) alerts.push(lang === 'fr' ? `${js} Midi : ${cov.midi.have}/${cov.midi.need}` : `${js} Lunch: ${cov.midi.have}/${cov.midi.need}`)
      if (cov.soir.need > 0 && cov.soir.have < cov.soir.need) alerts.push(lang === 'fr' ? `${js} Soir : ${cov.soir.have}/${cov.soir.need}` : `${js} Evening: ${cov.soir.have}/${cov.soir.need}`)
    }
    shifts.forEach((s: any) => { empShiftCount[s.user_id] = (empShiftCount[s.user_id] || 0) + 1 })
    const withoutShift = employees.filter((e: any) => !empShiftCount[e.id])
    if (withoutShift.length > 0) alerts.push(lang === 'fr' ? `Sans shift : ${withoutShift.map((e: any) => e.nom.split(' ')[0]).join(', ')}` : `No shifts: ${withoutShift.map((e: any) => e.nom.split(' ')[0]).join(', ')}`)
    return alerts
  }

  function checkExchangeCoverage(e: any): 'ok' | 'warning' {
    const demRoles: string[] = e.demandeur?.roles || []
    const recRoles: string[] = e.recepteur?.roles || []
    return demRoles.some((r: string) => recRoles.includes(r)) ? 'ok' : 'warning'
  }

  const totalHeures = heuresEmp.reduce((sum, h) => sum + (h.heures || 0), 0)
  const payEstimate = totalHeures * (profile?.taux_horaire || 0)

  function getCompatibleColleagues() {
    const myRoles = profile?.roles || []
    return allEmployees.filter((e: any) => e.id !== userId && (e.roles || []).some((r: string) => myRoles.includes(r)))
  }

  function totalHeuresEmp(empId: string): string {
    return shifts
      .filter((s: any) => s.user_id === empId)
      .reduce((sum: number, s: any) => {
        const [dh, dm] = (s.shift_types?.debut || '0:0').split(':').map(Number)
        const [fh, fm] = (s.shift_types?.fin || '0:0').split(':').map(Number)
        let mins = (fh * 60 + fm) - (dh * 60 + dm)
        if (mins < 0) mins += 1440
        return sum + mins / 60
      }, 0)
      .toFixed(1)
  }

  function countAssigned(role: string, service: 'midi' | 'soir', date: string): number {
    return shifts.filter((s: any) => {
      if (s.date !== date) return false
      if (!getServices(s.shift_types).includes(service)) return false
      const employe = allEmployees.find((e: any) => e.id === s.user_id)
      if (!employe) return false
      return employe.roles?.includes(role)
    }).length
  }

  const shiftsCompatibles = cellModal
    ? shiftTypes.filter((st: any) =>
        !st.role || st.role === 'tous' ||
        (employeeMap[cellModal.empId]?.roles || []).includes(st.role)
      )
    : shiftTypes

  // ─── Shared UI helper: exchange card ─────────────────────────────────────
  function EchangeCard({ e, isManager: mgr }: { e: any; isManager?: boolean }) {
    const cfg = STATUT_CFG[e.statut] || STATUT_CFG.en_attente
    const sdSt = e.shift_demandeur?.shift_types
    const srSt = e.shift_recepteur?.shift_types
    const isReceiver = e.recepteur_id === userId
    const isSender   = e.demandeur_id === userId
    const canRespond = isReceiver && e.statut === 'en_attente'
    const canCancel  = isSender   && e.statut === 'en_attente'
    const canApprove = mgr        && e.statut === 'accepte'

    return (
      <div style={{ background: 'var(--surface1)', border: `1px solid ${e.statut === 'accepte' ? 'color-mix(in srgb, var(--info) 35%, transparent)' : 'var(--border)'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)' }}>
            <span>{e.demandeur?.nom?.split(' ')[0]}</span>
            <span style={{ color: 'var(--text-faint)' }}>↔</span>
            <span>{e.recepteur?.nom?.split(' ')[0]}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11 }}>{cfg.icon}</span>
            <span style={{ fontSize: 10, color: cfg.color, letterSpacing: '0.06em' }}>{cfg[lang]}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, background: `${sdSt?.couleur || 'var(--accent)'}14`, borderRadius: 8, padding: '6px 8px' }}>
            <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 2 }}>{e.demandeur?.nom?.split(' ')[0]}</div>
            <div style={{ fontSize: 11, color: 'var(--text)' }}>{sdSt?.nom || '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{fmtShiftDate(e.shift_demandeur?.date, lang, MOIS)}</div>
            {sdSt && <div style={{ fontSize: 9, color: 'var(--text-faint)' }}>{sdSt.debut}–{sdSt.fin}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-faint)', fontSize: 12 }}>⇄</div>
          <div style={{ flex: 1, background: `${srSt?.couleur || 'var(--accent)'}14`, borderRadius: 8, padding: '6px 8px' }}>
            <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 2 }}>{e.recepteur?.nom?.split(' ')[0]}</div>
            <div style={{ fontSize: 11, color: 'var(--text)' }}>{srSt?.nom || '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{fmtShiftDate(e.shift_recepteur?.date, lang, MOIS)}</div>
            {srSt && <div style={{ fontSize: 9, color: 'var(--text-faint)' }}>{srSt.debut}–{srSt.fin}</div>}
          </div>
        </div>
        {e.commentaire && <div style={{ fontSize: 10, color: 'var(--text-faint)', fontStyle: 'italic', marginBottom: 8 }}>"{e.commentaire}"</div>}
        {canRespond && (
          <button onClick={() => { setRespondModal({ echange: e }); setRespondAccept(null); setRespondComment('') }} style={{ width: '100%', padding: '8px', background: 'var(--warning-subtle)', border: 'color-mix(in srgb, var(--warning) 40%, transparent) 1px solid', borderRadius: 8, color: 'var(--warning)', cursor: 'pointer', fontSize: 12, fontFamily: font }}>
            {lang === 'fr' ? '↩ Répondre à cette demande' : '↩ Respond to this request'}
          </button>
        )}
        {canCancel && (
          <button onClick={() => cancelExchange(e.id)} disabled={saving} style={{ width: '100%', padding: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-faint)', cursor: 'pointer', fontSize: 11, fontFamily: font }}>
            {lang === 'fr' ? 'Annuler ma demande' : 'Cancel my request'}
          </button>
        )}
        {canApprove && (
          <button onClick={() => { setApproveModal({ echange: e }); setApproveReject(null); setApproveComment('') }} style={{ width: '100%', padding: '8px', background: 'var(--info-subtle)', border: '1px solid color-mix(in srgb, var(--info) 40%, transparent)', borderRadius: 8, color: 'var(--info)', cursor: 'pointer', fontSize: 12, fontFamily: font, fontWeight: 600 }}>
            {lang === 'fr' ? '↩ Statuer sur cet échange' : '↩ Review this swap'}
          </button>
        )}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (isManager && days.length > 0) {
    console.log('[couverture] shifts lundi:', shifts
      .filter((s: any) => s.date === isoDate(days[0]))
      .map((s: any) => ({
        nom: s.profiles?.nom,
        shift: s.shift_types?.nom,
        debut: s.shift_types?.debut,
        fin: s.shift_types?.fin,
        services: getServices(s.shift_types),
        roles: allEmployees.find((e: any) => e.id === s.user_id)?.roles,
      }))
    )
  }

  return (
    <>
    <style>{`
      .sched-cell { transition: background 0.12s; }
      .sched-cell:hover { background: color-mix(in srgb, var(--accent) 7%, transparent) !important; }
      .sched-cell .cell-add { opacity: 0; transition: opacity 0.12s; }
      .sched-cell:hover .cell-add { opacity: 1; }
    `}</style>
    <AppShell profile={profile} restaurant="Le Carré">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* ── Tab bar ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface1)' }}>
          {(['horaire', 'echanges'] as const).map(tab => {
            const isActive = activeTab === tab
            const badge = tab === 'echanges' ? (isManager ? pendingApprovalCount : myPendingReceived.length) : 0
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '14px 4px', background: 'none', border: 'none', borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`, color: isActive ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontFamily: font, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {tab === 'horaire' ? (lang === 'fr' ? 'Horaire' : 'Schedule') : (lang === 'fr' ? 'Échanges' : 'Swaps')}
                {badge > 0 && <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: '50%', minWidth: 16, height: 16, fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{badge}</span>}
              </button>
            )
          })}
        </div>

        {/* ══════════════ HORAIRE — MANAGER ══════════════ */}
        {activeTab === 'horaire' && isManager && (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

            {/* SIDE PANEL */}
            <div className="horaire-sidebar" style={{ width: 220, flexShrink: 0, background: 'var(--surface1)', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '16px 12px', gap: 20 }}>

              {/* Positions */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{lang === 'fr' ? 'POSITIONS' : 'POSITIONS'}</span>
                  <span style={{ background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 10, padding: '1px 6px', fontSize: 9 }}>{filtreRoles.length}</span>
                </div>
                {(['gerant','serveur','bar','busboy'] as const).map(role => (
                  <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: 'pointer', borderRadius: 6, fontSize: 13, color: 'var(--text)' }}>
                    <input type="checkbox" checked={filtreRoles.includes(role)} onChange={() => toggleFiltreRole(role)} />
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROLE_COLORS[role], flexShrink: 0, display: 'inline-block' }} />
                    {ROLE_LABELS_COV[role]?.[lang] || role}
                  </label>
                ))}
              </div>

              {/* Affichage */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {lang === 'fr' ? 'AFFICHAGE' : 'DISPLAY'}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                  <input type="checkbox" checked={showOpenShifts} onChange={() => setShowOpenShifts(v => !v)} />
                  {lang === 'fr' ? 'Shifts ouverts' : 'Open shifts'}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                  <input type="checkbox" checked={groupByRole} onChange={() => setGroupByRole(v => !v)} />
                  {lang === 'fr' ? 'Grouper par rôle' : 'Group by role'}
                </label>
              </div>

              {/* Dispos link */}
              <div>
                <button onClick={() => router.push('/dispos')} style={{ width: '100%', padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: font, textAlign: 'left' }}>
                  📋 {lang === 'fr' ? 'Disponibilités' : 'Availability'}
                </button>
              </div>

            </div>

            {/* MAIN AREA */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* TOPBAR */}
              <div className="horaire-topbar" style={{ height: 52, background: 'var(--surface1)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', flexShrink: 0 }}>
                {/* Search */}
                <div className="horaire-search" style={{ position: 'relative', flex: 1, maxWidth: 200 }}>
                  <input value={searchEmploye} onChange={e => setSearchEmploye(e.target.value)} placeholder={lang === 'fr' ? 'Employés…' : 'Employees…'} style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 12px 6px 28px', fontSize: 12, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }} />
                  <span style={{ position: 'absolute', left: 9, top: 7, color: 'var(--text-secondary)', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
                </div>
                {/* Week nav */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                  <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: 'var(--text)', fontSize: 16 }}>‹</button>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', minWidth: 160, textAlign: 'center' }}>{weekLabel}</span>
                  <button onClick={() => { if (weekOffset < 4) setWeekOffset(w => w + 1) }} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', cursor: weekOffset >= 4 ? 'default' : 'pointer', color: weekOffset >= 4 ? 'var(--text-faint)' : 'var(--text)', fontSize: 16 }}>›</button>
                </div>
                {/* Publier */}
                <button onClick={() => setPublishModal(true)} disabled={brouillonCount === 0} style={{ background: brouillonCount > 0 ? 'var(--accent-coral, #E8855A)' : 'var(--surface2)', color: brouillonCount > 0 ? '#fff' : 'var(--text-faint)', border: 'none', borderRadius: 20, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: brouillonCount === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {lang === 'fr' ? 'Publier' : 'Publish'}
                  {brouillonCount > 0 && <span style={{ background: '#fff', color: 'var(--accent-coral, #E8855A)', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{brouillonCount}</span>}
                </button>
              </div>

              {/* GRID */}
              <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 180, padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)', background: 'var(--surface1)', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', position: 'sticky', left: 0, top: 0, zIndex: 3 }}>
                        {lang === 'fr' ? 'Employé' : 'Employee'}
                      </th>
                      {days.map((day, di) => {
                        const dateStr = isoDate(day)
                        const isToday = dateStr === today
                        const cov = getCoverage(di)
                        const covOk = cov.midi.ok && cov.soir.ok
                        return (
                          <th key={dateStr} style={{ padding: '8px 6px', textAlign: 'center', background: isToday ? 'color-mix(in srgb, var(--accent) 8%, var(--surface1))' : 'var(--surface1)', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', minWidth: 110, position: 'sticky', top: 0, zIndex: 2 }}>
                            <div style={{ fontSize: 10, color: isToday ? 'var(--accent)' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{JOUR_SHORT[JOURS[di]][lang]}</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--text)', lineHeight: 1.1 }}>{day.getDate()}</div>
                            {couverture.length > 0 && <div style={{ fontSize: 9, color: covOk ? 'var(--success)' : 'var(--danger)', marginTop: 1 }}>{covOk ? '✓' : '✗'}</div>}
                          </th>
                        )
                      })}
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-secondary)', textTransform: 'uppercase', background: 'var(--surface1)', borderBottom: '2px solid var(--border)', minWidth: 60, position: 'sticky', top: 0, zIndex: 2 }}>
                        {lang === 'fr' ? 'Total' : 'Total'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Open shifts row */}
                    {showOpenShifts && (
                      <tr style={{ background: 'var(--surface2)' }}>
                        <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', position: 'sticky', left: 0, background: 'var(--surface2)', zIndex: 1, whiteSpace: 'nowrap' }}>
                          <span style={{ marginRight: 6 }}>📋</span>{lang === 'fr' ? 'Shifts ouverts' : 'Open shifts'}
                        </td>
                        {days.map(day => <td key={isoDate(day)} style={{ borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: 6, minHeight: 48 }} />)}
                        <td style={{ borderBottom: '1px solid var(--border)' }} />
                      </tr>
                    )}
                    {/* Employee rows */}
                    {employesFiltres.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                          {lang === 'fr' ? 'Aucun employé' : 'No employees'}
                        </td>
                      </tr>
                    )}
                    {employesFiltres.map((emp: any, ei: number) => {
                      const rowBg = ei % 2 === 0 ? 'var(--surface1)' : 'color-mix(in srgb, var(--surface2) 40%, var(--surface1))'
                      const hTotal = totalHeuresEmp(emp.id)
                      return (
                        <tr key={emp.id} style={{ background: rowBg }}>
                          <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', position: 'sticky', left: 0, background: rowBg, zIndex: 1, minWidth: 180 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(emp.nom), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                {initiales(emp.nom)}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.nom}</div>
                                <div style={{ display: 'flex', gap: 3, marginTop: 2, flexWrap: 'wrap' }}>
                                  {(emp.roles || []).map((role: string) => (
                                    <span key={role} style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 10, background: `${ROLE_COLORS[role] || 'var(--accent)'}22`, color: ROLE_COLORS[role] || 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                      {ROLE_SHORT[role] || role}
                                    </span>
                                  ))}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1 }}>{hTotal}h</div>
                              </div>
                            </div>
                          </td>
                          {days.map((day, di) => {
                            const dateStr = isoDate(day)
                            const jourKey = JOURS[di]
                            const dayShifts = shiftsByEmpDate[`${emp.id}|${dateStr}`] || []
                            const firstShift = dayShifts[0]
                            const bg = cellBg(emp.id, jourKey)
                            const isToday = dateStr === today
                            return (
                              <td key={dateStr}
                                onClick={() => { setCellModal({ empId: emp.id, date: dateStr, jourKey, shiftId: firstShift?.id, shiftTypeId: firstShift?.shift_type_id }); setCellStId(firstShift?.shift_type_id || '') }}
                                className="sched-cell"
                                style={{ borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: 5, verticalAlign: 'top', minHeight: 60, cursor: 'pointer', background: bg || (isToday ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : 'transparent') }}
                              >
                                {dayShifts.length > 0 ? dayShifts.map((s: any) => {
                                  const st = s.shift_types
                                  return (
                                    <div key={s.id} style={{ background: `${st?.couleur || 'var(--accent)'}18`, borderLeft: `3px solid ${st?.couleur || 'var(--accent)'}`, borderRadius: '0 6px 6px 0', padding: '4px 7px', marginBottom: 3, position: 'relative' }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: st?.couleur || 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st?.nom || '?'}</div>
                                      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{(st?.debut || '').slice(0,5)}–{(st?.fin || '').slice(0,5)}</div>
                                      {st?.debut && st?.fin && <div style={{ fontSize: 9, color: 'var(--text-faint)' }}>{dureeShift(st.debut, st.fin)}</div>}
                                      {s.statut === 'brouillon' && <div style={{ position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', background: 'var(--warning)' }} />}
                                    </div>
                                  )
                                }) : (
                                  <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="cell-add" style={{ fontSize: 20, color: 'var(--accent)' }}>+</span>
                                  </div>
                                )}
                              </td>
                            )
                          })}
                          <td style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {hTotal}h
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>

                  {/* Coverage footer */}
                  {couverture.length > 0 && (() => {
                    const allCovRows = [...new Map(
                      couverture
                        .filter((c: any) => (c.minimum ?? 0) > 0 && c.role)
                        .map((c: any) => [`${c.service}|${c.role}`, { service: c.service as string, role: c.role as string }])
                    ).values()].sort((a, b) =>
                      a.service !== b.service ? (a.service === 'midi' ? -1 : 1) : a.role.localeCompare(b.role)
                    )
                    if (allCovRows.length === 0) return null
                    return (
                      <tfoot>
                        {allCovRows.map(({ service, role }) => (
                          <tr key={`${service}|${role}`} style={{ background: 'var(--surface2)' }}>
                            <td style={{ padding: '5px 14px', fontSize: 10, color: 'var(--text-secondary)', borderRight: '1px solid var(--border)', borderTop: '1px solid var(--border)', position: 'sticky', left: 0, background: 'var(--surface2)', zIndex: 1, whiteSpace: 'nowrap' }}>
                              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: ROLE_COLORS[role] || 'var(--accent)', marginRight: 5 }} />
                              {ROLE_LABELS_COV[role]?.[lang] || role} · {service === 'midi' ? (lang === 'fr' ? 'Midi' : 'Lunch') : (lang === 'fr' ? 'Soir' : 'Evening')}
                            </td>
                            {days.map((day, di) => {
                              const dateStr = isoDate(day)
                              const jourKey = JOURS[di]
                              const dayShifts = shiftsByDate[dateStr] || []
                              const have = countAssigned(role, service as 'midi' | 'soir', dateStr)
                              const need = couverture.find((c: any) => c.jour === jourKey && c.service === service && c.role === role)?.minimum ?? 0
                              return (
                                <td key={dateStr} style={{ padding: '5px 4px', textAlign: 'center', borderRight: '1px solid var(--border)', borderTop: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: covColor(have, need) }}>
                                  {need > 0 ? `${have}/${need}` : '—'}
                                </td>
                              )
                            })}
                            <td style={{ borderTop: '1px solid var(--border)' }} />
                          </tr>
                        ))}
                      </tfoot>
                    )
                  })()}

                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ HORAIRE — EMPLOYEE ══════════════ */}
        {activeTab === 'horaire' && !isManager && (
          <div style={{ flex: 1, overflow: 'auto', padding: 16, paddingBottom: 100 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '8px 13px', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>‹</button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 1 }}>
                  {weekOffset === 0 ? (lang === 'fr' ? 'Cette semaine' : 'This week') : weekOffset === 1 ? (lang === 'fr' ? 'Semaine prochaine' : 'Next week') : weekOffset < 0 ? (lang === 'fr' ? `Il y a ${-weekOffset} sem.` : `${-weekOffset} wk ago`) : (lang === 'fr' ? `Dans ${weekOffset} semaines` : `In ${weekOffset} weeks`)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)' }}>{weekLabel}</div>
              </div>
              <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '8px 13px', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>›</button>
            </div>
            {weekOffset !== 0 && (
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <button onClick={() => setWeekOffset(0)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text-secondary)', fontSize: 10, padding: '3px 12px', cursor: 'pointer', fontFamily: font, letterSpacing: '0.06em' }}>
                  {lang === 'fr' ? '↩ Cette semaine' : '↩ This week'}
                </button>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {days.map((day, di) => {
                const dateStr = isoDate(day)
                const dayShifts = (shiftsByDate[dateStr] || []).filter((s: any) => s.user_id === userId)
                const isToday = dateStr === today
                const isPast = day < new Date() && !isToday
                if (dayShifts.length === 0) {
                  return (
                    <div key={dateStr} style={{ background: 'var(--surface1)', border: `1px solid ${isToday ? 'var(--border-accent)' : 'var(--border)'}`, borderRadius: 12, padding: '10px 14px', opacity: isPast ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: isToday ? 'var(--accent)' : 'var(--text-secondary)' }}>{JOUR_LONG[JOURS[di]][lang]} {day.getDate()} {MOIS[day.getMonth()]}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic' }}>{lang === 'fr' ? 'Congé' : 'Day off'}</span>
                    </div>
                  )
                }
                return dayShifts.map((s: any) => {
                  const st = s.shift_types
                  const couleur = st?.couleur || 'var(--accent)'
                  return (
                    <div key={s.id} style={{ background: isToday ? 'linear-gradient(135deg, var(--surface2), var(--surface1))' : 'var(--surface1)', border: `1px solid ${isToday ? 'var(--border-accent)' : 'var(--border)'}`, borderRadius: 12, padding: '12px 14px', opacity: isPast ? 0.65 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 3, height: 36, borderRadius: 2, background: couleur, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: isToday ? 'var(--accent)' : 'var(--text-secondary)', marginBottom: 3 }}>{JOUR_LONG[JOURS[di]][lang]} {day.getDate()} {MOIS[day.getMonth()]}</div>
                          <div style={{ fontSize: 14, color: 'var(--text)' }}>{st?.nom || '—'}</div>
                          {st && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{st.debut} – {st.fin}</div>}
                        </div>
                        <button onClick={() => { setProposeModal({ shift: s }); setProposeColleagueId(''); setProposeColleagueShiftId('') }} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 9px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 10, fontFamily: font, flexShrink: 0 }}>
                          🔄 {lang === 'fr' ? 'Échange' : 'Swap'}
                        </button>
                      </div>
                    </div>
                  )
                })
              })}
            </div>
            <div style={{ marginTop: 20, background: 'var(--surface1)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>{lang === 'fr' ? 'Estimation paie' : 'Pay estimate'}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <span style={{ fontSize: 22, color: 'var(--accent)' }}>{payEstimate.toFixed(2)}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>$</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{totalHeures.toFixed(1)}h × {profile?.taux_horaire || 0}$/h</div>
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 8, fontStyle: 'italic' }}>* {lang === 'fr' ? 'Estimation — exclut les pourboires' : 'Estimate — excludes tips'}</div>
            </div>
          </div>
        )}

        {/* ══════════════ ÉCHANGES TAB ══════════════ */}
        {activeTab === 'echanges' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 16, paddingBottom: 100 }}>
            {isManager && (
              <>
                {echanges.filter((e: any) => e.statut === 'accepte').length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--info)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ background: 'var(--info)', borderRadius: '50%', width: 6, height: 6, display: 'inline-block' }} />
                      {lang === 'fr' ? 'À approuver' : 'Awaiting approval'} ({echanges.filter((e: any) => e.statut === 'accepte').length})
                    </div>
                    {echanges.filter((e: any) => e.statut === 'accepte').map((e: any) => <EchangeCard key={e.id} e={e} isManager />)}
                  </div>
                )}
                {echanges.filter((e: any) => e.statut === 'en_attente').length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--warning)', marginBottom: 10 }}>
                      ⏳ {lang === 'fr' ? 'En attente collègue' : 'Awaiting colleague'} ({echanges.filter((e: any) => e.statut === 'en_attente').length})
                    </div>
                    {echanges.filter((e: any) => e.statut === 'en_attente').map((e: any) => <EchangeCard key={e.id} e={e} isManager />)}
                  </div>
                )}
                {echanges.length === 0 && historyEchanges.length === 0 && (
                  <div style={{ textAlign: 'center', paddingTop: 40, color: 'var(--text-faint)' }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>🔄</div>
                    <div style={{ fontSize: 13 }}>{lang === 'fr' ? 'Aucun échange en cours' : 'No active swaps'}</div>
                  </div>
                )}
                {historyEchanges.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>
                      {lang === 'fr' ? 'Historique (4 semaines)' : 'History (4 weeks)'}
                    </div>
                    {historyEchanges.map((e: any) => <EchangeCard key={e.id} e={e} isManager />)}
                  </div>
                )}
              </>
            )}
            {!isManager && (
              <>
                {myPendingReceived.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--warning)', marginBottom: 10 }}>⚡ {lang === 'fr' ? 'À répondre' : 'Action required'} ({myPendingReceived.length})</div>
                    {myPendingReceived.map((e: any) => <EchangeCard key={e.id} e={e} />)}
                  </div>
                )}
                {myActiveSent.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--warning)', marginBottom: 10 }}>⏳ {lang === 'fr' ? 'Demandes envoyées' : 'Sent requests'} ({myActiveSent.length})</div>
                    {myActiveSent.map((e: any) => <EchangeCard key={e.id} e={e} />)}
                  </div>
                )}
                {myInProgress.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--info)', marginBottom: 10 }}>✓ {lang === 'fr' ? 'En attente gérant' : 'Awaiting manager'} ({myInProgress.length})</div>
                    {myInProgress.map((e: any) => <EchangeCard key={e.id} e={e} />)}
                  </div>
                )}
                {myHistory.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>{lang === 'fr' ? 'Terminé' : 'Completed'}</div>
                    {myHistory.map((e: any) => <EchangeCard key={e.id} e={e} />)}
                  </div>
                )}
                {echanges.length === 0 && (
                  <div style={{ textAlign: 'center', paddingTop: 40, color: 'var(--text-faint)' }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>🔄</div>
                    <div style={{ fontSize: 13 }}>{lang === 'fr' ? 'Aucun échange en cours' : 'No swaps yet'}</div>
                    <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text-faint)' }}>{lang === 'fr' ? "Proposez un échange depuis l'onglet Horaire" : 'Propose a swap from the Schedule tab'}</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>

      {/* ─── Cell modal ─── */}
      {cellModal && (
        <div onClick={() => setCellModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: 'var(--surface1)', borderRadius: '20px 20px 0 0', padding: '20px 18px 32px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 300, margin: '0 0 2px', color: 'var(--text)' }}>{employeeMap[cellModal.empId]?.nom?.split(' ')[0]}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{JOUR_LONG[cellModal.jourKey][lang]} · {cellModal.date}</div>
              </div>
              {cellModal.shiftId && (
                <button onClick={() => deleteShift(cellModal.shiftId!)} disabled={saving} style={{ background: 'var(--danger-subtle)', border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)', borderRadius: 8, padding: '6px 12px', color: 'var(--danger)', cursor: 'pointer', fontSize: 11, fontFamily: font }}>
                  {lang === 'fr' ? 'Supprimer' : 'Delete'}
                </button>
              )}
            </div>
            {(() => {
              const { source, available } = getEmpDispoInfo(cellModal.empId, cellModal.jourKey)
              const note = lang === 'fr' ? ' (indicatif)' : ' (informational)'
              if (source === 'unknown') return <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 10, fontStyle: 'italic' }}>· {lang === 'fr' ? 'Dispos non soumises cette semaine' : 'No availability form this week'}{note}</div>
              if (source === 'base' && available) return <div style={{ fontSize: 10, color: 'var(--warning)', marginBottom: 10 }}>~ {lang === 'fr' ? 'Dispo habituelle — pas de fiche hebdo' : 'Usual availability — no weekly form'}{note}</div>
              if (!available) return <div style={{ fontSize: 10, color: 'var(--danger)', marginBottom: 10 }}>· {lang === 'fr' ? 'Non disponible selon ses dispos' : 'Marked unavailable'}{note}</div>
              return null
            })()}
            {shiftTypes.length === 0 && (
              <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                {lang === 'fr' ? 'Aucun type de shift configuré. Allez dans Réglages → Types de shifts.' : 'No shift types configured. Go to Settings → Shift types.'}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {shiftsCompatibles.map((st: any) => (
                <button key={st.id} onClick={() => setCellStId(st.id)} style={{ padding: '0 12px 0 0', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: font, background: cellStId === st.id ? `${st.couleur}22` : 'var(--surface2)', border: `1px solid ${cellStId === st.id ? st.couleur : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 0, overflow: 'hidden' }}>
                  <div style={{ width: 4, alignSelf: 'stretch', background: st.couleur, flexShrink: 0, marginRight: 12 }} />
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: cellStId === st.id ? 600 : 400, flex: 1, padding: '10px 0' }}>{st.nom}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{st.debut}–{st.fin}</span>
                </button>
              ))}
              {shiftTypes.length > 0 && shiftsCompatibles.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '8px 0' }}>
                  {lang === 'fr' ? 'Aucun shift compatible avec ce rôle' : 'No compatible shift for this role'}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setCellModal(null)} style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontFamily: font }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
              <button onClick={cellModal.shiftId ? updateShift : addShift} disabled={saving || !cellStId} style={{ flex: 2, padding: '12px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: 'var(--accent-text)', cursor: !cellStId || saving ? 'default' : 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600, opacity: !cellStId ? 0.4 : 1 }}>
                {saving ? '...' : lang === 'fr' ? 'Confirmer' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Publish modal ─── */}
      {publishModal && (() => {
        const alerts = computeAlerts()
        return (
          <div onClick={() => setPublishModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: 'var(--surface1)', borderRadius: '20px 20px 0 0', padding: '20px 18px 32px', maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 300, margin: '0 0 4px', color: 'var(--text)' }}>📢 {lang === 'fr' ? "Publier l'horaire" : 'Publish schedule'}</h3>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>{weekLabel}</div>
              {alerts.length > 0 ? (
                <div style={{ background: 'var(--warning-subtle)', border: '1px solid color-mix(in srgb, var(--warning) 35%, transparent)', borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--warning)', marginBottom: 8 }}>⚠ {lang === 'fr' ? `${alerts.length} alerte(s)` : `${alerts.length} alert(s)`}</div>
                  {alerts.map((a, i) => <div key={i} style={{ fontSize: 11, color: 'var(--warning)', paddingTop: i > 0 ? 5 : 0, marginTop: i > 0 ? 5 : 0, borderTop: i > 0 ? '1px solid color-mix(in srgb, var(--warning) 20%, transparent)' : 'none' }}>· {a}</div>)}
                </div>
              ) : (
                <div style={{ background: 'var(--success-subtle)', border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: 'var(--success)' }}>✓ {lang === 'fr' ? 'Aucune alerte — horaire complet' : 'No alerts — schedule complete'}</div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 16 }}>{lang === 'fr' ? `${brouillonCount} shift(s) publiés, employés notifiés.` : `${brouillonCount} shift(s) published, employees notified.`}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setPublishModal(false)} style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontFamily: font }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
                <button onClick={publishSchedule} disabled={saving} style={{ flex: 2, padding: '12px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: 'var(--accent-text)', cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600 }}>
                  {saving ? '...' : alerts.length > 0 ? (lang === 'fr' ? 'Publier quand même' : 'Publish anyway') : (lang === 'fr' ? 'Publier' : 'Publish')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── Propose exchange modal ─── */}
      {proposeModal && (
        <div onClick={() => setProposeModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: 'var(--surface1)', borderRadius: '20px 20px 0 0', padding: '20px 18px 32px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 300, margin: '0 0 6px', color: 'var(--text)' }}>🔄 {lang === 'fr' ? 'Proposer un échange' : 'Propose a swap'}</h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>{lang === 'fr' ? 'Mon shift :' : 'My shift:'} {proposeModal.shift.shift_types?.nom} · {fmtShiftDate(proposeModal.shift.date, lang, MOIS)}</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>{lang === 'fr' ? 'Collègue (même rôle)' : 'Colleague (same role)'}</div>
              <select value={proposeColleagueId} onChange={e => { setProposeColleagueId(e.target.value); setProposeColleagueShiftId('') }} style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '10px', fontSize: 13, fontFamily: font, outline: 'none' }}>
                <option value="">{lang === 'fr' ? '— Sélectionner —' : '— Select —'}</option>
                {getCompatibleColleagues().map((e: any) => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </div>
            {proposeColleagueId && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>{lang === 'fr' ? 'Son shift à échanger' : 'Their shift to swap'}</div>
                {colleagueShifts.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{lang === 'fr' ? 'Aucun shift cette semaine' : 'No shifts this week'}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {colleagueShifts.map((s: any) => {
                      const st = s.shift_types
                      const isSelected = proposeColleagueShiftId === s.id
                      return (
                        <button key={s.id} onClick={() => setProposeColleagueShiftId(s.id)} style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: font, background: isSelected ? `${st?.couleur || 'var(--accent)'}22` : 'var(--surface2)', border: `1px solid ${isSelected ? (st?.couleur || 'var(--accent)') : 'var(--border)'}`, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: st?.couleur || 'var(--accent)', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: 'var(--text)' }}>{fmtShiftDate(s.date, lang, MOIS)}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{st?.nom}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>{st?.debut}–{st?.fin}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setProposeModal(null)} style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontFamily: font }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
              <button onClick={proposeExchange} disabled={saving || !proposeColleagueId || !proposeColleagueShiftId} style={{ flex: 2, padding: '12px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: 'var(--accent-text)', cursor: 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600, opacity: (!proposeColleagueId || !proposeColleagueShiftId) ? 0.4 : 1 }}>
                {saving ? '...' : lang === 'fr' ? 'Envoyer la demande' : 'Send request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Respond modal ─── */}
      {respondModal && (
        <div onClick={() => { setRespondModal(null); setRespondAccept(null); setRespondComment('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: 'var(--surface1)', borderRadius: '20px 20px 0 0', padding: '20px 18px 32px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 300, margin: '0 0 4px', color: 'var(--text)' }}>🔄 {lang === 'fr' ? "Demande d'échange" : 'Swap request'}</h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>{lang === 'fr' ? `${respondModal.echange.demandeur?.nom} propose un échange` : `${respondModal.echange.demandeur?.nom} is proposing a swap`}</div>
            {(() => {
              const e = respondModal.echange
              const sdSt = e.shift_demandeur?.shift_types
              const srSt = e.shift_recepteur?.shift_types
              return (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <div style={{ flex: 1, background: `${sdSt?.couleur || 'var(--accent)'}14`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 4, letterSpacing: '0.06em' }}>{lang === 'fr' ? 'LEUR SHIFT' : 'THEIR SHIFT'}</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>{sdSt?.nom || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{fmtShiftDate(e.shift_demandeur?.date, lang, MOIS)}</div>
                    {sdSt && <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{sdSt.debut} – {sdSt.fin}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-faint)', fontSize: 18 }}>⇄</div>
                  <div style={{ flex: 1, background: `${srSt?.couleur || 'var(--accent)'}14`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 4, letterSpacing: '0.06em' }}>{lang === 'fr' ? 'VOTRE SHIFT' : 'YOUR SHIFT'}</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>{srSt?.nom || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{fmtShiftDate(e.shift_recepteur?.date, lang, MOIS)}</div>
                    {srSt && <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{srSt.debut} – {srSt.fin}</div>}
                  </div>
                </div>
              )
            })()}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setRespondAccept(true)} style={{ flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', fontFamily: font, fontSize: 13, background: respondAccept === true ? 'var(--success-subtle)' : 'var(--surface2)', border: `1px solid ${respondAccept === true ? 'color-mix(in srgb, var(--success) 50%, transparent)' : 'var(--border)'}`, color: respondAccept === true ? 'var(--success)' : 'var(--text-secondary)' }}>✓ {lang === 'fr' ? 'Accepter' : 'Accept'}</button>
              <button onClick={() => setRespondAccept(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', fontFamily: font, fontSize: 13, background: respondAccept === false ? 'var(--danger-subtle)' : 'var(--surface2)', border: `1px solid ${respondAccept === false ? 'color-mix(in srgb, var(--danger) 50%, transparent)' : 'var(--border)'}`, color: respondAccept === false ? 'var(--danger)' : 'var(--text-secondary)' }}>✗ {lang === 'fr' ? 'Refuser' : 'Decline'}</button>
            </div>
            {respondAccept === false && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>{lang === 'fr' ? 'Motif (optionnel)' : 'Reason (optional)'}</div>
                <textarea value={respondComment} onChange={e => setRespondComment(e.target.value)} placeholder={lang === 'fr' ? 'Ex: Je ne peux pas ce jour-là…' : 'E.g. I have a conflict that day…'} rows={3} style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '10px', fontSize: 12, fontFamily: font, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setRespondModal(null); setRespondAccept(null); setRespondComment('') }} style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontFamily: font }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
              <button onClick={() => respondAccept !== null && respondExchange(respondAccept)} disabled={saving || respondAccept === null} style={{ flex: 2, padding: '12px', background: respondAccept === false ? 'var(--danger)' : respondAccept === true ? 'var(--success)' : 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff', cursor: respondAccept === null ? 'default' : 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600, opacity: respondAccept === null ? 0.4 : 1 }}>
                {saving ? '...' : respondAccept === false ? (lang === 'fr' ? 'Confirmer le refus' : 'Confirm decline') : respondAccept === true ? (lang === 'fr' ? "Confirmer l'acceptation" : 'Confirm acceptance') : (lang === 'fr' ? 'Choisir' : 'Choose')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Approve modal ─── */}
      {approveModal && (
        <div onClick={() => { setApproveModal(null); setApproveReject(null); setApproveComment('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: 'var(--surface1)', borderRadius: '20px 20px 0 0', padding: '20px 18px 32px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 300, margin: '0 0 4px', color: 'var(--text)' }}>🔄 {lang === 'fr' ? "Approuver l'échange" : 'Approve swap'}</h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>{approveModal.echange.demandeur?.nom} ↔ {approveModal.echange.recepteur?.nom}</div>
            {(() => {
              const e = approveModal.echange
              const sdSt = e.shift_demandeur?.shift_types
              const srSt = e.shift_recepteur?.shift_types
              return (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1, background: `${sdSt?.couleur || 'var(--accent)'}14`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 4 }}>{e.demandeur?.nom?.split(' ')[0]}</div>
                    <div style={{ fontSize: 12, color: 'var(--text)' }}>{sdSt?.nom || '—'}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{fmtShiftDate(e.shift_demandeur?.date, lang, MOIS)}</div>
                    {sdSt && <div style={{ fontSize: 9, color: 'var(--text-faint)' }}>{sdSt.debut}–{sdSt.fin}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-faint)', fontSize: 16 }}>⇄</div>
                  <div style={{ flex: 1, background: `${srSt?.couleur || 'var(--accent)'}14`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 4 }}>{e.recepteur?.nom?.split(' ')[0]}</div>
                    <div style={{ fontSize: 12, color: 'var(--text)' }}>{srSt?.nom || '—'}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{fmtShiftDate(e.shift_recepteur?.date, lang, MOIS)}</div>
                    {srSt && <div style={{ fontSize: 9, color: 'var(--text-faint)' }}>{srSt.debut}–{srSt.fin}</div>}
                  </div>
                </div>
              )
            })()}
            {(() => {
              const check = checkExchangeCoverage(approveModal.echange)
              return (
                <div style={{ background: check === 'ok' ? 'var(--success-subtle)' : 'var(--warning-subtle)', border: `1px solid ${check === 'ok' ? 'color-mix(in srgb, var(--success) 35%, transparent)' : 'color-mix(in srgb, var(--warning) 35%, transparent)'}`, borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: check === 'ok' ? 'var(--success)' : 'var(--warning)' }}>
                  {check === 'ok' ? (lang === 'fr' ? '✓ Couverture des rôles compatible' : '✓ Role coverage compatible') : (lang === 'fr' ? '⚠ Rôles différents — vérifier la couverture' : '⚠ Different roles — verify coverage')}
                </div>
              )
            })()}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setApproveReject(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', fontFamily: font, fontSize: 13, background: approveReject === false ? 'var(--success-subtle)' : 'var(--surface2)', border: `1px solid ${approveReject === false ? 'color-mix(in srgb, var(--success) 50%, transparent)' : 'var(--border)'}`, color: approveReject === false ? 'var(--success)' : 'var(--text-secondary)' }}>✓ {lang === 'fr' ? 'Approuver' : 'Approve'}</button>
              <button onClick={() => setApproveReject(true)} style={{ flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', fontFamily: font, fontSize: 13, background: approveReject === true ? 'var(--danger-subtle)' : 'var(--surface2)', border: `1px solid ${approveReject === true ? 'color-mix(in srgb, var(--danger) 50%, transparent)' : 'var(--border)'}`, color: approveReject === true ? 'var(--danger)' : 'var(--text-secondary)' }}>✗ {lang === 'fr' ? 'Rejeter' : 'Reject'}</button>
            </div>
            {approveReject === true && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>{lang === 'fr' ? 'Motif du rejet (optionnel)' : 'Rejection reason (optional)'}</div>
                <textarea value={approveComment} onChange={e => setApproveComment(e.target.value)} placeholder={lang === 'fr' ? 'Ex: Couverture insuffisante ce soir-là…' : 'E.g. Insufficient coverage that evening…'} rows={3} style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '10px', fontSize: 12, fontFamily: font, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setApproveModal(null); setApproveReject(null); setApproveComment('') }} style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontFamily: font }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
              <button onClick={() => approveReject !== null && approveExchange(!approveReject)} disabled={saving || approveReject === null} style={{ flex: 2, padding: '12px', background: approveReject === true ? 'var(--danger)' : approveReject === false ? 'var(--success)' : 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff', cursor: approveReject === null ? 'default' : 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600, opacity: approveReject === null ? 0.4 : 1 }}>
                {saving ? '...' : approveReject === true ? (lang === 'fr' ? 'Confirmer le rejet' : 'Confirm rejection') : approveReject === false ? (lang === 'fr' ? "Confirmer l'approbation" : 'Confirm approval') : (lang === 'fr' ? 'Choisir' : 'Choose')}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
    </>
  )
}
