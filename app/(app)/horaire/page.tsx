'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getTheme } from '@/lib/themes'
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
  en_attente: { icon: '⏳', color: '#E0A850', fr: 'En attente',  en: 'Pending'  },
  accepte:    { icon: '✓',  color: '#7EB8F7', fr: 'Accepté',    en: 'Accepted' },
  refuse:     { icon: '✗',  color: '#E07070', fr: 'Refusé',     en: 'Declined' },
  approuve:   { icon: '✓✓', color: '#72BA80', fr: 'Approuvé',   en: 'Approved' },
  rejete:     { icon: '✗',  color: '#E07070', fr: 'Rejeté',     en: 'Rejected' },
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
  const router = useRouter()

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

  // ─── Load week data ───────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!profile || !userId) return
    const { monday, saturday } = getWeekRange(weekOffset)
    const restaurantId = ctxRestaurantId
    const mondayISO = isoDate(monday)
    const saturdayISO = isoDate(saturday)

    let q = supabase.from('horaire_shifts').select('*, shift_types(*)')
      .gte('date', mondayISO).lte('date', saturdayISO)
    if (isManager && restaurantId) {
      q = q.eq('restaurant_id', restaurantId)
    } else {
      q = q.eq('user_id', userId)
    }
    const { data: shiftsData } = await q
    setShifts(shiftsData || [])

    if (isManager && restaurantId) {
      const [empsRes, stRes, disposRes, covRes] = await Promise.all([
        supabase.from('profiles').select('id,nom,roles,taux_horaire,dispos_base')
          .contains('restaurant_ids', [restaurantId]).eq('actif', true).order('nom'),
        supabase.from('shift_types').select('*').eq('restaurant_id', restaurantId),
        supabase.from('dispos_hebdo').select('*').eq('restaurant_id', restaurantId).eq('semaine_du', mondayISO),
        supabase.from('couverture_minimale').select('*').eq('restaurant_id', restaurantId),
      ])
      const emps = empsRes.data || []
      setAllEmployees(emps)
      setShiftTypes(stRes.data || [])
      setDisposHebdo(disposRes.data || [])
      setCouverture(covRes.data || [])
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ action, payload }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      console.error(`[manage-shifts] ${action}:`, json.error, json.hint ?? '')
    }
    return res.ok
  }

  async function addShift() {
    if (!cellModal || !cellStId) return
    setSaving(true)
    await callShiftsAPI('upsert', {
      restaurant_id: ctxRestaurantId,
      user_id: cellModal.empId,
      shift_type_id: cellStId,
      date: cellModal.date,
    })
    setCellModal(null)
    await loadData()
    setSaving(false)
  }

  async function updateShift() {
    if (!cellModal?.shiftId || !cellStId) return
    setSaving(true)
    await callShiftsAPI('upsert', {
      shift_id: cellModal.shiftId,
      shift_type_id: cellStId,
    })
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
      week_start: isoDate(monday),
      week_end: isoDate(saturday),
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
      demandeur_id: userId,
      recepteur_id: proposeColleagueId,
      shift_demandeur_id: proposeModal.shift.id,
      shift_recepteur_id: proposeColleagueShiftId,
      statut: 'en_attente',
    })
    await supabase.from('notifications').insert({
      user_id: proposeColleagueId, type: 'echange', lu: false,
      message: lang === 'fr'
        ? `${profile.nom} vous propose un échange de shift.`
        : `${profile.nom} is proposing a shift swap with you.`,
    })
    setProposeModal(null)
    setProposeColleagueId('')
    setProposeColleagueShiftId('')
    await Promise.all([loadData(), loadEchanges()])
    setSaving(false)
  }

  // ─── Exchange: Step 2 — Respond (colleague accepts/refuses) ──────────────
  async function respondExchange(accept: boolean) {
    if (!respondModal || saving) return
    setSaving(true)
    const lang = profile?.lang || 'fr'
    const e = respondModal.echange
    const comment = respondComment.trim()

    if (accept) {
      await supabase.from('echanges').update({ statut: 'accepte' }).eq('id', e.id)
      // Notify managers
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
      await supabase.from('echanges').update({
        statut: 'refuse',
        ...(comment ? { commentaire: comment } : {}),
      }).eq('id', e.id)
      await supabase.from('notifications').insert({
        user_id: e.demandeur_id, type: 'echange', lu: false,
        message: lang === 'fr'
          ? `${e.recepteur?.nom} a refusé votre demande d'échange.${comment ? ` Motif : ${comment}` : ''}`
          : `${e.recepteur?.nom} declined your swap request.${comment ? ` Reason: ${comment}` : ''}`,
      })
    }
    setRespondModal(null)
    setRespondAccept(null)
    setRespondComment('')
    await loadEchanges()
    setSaving(false)
  }

  // ─── Exchange: Step 3 — Approve/Reject (manager) ─────────────────────────
  async function approveExchange(approve: boolean) {
    if (!approveModal || saving) return
    setSaving(true)
    const lang = profile?.lang || 'fr'
    const e = approveModal.echange
    const comment = approveComment.trim()

    if (approve) {
      // Swap the user_ids on the two shifts
      await supabase.from('horaire_shifts').update({ user_id: e.recepteur_id }).eq('id', e.shift_demandeur_id)
      await supabase.from('horaire_shifts').update({ user_id: e.demandeur_id }).eq('id', e.shift_recepteur_id)
      await supabase.from('echanges').update({ statut: 'approuve' }).eq('id', e.id)
      const msg = lang === 'fr' ? 'Votre échange de shift a été approuvé ✓' : 'Your shift swap has been approved ✓'
      await supabase.from('notifications').insert([
        { user_id: e.demandeur_id, type: 'echange', message: msg, lu: false },
        { user_id: e.recepteur_id, type: 'echange', message: msg, lu: false },
      ])
    } else {
      await supabase.from('echanges').update({
        statut: 'rejete',
        ...(comment ? { commentaire: comment } : {}),
      }).eq('id', e.id)
      const msg = lang === 'fr'
        ? `Votre échange a été rejeté par le gérant.${comment ? ` Motif : ${comment}` : ''}`
        : `Your swap was rejected by the manager.${comment ? ` Reason: ${comment}` : ''}`
      await supabase.from('notifications').insert([
        { user_id: e.demandeur_id, type: 'echange', message: msg, lu: false },
        { user_id: e.recepteur_id, type: 'echange', message: msg, lu: false },
      ])
    }
    setApproveModal(null)
    setApproveReject(null)
    setApproveComment('')
    await Promise.all([loadData(), loadEchanges()])
    setSaving(false)
  }

  // ─── Exchange: Cancel (demandeur cancels while en_attente) ───────────────
  async function cancelExchange(echangeId: string) {
    if (saving) return
    setSaving(true)
    const lang = profile?.lang || 'fr'
    const e = echanges.find((x: any) => x.id === echangeId)
    if (!e) { setSaving(false); return }
    await supabase.from('echanges').update({ statut: 'refuse' }).eq('id', echangeId)
    await supabase.from('notifications').insert({
      user_id: e.recepteur_id, type: 'echange', lu: false,
      message: lang === 'fr'
        ? `${profile.nom} a annulé sa demande d'échange.`
        : `${profile.nom} cancelled their swap request.`,
    })
    await loadEchanges()
    setSaving(false)
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C9A84C', fontSize: 12, letterSpacing: '0.2em' }}>CHARGEMENT...</div>
    </div>
  )

  const t = getTheme(profile?.theme)
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
  const myHistory          = echanges.filter((e: any) =>
    (e.demandeur_id === userId || e.recepteur_id === userId) &&
    ['approuve','refuse','rejete'].includes(e.statut)
  )

  function getEmpDispoInfo(empId: string, jourKey: Jour): { source: 'hebdo' | 'base' | 'unknown'; available: boolean } {
    const hebdo = disposHebdo.find((x: any) => x.user_id === empId)
    if (hebdo) {
      const svcs = hebdo.dispos?.[jourKey]
      const available = Array.isArray(svcs) && svcs.length > 0
      return { source: 'hebdo', available }
    }
    const emp = employeeMap[empId]
    const base = emp?.dispos_base
    if (base?.jours) {
      return { source: 'base', available: base.jours.includes(jourKey) }
    }
    return { source: 'unknown', available: false }
  }

  function cellBg(empId: string, jourKey: Jour): string | undefined {
    const { source, available } = getEmpDispoInfo(empId, jourKey)
    if (source === 'unknown') return undefined
    if (source === 'hebdo') return available ? 'rgba(114,186,128,0.10)' : 'rgba(224,112,112,0.10)'
    // base fallback
    return available ? 'rgba(224,168,80,0.10)' : 'rgba(224,112,112,0.06)'
  }

  function getCoverage(dayIdx: number) {
    const dateStr = isoDate(days[dayIdx])
    const jourKey = JOURS[dayIdx]
    const dayShifts = shiftsByDate[dateStr] || []
    const midiShifts = dayShifts.filter((s: any) => inferService(s.shift_types?.debut) === 'midi')
    const soirShifts = dayShifts.filter((s: any) => inferService(s.shift_types?.debut) === 'soir')
    const covMidi = couverture.find((c: any) => c.jour === jourKey && c.service === 'midi')
    const covSoir = couverture.find((c: any) => c.jour === jourKey && c.service === 'soir')
    const needMidi = covMidi?.nb_personnes || 0
    const needSoir = covSoir?.nb_personnes || 0
    const barRequired = covSoir?.bar_requis || false
    const hasBar = soirShifts.some((s: any) => employeeMap[s.user_id]?.roles?.includes('bar'))
    return {
      midi: { ok: needMidi === 0 || midiShifts.length >= needMidi, have: midiShifts.length, need: needMidi },
      soir: { ok: (needSoir === 0 || soirShifts.length >= needSoir) && (!barRequired || hasBar), have: soirShifts.length, need: needSoir, barOk: !barRequired || hasBar },
    }
  }

  function computeAlerts(): string[] {
    const alerts: string[] = []
    const empShiftCount: Record<string, number> = {}
    for (let i = 0; i < 6; i++) {
      const cov = getCoverage(i)
      const js = JOUR_SHORT[JOURS[i]][lang]
      if (!cov.midi.ok && cov.midi.need > 0)
        alerts.push(lang === 'fr' ? `${js} Midi : ${cov.midi.have}/${cov.midi.need}` : `${js} Lunch: ${cov.midi.have}/${cov.midi.need}`)
      if (cov.soir.need > 0 && cov.soir.have < cov.soir.need)
        alerts.push(lang === 'fr' ? `${js} Soir : ${cov.soir.have}/${cov.soir.need}` : `${js} Evening: ${cov.soir.have}/${cov.soir.need}`)
      if (!cov.soir.barOk)
        alerts.push(lang === 'fr' ? `${js} Soir : aucun barman` : `${js} Evening: no bartender`)
    }
    shifts.forEach((s: any) => { empShiftCount[s.user_id] = (empShiftCount[s.user_id] || 0) + 1 })
    const withoutShift = employees.filter((e: any) => !empShiftCount[e.id])
    if (withoutShift.length > 0) {
      alerts.push(lang === 'fr' ? `Sans shift : ${withoutShift.map((e: any) => e.nom.split(' ')[0]).join(', ')}` : `No shifts: ${withoutShift.map((e: any) => e.nom.split(' ')[0]).join(', ')}`)
    }
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
    return allEmployees.filter((e: any) =>
      e.id !== userId && (e.roles || []).some((r: string) => myRoles.includes(r))
    )
  }

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
      <div style={{
        background: t.surface1, border: `1px solid ${e.statut === 'accepte' ? `${cfg.color}44` : t.border}`,
        borderRadius: 12, padding: '12px 14px', marginBottom: 8,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.texte }}>
            <span>{e.demandeur?.nom?.split(' ')[0]}</span>
            <span style={{ color: t.texteFaible }}>↔</span>
            <span>{e.recepteur?.nom?.split(' ')[0]}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11 }}>{cfg.icon}</span>
            <span style={{ fontSize: 10, color: cfg.color, letterSpacing: '0.06em' }}>
              {cfg[lang]}
            </span>
          </div>
        </div>

        {/* Shifts */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, background: `${sdSt?.couleur || t.accent}14`, borderRadius: 8, padding: '6px 8px' }}>
            <div style={{ fontSize: 9, color: t.texteFaible, marginBottom: 2 }}>{e.demandeur?.nom?.split(' ')[0]}</div>
            <div style={{ fontSize: 11, color: t.texte }}>{sdSt?.nom || '—'}</div>
            <div style={{ fontSize: 10, color: t.texteSecondaire }}>{fmtShiftDate(e.shift_demandeur?.date, lang, MOIS)}</div>
            {sdSt && <div style={{ fontSize: 9, color: t.texteFaible }}>{sdSt.debut}–{sdSt.fin}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: t.texteFaible, fontSize: 12 }}>⇄</div>
          <div style={{ flex: 1, background: `${srSt?.couleur || t.accent}14`, borderRadius: 8, padding: '6px 8px' }}>
            <div style={{ fontSize: 9, color: t.texteFaible, marginBottom: 2 }}>{e.recepteur?.nom?.split(' ')[0]}</div>
            <div style={{ fontSize: 11, color: t.texte }}>{srSt?.nom || '—'}</div>
            <div style={{ fontSize: 10, color: t.texteSecondaire }}>{fmtShiftDate(e.shift_recepteur?.date, lang, MOIS)}</div>
            {srSt && <div style={{ fontSize: 9, color: t.texteFaible }}>{srSt.debut}–{srSt.fin}</div>}
          </div>
        </div>

        {/* Comment */}
        {e.commentaire && (
          <div style={{ fontSize: 10, color: t.texteFaible, fontStyle: 'italic', marginBottom: 8 }}>
            "{e.commentaire}"
          </div>
        )}

        {/* Actions */}
        {canRespond && (
          <button onClick={() => { setRespondModal({ echange: e }); setRespondAccept(null); setRespondComment('') }} style={{
            width: '100%', padding: '8px', background: `${cfg.color}18`, border: `1px solid ${cfg.color}44`,
            borderRadius: 8, color: cfg.color, cursor: 'pointer', fontSize: 12, fontFamily: font,
          }}>
            {lang === 'fr' ? '↩ Répondre à cette demande' : '↩ Respond to this request'}
          </button>
        )}
        {canCancel && (
          <button onClick={() => cancelExchange(e.id)} disabled={saving} style={{
            width: '100%', padding: '6px', background: 'transparent', border: `1px solid ${t.border}`,
            borderRadius: 8, color: t.texteFaible, cursor: 'pointer', fontSize: 11, fontFamily: font,
          }}>
            {lang === 'fr' ? 'Annuler ma demande' : 'Cancel my request'}
          </button>
        )}
        {canApprove && (
          <button onClick={() => { setApproveModal({ echange: e }); setApproveReject(null); setApproveComment('') }} style={{
            width: '100%', padding: '8px', background: `${cfg.color}18`, border: `1px solid ${cfg.color}55`,
            borderRadius: 8, color: cfg.color, cursor: 'pointer', fontSize: 12, fontFamily: font, fontWeight: 600,
          }}>
            {lang === 'fr' ? '↩ Statuer sur cet échange' : '↩ Review this swap'}
          </button>
        )}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <AppShell profile={profile} restaurant="Le Carré">
      <main className="page-content" style={{ paddingBottom: 96 }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, padding: '0 16px' }}>
          {(['horaire', 'echanges'] as const).map(tab => {
            const isActive = activeTab === tab
            const badge = tab === 'echanges'
              ? (isManager ? pendingApprovalCount : myPendingReceived.length)
              : 0
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1, padding: '14px 4px', background: 'none', border: 'none',
                borderBottom: `2px solid ${isActive ? t.accent : 'transparent'}`,
                color: isActive ? t.accent : t.texteSecondaire,
                cursor: 'pointer', fontSize: 11, fontFamily: font,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'color 0.15s',
              }}>
                {tab === 'horaire' ? (lang === 'fr' ? 'Horaire' : 'Schedule') : (lang === 'fr' ? 'Échanges' : 'Swaps')}
                {badge > 0 && (
                  <span style={{
                    background: '#E07070', color: '#fff', borderRadius: '50%',
                    minWidth: 16, height: 16, fontSize: 9, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div style={{ padding: '16px' }}>

          {/* ══════════════ HORAIRE TAB ══════════════ */}
          {activeTab === 'horaire' && (
            <>
              {/* Week navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.texte, borderRadius: 8, padding: '8px 13px', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>‹</button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 1 }}>
                    {weekOffset === 0 ? (lang === 'fr' ? 'Cette semaine' : 'This week')
                      : weekOffset === 1 ? (lang === 'fr' ? 'Semaine prochaine' : 'Next week')
                      : weekOffset < 0 ? (lang === 'fr' ? `Il y a ${-weekOffset} sem.` : `${-weekOffset} wk ago`)
                      : (lang === 'fr' ? `Dans ${weekOffset} semaines` : `In ${weekOffset} weeks`)}
                  </div>
                  <div style={{ fontSize: 12, color: t.texte }}>{weekLabel}</div>
                </div>
                <button onClick={() => { if (!isManager || weekOffset < 4) setWeekOffset(w => w + 1) }}
                  style={{ background: t.surface2, border: `1px solid ${t.border}`, color: isManager && weekOffset >= 4 ? t.texteFaible : t.texte, borderRadius: 8, padding: '8px 13px', cursor: isManager && weekOffset >= 4 ? 'default' : 'pointer', fontSize: 16, flexShrink: 0 }}>
                  ›
                </button>
              </div>
              {weekOffset !== 0 && (
                <div style={{ textAlign: 'center', marginBottom: 10 }}>
                  <button onClick={() => setWeekOffset(0)} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 20, color: t.texteSecondaire, fontSize: 10, padding: '3px 12px', cursor: 'pointer', fontFamily: font, letterSpacing: '0.06em' }}>
                    {lang === 'fr' ? '↩ Cette semaine' : '↩ This week'}
                  </button>
                </div>
              )}

              {/* ── MANAGER: top actions ── */}
              {isManager && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <button onClick={() => router.push('/dispos')} style={{ padding: '9px 12px', background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 10, color: t.texteSecondaire, cursor: 'pointer', fontSize: 11, fontFamily: font, flexShrink: 0 }}>
                    📋 {lang === 'fr' ? 'Dispos' : 'Avail.'}
                  </button>
                  <button onClick={() => setPublishModal(true)} disabled={brouillonCount === 0} style={{ flex: 1, padding: '9px', borderRadius: 10, fontSize: 11, fontFamily: font, background: brouillonCount > 0 ? t.accent : t.surface1, border: `1px solid ${brouillonCount > 0 ? t.accent : t.border}`, color: brouillonCount > 0 ? (t.isDark ? '#080808' : '#fff') : t.texteFaible, cursor: brouillonCount === 0 ? 'default' : 'pointer', fontWeight: brouillonCount > 0 ? 600 : 400 }}>
                    📢 {lang === 'fr' ? `Publier (${brouillonCount})` : `Publish (${brouillonCount})`}
                  </button>
                </div>
              )}

              {/* ── MANAGER: employee grid ── */}
              {isManager && (
                <>
                  <div style={{ border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
                    {/* Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '76px repeat(6, 1fr)', borderBottom: `1px solid ${t.border}`, background: t.surface2 }}>
                      <div style={{ padding: '6px 8px', position: 'sticky', left: 0, background: t.surface2, zIndex: 2 }} />
                      {days.map((day, di) => {
                        const dateStr = isoDate(day)
                        const isToday = dateStr === today
                        const cov = getCoverage(di)
                        const covOk = cov.midi.ok && cov.soir.ok
                        return (
                          <div key={dateStr} style={{ padding: '5px 2px', textAlign: 'center', borderLeft: `1px solid ${t.border}` }}>
                            <div style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: isToday ? t.accent : t.texteSecondaire }}>{JOUR_SHORT[JOURS[di]][lang]}</div>
                            <div style={{ fontSize: 9, color: t.texteFaible }}>{day.getDate()}</div>
                            {couverture.length > 0 && <div style={{ fontSize: 8, color: covOk ? '#72BA80' : '#E07070', marginTop: 1 }}>{covOk ? '✓' : '✗'}</div>}
                          </div>
                        )
                      })}
                    </div>
                    {employees.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: t.texteFaible, fontSize: 12 }}>{lang === 'fr' ? 'Aucun employé' : 'No employees'}</div>}
                    {employees.map((emp: any, ei: number) => {
                      const rowBg = ei % 2 === 1 ? `${t.surface2}88` : t.surface1
                      return (
                      <div key={emp.id} style={{ display: 'grid', gridTemplateColumns: '76px repeat(6, 1fr)', borderBottom: ei < employees.length - 1 ? `1px solid ${t.border}` : 'none', background: rowBg }}>
                        <div style={{ padding: '0 8px', fontSize: 11, color: t.texte, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', minHeight: 48, position: 'sticky', left: 0, background: rowBg, zIndex: 1 }}>
                          {emp.nom.split(' ')[0]}
                        </div>
                        {days.map((day, di) => {
                          const dateStr = isoDate(day)
                          const jourKey = JOURS[di]
                          const shift = shiftByEmpDate[`${emp.id}|${dateStr}`]
                          const bg = cellBg(emp.id, jourKey)
                          const isToday = dateStr === today
                          const st = shift?.shift_types
                          return (
                            <button key={dateStr}
                              onClick={() => { setCellModal({ empId: emp.id, date: dateStr, jourKey, shiftId: shift?.id, shiftTypeId: shift?.shift_type_id }); setCellStId(shift?.shift_type_id || '') }}
                              style={{ borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderLeft: `1px solid ${t.border}`, background: bg || (isToday ? `${t.accent}08` : 'transparent'), cursor: 'pointer', padding: '5px 3px', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {shift ? (
                                <div style={{ width: '100%', borderRadius: 4, padding: '3px 3px 3px 5px', background: `${st?.couleur || t.accent}22`, borderLeft: `2px solid ${st?.couleur || t.accent}`, position: 'relative', display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  <div style={{ fontSize: 8, color: t.texte, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{(st?.nom || '?').split(' ')[0]}</div>
                                  {st?.debut && <div style={{ fontSize: 7, color: t.texteFaible }}>{st.debut.slice(0,5)}–{(st.fin || '').slice(0,5)}</div>}
                                  {shift.statut === 'brouillon' && <div style={{ position: 'absolute', top: 2, right: 2, width: 4, height: 4, borderRadius: '50%', background: '#E0A850' }} />}
                                </div>
                              ) : (
                                <span style={{ fontSize: 14, color: t.texteFaible, opacity: 0.35 }}>+</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )
                    })}
                  </div>

                  {/* Coverage bar */}
                  {couverture.length > 0 && (
                    <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 10, padding: '8px 10px', marginBottom: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '76px repeat(6, 1fr)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
                          <span style={{ fontSize: 8, color: '#F4A261', letterSpacing: '0.06em' }}>MIDI</span>
                          <span style={{ fontSize: 8, color: '#7EB8F7', letterSpacing: '0.06em' }}>SOIR</span>
                        </div>
                        {days.map((_, di) => {
                          const cov = getCoverage(di)
                          return (
                            <div key={di} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <div style={{ fontSize: 9, color: cov.midi.ok ? '#72BA80' : '#E07070', fontFamily: "'Courier New', monospace" }}>{cov.midi.need > 0 ? `${cov.midi.have}/${cov.midi.need}` : '–'}</div>
                              <div style={{ fontSize: 9, color: cov.soir.ok ? '#72BA80' : '#E07070', fontFamily: "'Courier New', monospace" }}>
                                {cov.soir.need > 0 ? `${cov.soir.have}/${cov.soir.need}` : '–'}
                                {!cov.soir.barOk && <span style={{ fontSize: 8 }}> 🍸</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── EMPLOYEE: personal week ── */}
              {!isManager && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {days.map((day, di) => {
                      const dateStr = isoDate(day)
                      const dayShifts = (shiftsByDate[dateStr] || []).filter((s: any) => s.user_id === userId)
                      const isToday = dateStr === today
                      const isPast = day < new Date() && !isToday

                      if (dayShifts.length === 0) {
                        return (
                          <div key={dateStr} style={{ background: t.surface1, border: `1px solid ${isToday ? t.borderAccent : t.border}`, borderRadius: 12, padding: '10px 14px', opacity: isPast ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, color: isToday ? t.accent : t.texteSecondaire }}>
                              {JOUR_LONG[JOURS[di]][lang]} {day.getDate()} {MOIS[day.getMonth()]}
                            </span>
                            <span style={{ fontSize: 11, color: t.texteFaible, fontStyle: 'italic' }}>{lang === 'fr' ? 'Congé' : 'Day off'}</span>
                          </div>
                        )
                      }

                      return dayShifts.map((s: any) => {
                        const st = s.shift_types
                        const couleur = st?.couleur || t.accent
                        return (
                          <div key={s.id} style={{ background: isToday ? `linear-gradient(135deg, ${t.surface2}, ${t.surface1})` : t.surface1, border: `1px solid ${isToday ? t.borderAccent : t.border}`, borderRadius: 12, padding: '12px 14px', opacity: isPast ? 0.65 : 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 3, height: 36, borderRadius: 2, background: couleur, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 11, color: isToday ? t.accent : t.texteSecondaire, marginBottom: 3 }}>
                                  {JOUR_LONG[JOURS[di]][lang]} {day.getDate()} {MOIS[day.getMonth()]}
                                </div>
                                <div style={{ fontSize: 14, color: t.texte }}>{st?.nom || '—'}</div>
                                {st && <div style={{ fontSize: 11, color: t.texteSecondaire }}>{st.debut} – {st.fin}</div>}
                              </div>
                              <button onClick={() => { setProposeModal({ shift: s }); setProposeColleagueId(''); setProposeColleagueShiftId('') }} style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: '5px 9px', color: t.texteSecondaire, cursor: 'pointer', fontSize: 10, fontFamily: font, flexShrink: 0 }}>
                                🔄 {lang === 'fr' ? 'Échange' : 'Swap'}
                              </button>
                            </div>
                          </div>
                        )
                      })
                    })}
                  </div>

                  {/* Pay estimate */}
                  <div style={{ marginTop: 20, background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 10 }}>{lang === 'fr' ? 'Estimation paie' : 'Pay estimate'}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div>
                        <span style={{ fontSize: 22, color: t.accent }}>{payEstimate.toFixed(2)}</span>
                        <span style={{ fontSize: 12, color: t.texteSecondaire, marginLeft: 4 }}>$</span>
                      </div>
                      <div style={{ fontSize: 11, color: t.texteFaible }}>{totalHeures.toFixed(1)}h × {profile?.taux_horaire || 0}$/h</div>
                    </div>
                    <div style={{ fontSize: 9, color: t.texteFaible, marginTop: 8, fontStyle: 'italic' }}>* {lang === 'fr' ? 'Estimation — exclut les pourboires' : 'Estimate — excludes tips'}</div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ══════════════ ÉCHANGES TAB ══════════════ */}
          {activeTab === 'echanges' && (
            <>
              {/* ── Manager exchange dashboard ── */}
              {isManager && (
                <>
                  {/* À approuver */}
                  {echanges.filter((e: any) => e.statut === 'accepte').length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7EB8F7', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ background: '#7EB8F7', borderRadius: '50%', width: 6, height: 6, display: 'inline-block' }} />
                        {lang === 'fr' ? 'À approuver' : 'Awaiting approval'} ({echanges.filter((e: any) => e.statut === 'accepte').length})
                      </div>
                      {echanges.filter((e: any) => e.statut === 'accepte').map((e: any) => (
                        <EchangeCard key={e.id} e={e} isManager />
                      ))}
                    </div>
                  )}

                  {/* En attente collègue */}
                  {echanges.filter((e: any) => e.statut === 'en_attente').length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E0A850', marginBottom: 10 }}>
                        ⏳ {lang === 'fr' ? 'En attente collègue' : 'Awaiting colleague'} ({echanges.filter((e: any) => e.statut === 'en_attente').length})
                      </div>
                      {echanges.filter((e: any) => e.statut === 'en_attente').map((e: any) => (
                        <EchangeCard key={e.id} e={e} isManager />
                      ))}
                    </div>
                  )}

                  {echanges.length === 0 && historyEchanges.length === 0 && (
                    <div style={{ textAlign: 'center', paddingTop: 40, color: t.texteFaible }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>🔄</div>
                      <div style={{ fontSize: 13 }}>{lang === 'fr' ? 'Aucun échange en cours' : 'No active swaps'}</div>
                    </div>
                  )}

                  {/* Historique 4 semaines */}
                  {historyEchanges.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 10 }}>
                        {lang === 'fr' ? 'Historique (4 semaines)' : 'History (4 weeks)'}
                      </div>
                      {historyEchanges.map((e: any) => <EchangeCard key={e.id} e={e} isManager />)}
                    </div>
                  )}
                </>
              )}

              {/* ── Employee exchange view ── */}
              {!isManager && (
                <>
                  {/* Action requise */}
                  {myPendingReceived.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E0A850', marginBottom: 10 }}>
                        ⚡ {lang === 'fr' ? 'À répondre' : 'Action required'} ({myPendingReceived.length})
                      </div>
                      {myPendingReceived.map((e: any) => <EchangeCard key={e.id} e={e} />)}
                    </div>
                  )}

                  {/* Envoyés en attente */}
                  {myActiveSent.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E0A850', marginBottom: 10 }}>
                        ⏳ {lang === 'fr' ? 'Demandes envoyées' : 'Sent requests'} ({myActiveSent.length})
                      </div>
                      {myActiveSent.map((e: any) => <EchangeCard key={e.id} e={e} />)}
                    </div>
                  )}

                  {/* En cours (accepté, attente gérant) */}
                  {myInProgress.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7EB8F7', marginBottom: 10 }}>
                        ✓ {lang === 'fr' ? 'En attente gérant' : 'Awaiting manager'} ({myInProgress.length})
                      </div>
                      {myInProgress.map((e: any) => <EchangeCard key={e.id} e={e} />)}
                    </div>
                  )}

                  {/* Historique */}
                  {myHistory.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 10 }}>
                        {lang === 'fr' ? 'Terminé' : 'Completed'}
                      </div>
                      {myHistory.map((e: any) => <EchangeCard key={e.id} e={e} />)}
                    </div>
                  )}

                  {echanges.length === 0 && (
                    <div style={{ textAlign: 'center', paddingTop: 40, color: t.texteFaible }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>🔄</div>
                      <div style={{ fontSize: 13 }}>{lang === 'fr' ? 'Aucun échange en cours' : 'No swaps yet'}</div>
                      <div style={{ fontSize: 11, marginTop: 6, color: t.texteFaible }}>
                        {lang === 'fr' ? 'Proposez un échange depuis l\'onglet Horaire' : 'Propose a swap from the Schedule tab'}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* ─── Cell modal (manager add/edit shift) ─── */}
      {cellModal && (
        <div onClick={() => setCellModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: t.surface1, borderRadius: '20px 20px 0 0', padding: '20px 18px 32px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: t.border, margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 300, margin: '0 0 2px', color: t.texte }}>{employeeMap[cellModal.empId]?.nom?.split(' ')[0]}</h3>
                <div style={{ fontSize: 12, color: t.texteSecondaire }}>{JOUR_LONG[cellModal.jourKey][lang]} · {cellModal.date}</div>
              </div>
              {cellModal.shiftId && (
                <button onClick={() => deleteShift(cellModal.shiftId!)} disabled={saving} style={{ background: 'rgba(224,112,112,0.15)', border: '1px solid rgba(224,112,112,0.3)', borderRadius: 8, padding: '6px 12px', color: '#E07070', cursor: 'pointer', fontSize: 11, fontFamily: font }}>
                  {lang === 'fr' ? 'Supprimer' : 'Delete'}
                </button>
              )}
            </div>
            {(() => {
              const { source, available } = getEmpDispoInfo(cellModal.empId, cellModal.jourKey)
              if (source === 'unknown') return <div style={{ fontSize: 10, color: t.texteFaible, marginBottom: 10, fontStyle: 'italic' }}>⚠ {lang === 'fr' ? 'Dispos non soumises' : 'Availability not submitted'}</div>
              if (source === 'base' && available) return <div style={{ fontSize: 10, color: '#E0A850', marginBottom: 10 }}>~ {lang === 'fr' ? 'Dispo habituelle (pas de fiche cette semaine)' : 'Usual availability (no form this week)'}</div>
              if (!available) return <div style={{ fontSize: 10, color: '#E07070', marginBottom: 10 }}>⚠ {lang === 'fr' ? 'Employé indisponible ce jour' : 'Employee unavailable this day'}</div>
              return null
            })()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {shiftTypes.map((st: any) => (
                <button key={st.id} onClick={() => setCellStId(st.id)} style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: font, background: cellStId === st.id ? `${st.couleur}22` : t.surface2, border: `1px solid ${cellStId === st.id ? st.couleur : t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: st.couleur, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: t.texte }}>{st.nom}</span>
                  <span style={{ fontSize: 11, color: t.texteSecondaire, marginLeft: 'auto' }}>{st.debut}–{st.fin}</span>
                </button>
              ))}
              {shiftTypes.length === 0 && <div style={{ fontSize: 12, color: t.texteFaible, padding: '8px 0' }}>{lang === 'fr' ? 'Aucun type de shift configuré' : 'No shift types configured'}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setCellModal(null)} style={{ flex: 1, padding: '12px', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, color: t.texteSecondaire, cursor: 'pointer', fontSize: 13, fontFamily: font }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
              <button onClick={cellModal.shiftId ? updateShift : addShift} disabled={saving || !cellStId} style={{ flex: 2, padding: '12px', background: t.accent, border: 'none', borderRadius: 10, color: t.isDark ? '#080808' : '#fff', cursor: !cellStId || saving ? 'default' : 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600, opacity: !cellStId ? 0.4 : 1 }}>
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
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: t.surface1, borderRadius: '20px 20px 0 0', padding: '20px 18px 32px', maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: t.border, margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 300, margin: '0 0 4px', color: t.texte }}>📢 {lang === 'fr' ? "Publier l'horaire" : 'Publish schedule'}</h3>
              <div style={{ fontSize: 12, color: t.texteSecondaire, marginBottom: 16 }}>{weekLabel}</div>
              {alerts.length > 0 ? (
                <div style={{ background: 'rgba(224,160,80,0.08)', border: '1px solid rgba(224,160,80,0.25)', borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: '#E0A850', marginBottom: 8 }}>⚠ {lang === 'fr' ? `${alerts.length} alerte(s)` : `${alerts.length} alert(s)`}</div>
                  {alerts.map((a, i) => <div key={i} style={{ fontSize: 11, color: '#E0A850', paddingTop: i > 0 ? 5 : 0, marginTop: i > 0 ? 5 : 0, borderTop: i > 0 ? '1px solid rgba(224,160,80,0.15)' : 'none' }}>· {a}</div>)}
                </div>
              ) : (
                <div style={{ background: 'rgba(114,186,128,0.1)', border: '1px solid rgba(114,186,128,0.3)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: '#72BA80' }}>✓ {lang === 'fr' ? 'Aucune alerte — horaire complet' : 'No alerts — schedule complete'}</div>
              )}
              <div style={{ fontSize: 11, color: t.texteFaible, marginBottom: 16 }}>{lang === 'fr' ? `${brouillonCount} shift(s) publiés, employés notifiés.` : `${brouillonCount} shift(s) published, employees notified.`}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setPublishModal(false)} style={{ flex: 1, padding: '12px', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, color: t.texteSecondaire, cursor: 'pointer', fontSize: 13, fontFamily: font }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
                <button onClick={publishSchedule} disabled={saving} style={{ flex: 2, padding: '12px', background: t.accent, border: 'none', borderRadius: 10, color: t.isDark ? '#080808' : '#fff', cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600 }}>
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
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: t.surface1, borderRadius: '20px 20px 0 0', padding: '20px 18px 32px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: t.border, margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 300, margin: '0 0 6px', color: t.texte }}>🔄 {lang === 'fr' ? 'Proposer un échange' : 'Propose a swap'}</h3>
            <div style={{ fontSize: 12, color: t.texteSecondaire, marginBottom: 16 }}>
              {lang === 'fr' ? 'Mon shift :' : 'My shift:'} {proposeModal.shift.shift_types?.nom} · {fmtShiftDate(proposeModal.shift.date, lang, MOIS)}
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6 }}>{lang === 'fr' ? 'Collègue (même rôle)' : 'Colleague (same role)'}</div>
              <select value={proposeColleagueId} onChange={e => { setProposeColleagueId(e.target.value); setProposeColleagueShiftId('') }}
                style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texte, padding: '10px', fontSize: 13, fontFamily: font, outline: 'none' }}>
                <option value="">{lang === 'fr' ? '— Sélectionner —' : '— Select —'}</option>
                {getCompatibleColleagues().map((e: any) => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </div>
            {proposeColleagueId && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6 }}>{lang === 'fr' ? 'Son shift à échanger' : 'Their shift to swap'}</div>
                {colleagueShifts.length === 0 ? (
                  <div style={{ fontSize: 12, color: t.texteFaible }}>{lang === 'fr' ? 'Aucun shift cette semaine' : 'No shifts this week'}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {colleagueShifts.map((s: any) => {
                      const st = s.shift_types
                      const isSelected = proposeColleagueShiftId === s.id
                      return (
                        <button key={s.id} onClick={() => setProposeColleagueShiftId(s.id)} style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: font, background: isSelected ? `${st?.couleur || t.accent}22` : t.surface2, border: `1px solid ${isSelected ? (st?.couleur || t.accent) : t.border}`, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: st?.couleur || t.accent, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: t.texte }}>{fmtShiftDate(s.date, lang, MOIS)}</span>
                          <span style={{ fontSize: 12, color: t.texteSecondaire }}>{st?.nom}</span>
                          <span style={{ fontSize: 11, color: t.texteFaible, marginLeft: 'auto' }}>{st?.debut}–{st?.fin}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setProposeModal(null)} style={{ flex: 1, padding: '12px', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, color: t.texteSecondaire, cursor: 'pointer', fontSize: 13, fontFamily: font }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
              <button onClick={proposeExchange} disabled={saving || !proposeColleagueId || !proposeColleagueShiftId} style={{ flex: 2, padding: '12px', background: t.accent, border: 'none', borderRadius: 10, color: t.isDark ? '#080808' : '#fff', cursor: 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600, opacity: (!proposeColleagueId || !proposeColleagueShiftId) ? 0.4 : 1 }}>
                {saving ? '...' : lang === 'fr' ? 'Envoyer la demande' : 'Send request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Respond modal (employee/colleague) ─── */}
      {respondModal && (
        <div onClick={() => { setRespondModal(null); setRespondAccept(null); setRespondComment('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: t.surface1, borderRadius: '20px 20px 0 0', padding: '20px 18px 32px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: t.border, margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 300, margin: '0 0 4px', color: t.texte }}>🔄 {lang === 'fr' ? 'Demande d\'échange' : 'Swap request'}</h3>
            <div style={{ fontSize: 12, color: t.texteSecondaire, marginBottom: 16 }}>
              {lang === 'fr' ? `${respondModal.echange.demandeur?.nom} propose un échange` : `${respondModal.echange.demandeur?.nom} is proposing a swap`}
            </div>

            {/* Shift comparison */}
            {(() => {
              const e = respondModal.echange
              const sdSt = e.shift_demandeur?.shift_types
              const srSt = e.shift_recepteur?.shift_types
              return (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <div style={{ flex: 1, background: `${sdSt?.couleur || t.accent}14`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: t.texteFaible, marginBottom: 4, letterSpacing: '0.06em' }}>
                      {lang === 'fr' ? 'LEUR SHIFT' : 'THEIR SHIFT'}
                    </div>
                    <div style={{ fontSize: 13, color: t.texte, marginBottom: 2 }}>{sdSt?.nom || '—'}</div>
                    <div style={{ fontSize: 11, color: t.texteSecondaire }}>{fmtShiftDate(e.shift_demandeur?.date, lang, MOIS)}</div>
                    {sdSt && <div style={{ fontSize: 10, color: t.texteFaible }}>{sdSt.debut} – {sdSt.fin}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', color: t.texteFaible, fontSize: 18 }}>⇄</div>
                  <div style={{ flex: 1, background: `${srSt?.couleur || t.accent}14`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: t.texteFaible, marginBottom: 4, letterSpacing: '0.06em' }}>
                      {lang === 'fr' ? 'VOTRE SHIFT' : 'YOUR SHIFT'}
                    </div>
                    <div style={{ fontSize: 13, color: t.texte, marginBottom: 2 }}>{srSt?.nom || '—'}</div>
                    <div style={{ fontSize: 11, color: t.texteSecondaire }}>{fmtShiftDate(e.shift_recepteur?.date, lang, MOIS)}</div>
                    {srSt && <div style={{ fontSize: 10, color: t.texteFaible }}>{srSt.debut} – {srSt.fin}</div>}
                  </div>
                </div>
              )
            })()}

            {/* Choice */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setRespondAccept(true)} style={{ flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', fontFamily: font, fontSize: 13, background: respondAccept === true ? 'rgba(114,186,128,0.2)' : t.surface2, border: `1px solid ${respondAccept === true ? 'rgba(114,186,128,0.6)' : t.border}`, color: respondAccept === true ? '#72BA80' : t.texteSecondaire }}>
                ✓ {lang === 'fr' ? 'Accepter' : 'Accept'}
              </button>
              <button onClick={() => setRespondAccept(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', fontFamily: font, fontSize: 13, background: respondAccept === false ? 'rgba(224,112,112,0.2)' : t.surface2, border: `1px solid ${respondAccept === false ? 'rgba(224,112,112,0.6)' : t.border}`, color: respondAccept === false ? '#E07070' : t.texteSecondaire }}>
                ✗ {lang === 'fr' ? 'Refuser' : 'Decline'}
              </button>
            </div>

            {/* Comment on refusal */}
            {respondAccept === false && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6 }}>{lang === 'fr' ? 'Motif (optionnel)' : 'Reason (optional)'}</div>
                <textarea
                  value={respondComment}
                  onChange={e => setRespondComment(e.target.value)}
                  placeholder={lang === 'fr' ? 'Ex: Je ne peux pas ce jour-là…' : 'E.g. I have a conflict that day…'}
                  rows={3}
                  style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texte, padding: '10px', fontSize: 12, fontFamily: font, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setRespondModal(null); setRespondAccept(null); setRespondComment('') }} style={{ flex: 1, padding: '12px', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, color: t.texteSecondaire, cursor: 'pointer', fontSize: 13, fontFamily: font }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
              <button
                onClick={() => respondAccept !== null && respondExchange(respondAccept)}
                disabled={saving || respondAccept === null}
                style={{ flex: 2, padding: '12px', background: respondAccept === false ? '#E07070' : respondAccept === true ? '#72BA80' : t.accent, border: 'none', borderRadius: 10, color: '#fff', cursor: respondAccept === null ? 'default' : 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600, opacity: respondAccept === null ? 0.4 : 1 }}>
                {saving ? '...' : respondAccept === false ? (lang === 'fr' ? 'Confirmer le refus' : 'Confirm decline') : respondAccept === true ? (lang === 'fr' ? 'Confirmer l\'acceptation' : 'Confirm acceptance') : (lang === 'fr' ? 'Choisir' : 'Choose')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Approve modal (manager) ─── */}
      {approveModal && (
        <div onClick={() => { setApproveModal(null); setApproveReject(null); setApproveComment('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: t.surface1, borderRadius: '20px 20px 0 0', padding: '20px 18px 32px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: t.border, margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 300, margin: '0 0 4px', color: t.texte }}>🔄 {lang === 'fr' ? 'Approuver l\'échange' : 'Approve swap'}</h3>
            <div style={{ fontSize: 12, color: t.texteSecondaire, marginBottom: 16 }}>
              {approveModal.echange.demandeur?.nom} ↔ {approveModal.echange.recepteur?.nom}
            </div>

            {/* Shift comparison */}
            {(() => {
              const e = approveModal.echange
              const sdSt = e.shift_demandeur?.shift_types
              const srSt = e.shift_recepteur?.shift_types
              return (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1, background: `${sdSt?.couleur || t.accent}14`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: t.texteFaible, marginBottom: 4 }}>{e.demandeur?.nom?.split(' ')[0]}</div>
                    <div style={{ fontSize: 12, color: t.texte }}>{sdSt?.nom || '—'}</div>
                    <div style={{ fontSize: 10, color: t.texteSecondaire }}>{fmtShiftDate(e.shift_demandeur?.date, lang, MOIS)}</div>
                    {sdSt && <div style={{ fontSize: 9, color: t.texteFaible }}>{sdSt.debut}–{sdSt.fin}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', color: t.texteFaible, fontSize: 16 }}>⇄</div>
                  <div style={{ flex: 1, background: `${srSt?.couleur || t.accent}14`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: t.texteFaible, marginBottom: 4 }}>{e.recepteur?.nom?.split(' ')[0]}</div>
                    <div style={{ fontSize: 12, color: t.texte }}>{srSt?.nom || '—'}</div>
                    <div style={{ fontSize: 10, color: t.texteSecondaire }}>{fmtShiftDate(e.shift_recepteur?.date, lang, MOIS)}</div>
                    {srSt && <div style={{ fontSize: 9, color: t.texteFaible }}>{srSt.debut}–{srSt.fin}</div>}
                  </div>
                </div>
              )
            })()}

            {/* Coverage check */}
            {(() => {
              const check = checkExchangeCoverage(approveModal.echange)
              return (
                <div style={{ background: check === 'ok' ? 'rgba(114,186,128,0.1)' : 'rgba(224,160,80,0.1)', border: `1px solid ${check === 'ok' ? 'rgba(114,186,128,0.3)' : 'rgba(224,160,80,0.3)'}`, borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: check === 'ok' ? '#72BA80' : '#E0A850' }}>
                  {check === 'ok'
                    ? (lang === 'fr' ? '✓ Couverture des rôles compatible' : '✓ Role coverage compatible')
                    : (lang === 'fr' ? '⚠ Rôles différents — vérifier la couverture' : '⚠ Different roles — verify coverage')}
                </div>
              )
            })()}

            {/* Choice */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setApproveReject(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', fontFamily: font, fontSize: 13, background: approveReject === false ? 'rgba(114,186,128,0.2)' : t.surface2, border: `1px solid ${approveReject === false ? 'rgba(114,186,128,0.6)' : t.border}`, color: approveReject === false ? '#72BA80' : t.texteSecondaire }}>
                ✓ {lang === 'fr' ? 'Approuver' : 'Approve'}
              </button>
              <button onClick={() => setApproveReject(true)} style={{ flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', fontFamily: font, fontSize: 13, background: approveReject === true ? 'rgba(224,112,112,0.2)' : t.surface2, border: `1px solid ${approveReject === true ? 'rgba(224,112,112,0.6)' : t.border}`, color: approveReject === true ? '#E07070' : t.texteSecondaire }}>
                ✗ {lang === 'fr' ? 'Rejeter' : 'Reject'}
              </button>
            </div>

            {/* Comment on rejection */}
            {approveReject === true && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: t.texteSecondaire, marginBottom: 6 }}>{lang === 'fr' ? 'Motif du rejet (optionnel)' : 'Rejection reason (optional)'}</div>
                <textarea
                  value={approveComment}
                  onChange={e => setApproveComment(e.target.value)}
                  placeholder={lang === 'fr' ? 'Ex: Couverture insuffisante ce soir-là…' : 'E.g. Insufficient coverage that evening…'}
                  rows={3}
                  style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.texte, padding: '10px', fontSize: 12, fontFamily: font, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setApproveModal(null); setApproveReject(null); setApproveComment('') }} style={{ flex: 1, padding: '12px', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, color: t.texteSecondaire, cursor: 'pointer', fontSize: 13, fontFamily: font }}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
              <button
                onClick={() => approveReject !== null && approveExchange(!approveReject)}
                disabled={saving || approveReject === null}
                style={{ flex: 2, padding: '12px', background: approveReject === true ? '#E07070' : approveReject === false ? '#72BA80' : t.accent, border: 'none', borderRadius: 10, color: '#fff', cursor: approveReject === null ? 'default' : 'pointer', fontSize: 13, fontFamily: font, fontWeight: 600, opacity: approveReject === null ? 0.4 : 1 }}>
                {saving ? '...' : approveReject === true ? (lang === 'fr' ? 'Confirmer le rejet' : 'Confirm rejection') : approveReject === false ? (lang === 'fr' ? 'Confirmer l\'approbation' : 'Confirm approval') : (lang === 'fr' ? 'Choisir' : 'Choose')}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  )
}
