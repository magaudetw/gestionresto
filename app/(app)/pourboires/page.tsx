'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Navigation from '@/components/Navigation'
import { getTheme } from '@/lib/themes'

// ── Helpers ──────────────────────────────────────────────────────────────────

function roundQ(h: number): number { return Math.round(h * 4) / 4 }
function fmt$(n: number): string { return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
function isoDate(d: Date): string { return d.toISOString().split('T')[0] }
function inferService(debut: string): 'midi' | 'soir' {
  return parseInt(debut.split(':')[0], 10) < 15 ? 'midi' : 'soir'
}
function getCoeff(roles: string[]): number {
  const hasMain = roles.some(r => ['gerant', 'admin', 'bar', 'serveur'].includes(r))
  return !hasMain && roles.includes('busboy') ? 0.5 : 1.0
}

const MOIS_FR = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc']
const MOIS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const JOURS_ABR_FR = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
const JOURS_ABR_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmtDate(dateStr: string, lang: 'fr' | 'en'): string {
  const d = new Date(dateStr + 'T00:00:00')
  const MOIS = lang === 'fr' ? MOIS_FR : MOIS_EN
  const JOURS = lang === 'fr' ? JOURS_ABR_FR : JOURS_ABR_EN
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`
}

function getWeekBounds(offset: number): { start: string; end: string; monday: Date; saturday: Date } {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5)
  return { start: isoDate(monday), end: isoDate(saturday), monday, saturday }
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#E07070', gerant: '#C9A84C', bar: '#7EB8F7', serveur: '#82E0AA', busboy: '#C39BD3',
}
const ROLE_LBL_FR: Record<string, string> = {
  admin: 'Admin', gerant: 'Gérant', bar: 'Bar', serveur: 'Serveur', busboy: 'Busboy',
}
const ROLE_LBL_EN: Record<string, string> = {
  admin: 'Admin', gerant: 'Manager', bar: 'Bar', serveur: 'Server', busboy: 'Busboy',
}

// ── Local types ───────────────────────────────────────────────────────────────

interface EmploData {
  userId: string
  nom: string
  roles: string[]
  heuresBrutes: number | null
  heuresId: string | null
  heures: number
  montantExistant: number | null
}

interface CoteState {
  id: string
  nom: string
  pourcentage: number
  enabled: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PourbioiresPage() {
  const [profile, setProfile]       = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [userId, setUserId]         = useState('')
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const router = useRouter()

  // Manager state
  const [selDate, setSelDate]       = useState(isoDate(new Date()))
  const [selService, setSelService] = useState<'midi' | 'soir'>('midi')
  const [poolShift, setPoolShift]   = useState<any>(null)
  const [employes, setEmployes]     = useState<EmploData[]>([])
  const [poolTotal, setPoolTotal]   = useState('')
  const [cotes, setCotes]           = useState<CoteState[]>([])
  const [loadingSvc, setLoadingSvc] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [savedOk, setSavedOk]       = useState(false)
  const [unlocked, setUnlocked]     = useState(false)

  // Employee state
  const [weekOffset, setWeekOffset]   = useState(0)
  const [weekItems, setWeekItems]     = useState<any[]>([])
  const [weekSummary, setWeekSummary] = useState({ salaire: 0, pourboires: 0, totalH: 0, isEstimate: false })
  const [expanded, setExpanded]       = useState<string | null>(null)

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)

      const rid = p?.restaurant_ids?.[0] || null
      setRestaurantId(rid)

      const isManager = p?.roles?.includes('gerant') || p?.roles?.includes('admin')
      if (isManager && rid) {
        const { data: cd } = await supabase
          .from('cotes').select('*')
          .eq('restaurant_id', rid).eq('actif', true).order('nom')
        setCotes((cd || []).map((c: any) => ({
          id: c.id, nom: c.nom, pourcentage: c.pourcentage, enabled: true,
        })))
      }
      setLoading(false)
    }
    init()
  }, [router])

  // ── Load service data (manager) ───────────────────────────────────────────

  const loadServiceData = useCallback(async () => {
    if (!restaurantId) return
    setLoadingSvc(true)
    setUnlocked(false)

    // pool_shift for this date/service
    const { data: ps } = await supabase
      .from('pool_shifts').select('*')
      .eq('restaurant_id', restaurantId)
      .eq('date', selDate).eq('service', selService)
      .maybeSingle()
    setPoolShift(ps || null)
    setPoolTotal(ps?.pool_total ? String(ps.pool_total) : '')

    // Scheduled published shifts for that date
    const { data: shifts } = await supabase
      .from('horaire_shifts')
      .select('*, shift_types(*), profiles(nom,roles)')
      .eq('restaurant_id', restaurantId)
      .eq('date', selDate).eq('statut', 'publie')

    // Filter by service
    const svcShifts = (shifts || []).filter((s: any) =>
      s.shift_types && inferService(s.shift_types.debut) === selService
    )

    // Dedupe by user
    const seen = new Set<string>()
    const users: any[] = []
    for (const s of svcShifts) {
      if (!seen.has(s.user_id)) { seen.add(s.user_id); users.push(s) }
    }

    // heures_employes for those users on that date
    const uids = users.map(s => s.user_id)
    const heuresMap: Record<string, any> = {}
    if (uids.length > 0) {
      // Prefer the row linked to this pool_shift if already validated; else any row for this date
      const { data: hd } = await supabase
        .from('heures_employes').select('*')
        .in('user_id', uids).eq('date', selDate)
      for (const h of (hd || [])) {
        // Prefer pool_shift-linked rows, fallback to any
        if (!heuresMap[h.user_id] || h.pool_shift_id === ps?.id) {
          heuresMap[h.user_id] = h
        }
      }
    }

    const list: EmploData[] = users.map(s => {
      const h = heuresMap[s.user_id]
      const hb = h?.heures ?? null
      return {
        userId: s.user_id,
        nom: s.profiles?.nom || '—',
        roles: s.profiles?.roles || [],
        heuresBrutes: hb,
        heuresId: h?.id || null,
        heures: hb ?? 0,
        montantExistant: h?.montant_employe ?? null,
      }
    })
    setEmployes(list)
    setLoadingSvc(false)
  }, [restaurantId, selDate, selService])

  useEffect(() => {
    const isManager = profile?.roles?.includes('gerant') || profile?.roles?.includes('admin')
    if (isManager && restaurantId) loadServiceData()
  }, [profile, restaurantId, loadServiceData])

  // ── Load week data (employee) ─────────────────────────────────────────────

  const loadWeekData = useCallback(async () => {
    if (!userId || !profile) return
    const isManager = profile?.roles?.includes('gerant') || profile?.roles?.includes('admin')
    if (isManager) return

    const { start, end } = getWeekBounds(weekOffset)
    const taux = profile?.taux_horaire || 0

    const { data: hd } = await supabase
      .from('heures_employes')
      .select('*, pool_shifts(*)')
      .eq('user_id', userId)
      .gte('date', start).lte('date', end)
      .order('date')

    let totalH = 0
    let totalTips = 0
    let hasUnvalidated = false

    const items = (hd || []).map((h: any) => {
      const ps = h.pool_shifts
      const ha = roundQ(h.heures || 0)
      totalH += ha
      const montant = h.montant_employe ?? 0
      totalTips += montant
      if (!ps || ps.statut !== 'valide') hasUnvalidated = true
      return {
        id: h.id,
        date: h.date,
        service: ps?.service || null,
        heures: h.heures || 0,
        ha,
        montant,
        valide: ps?.statut === 'valide',
        salairePart: ha * taux,
      }
    })

    const salaire = totalH * taux
    const isEstimate = weekOffset === 0 && (items.length === 0 || hasUnvalidated)
    setWeekItems(items)
    setWeekSummary({ salaire, pourboires: totalTips, totalH, isEstimate })
  }, [userId, profile, weekOffset])

  useEffect(() => {
    const isManager = profile?.roles?.includes('gerant') || profile?.roles?.includes('admin')
    if (!isManager && userId) loadWeekData()
  }, [profile, userId, loadWeekData])

  // ── Validate service ──────────────────────────────────────────────────────

  async function handleValidate() {
    if (!restaurantId || !poolTotal || employes.length === 0) return
    setSaving(true)

    const total = parseFloat(poolTotal) || 0
    const cotesDeduites = cotes.filter(c => c.enabled)
      .reduce((s, c) => s + total * c.pourcentage / 100, 0)
    const poolNet = total - cotesDeduites

    const withPoints = employes.map(e => {
      const ha = roundQ(e.heures)
      const coeff = getCoeff(e.roles)
      return { ...e, ha, coeff, points: coeff * ha }
    })
    const totalPoints = withPoints.reduce((s, e) => s + e.points, 0)
    const withParts = withPoints.map(e => ({
      ...e,
      part: totalPoints > 0 ? Math.round((e.points / totalPoints) * poolNet * 100) / 100 : 0,
    }))

    // Upsert pool_shift
    let psId = poolShift?.id
    const psPayload = {
      restaurant_id: restaurantId,
      date: selDate,
      service: selService,
      pool_total: total,
      statut: 'valide',
    }
    if (psId) {
      await supabase.from('pool_shifts').update(psPayload).eq('id', psId)
    } else {
      const { data: newPs } = await supabase.from('pool_shifts').insert(psPayload).select().single()
      psId = newPs?.id
    }

    // Upsert heures_employes for each employee
    for (const e of withParts) {
      const payload = {
        user_id: e.userId,
        pool_shift_id: psId,
        date: selDate,
        heures: e.heures,
        source: e.heuresId ? 'import' : 'manuel',
        montant_employe: e.part,
      }
      if (e.heuresId) {
        await supabase.from('heures_employes').update(payload).eq('id', e.heuresId)
      } else {
        await supabase.from('heures_employes').insert(payload)
      }
    }

    // Notifications
    const svcFr = selService === 'midi' ? 'Midi' : 'Soir'
    for (const e of withParts) {
      await supabase.from('notifications').insert({
        user_id: e.userId,
        type: 'heures',
        message: `Pourboires ${svcFr} du ${fmtDate(selDate, 'fr')} : ${fmt$(e.part)}`,
        lu: false,
      })
    }

    await loadServiceData()
    setSaving(false)
    setSavedOk(true)
    setTimeout(() => setSavedOk(false), 3000)
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C9A84C', fontSize: 12, letterSpacing: '0.2em' }}>CHARGEMENT...</div>
    </div>
  )

  const t = getTheme(profile?.theme)
  const lang = (profile?.lang || 'fr') as 'fr' | 'en'
  const font = profile?.font_family || 'Georgia, serif'
  const role = profile?.roles?.[0] || 'employe'
  const isManager = role === 'gerant' || role === 'admin'
  const tauxHoraire = profile?.taux_horaire || 0

  // ── Manager computed values ───────────────────────────────────────────────

  const totalInput = parseFloat(poolTotal) || 0
  const cotesDeduites = cotes.filter(c => c.enabled).reduce((s, c) => s + totalInput * c.pourcentage / 100, 0)
  const poolNet = totalInput - cotesDeduites

  const emploWithCalc = employes.map(e => {
    const ha = roundQ(e.heures)
    const coeff = getCoeff(e.roles)
    return { ...e, ha, coeff, points: coeff * ha }
  })
  const totalPoints = emploWithCalc.reduce((s, e) => s + e.points, 0)
  const repartition = emploWithCalc.map(e => ({
    ...e,
    part: totalPoints > 0 ? (e.points / totalPoints) * poolNet : 0,
  }))
  const isValidated = poolShift?.statut === 'valide' && !unlocked

  // ── Employee week label ───────────────────────────────────────────────────

  const { monday, saturday } = getWeekBounds(weekOffset)
  const MOIS = lang === 'fr' ? MOIS_FR : MOIS_EN
  const weekLabel = `${monday.getDate()} ${MOIS[monday.getMonth()]}`
  const weekEndLabel = `${saturday.getDate()} ${MOIS[saturday.getMonth()]}`

  // ── Strings ───────────────────────────────────────────────────────────────

  const L = (fr: string, en: string) => lang === 'fr' ? fr : en

  const btnStyle = {
    width: 28, height: 28, borderRadius: 7,
    border: `1px solid ${t.border}`, background: t.surface2,
    color: t.texte, cursor: 'pointer', fontSize: 15,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as const

  const sectionLabel = (txt: string) => (
    <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 8 }}>
      {txt}
    </div>
  )

  return (
    <div style={{ background: t.fond, minHeight: '100vh', color: t.texte, fontFamily: font, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      <Header nom={profile?.nom || ''} restaurant="Le Carré" lang={lang} />

      <main style={{ flex: 1, padding: '16px', paddingBottom: 100 }}>

        <h1 style={{ fontSize: 24, fontWeight: 300, marginBottom: 20 }}>
          {L('Pourboires', 'Tips & Pay')}
        </h1>

        {/* ════════════════════════════════ MANAGER VIEW ═══════════════════════════════ */}
        {isManager ? (
          <>
            {/* ── Date + Service selector ── */}
            <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 6 }}>
                  {L('Date', 'Date')}
                </div>
                <input
                  type="date"
                  value={selDate}
                  onChange={e => setSelDate(e.target.value)}
                  style={{
                    width: '100%', background: t.surface2, border: `1px solid ${t.border}`,
                    borderRadius: 8, color: t.texte, padding: '9px 12px',
                    fontSize: 14, fontFamily: "'Courier New', monospace",
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 6 }}>
                  {L('Service', 'Service')}
                </div>
                <div style={{ display: 'flex', background: t.surface2, borderRadius: 10, padding: 3, border: `1px solid ${t.border}` }}>
                  {(['midi', 'soir'] as const).map(svc => (
                    <button key={svc} onClick={() => setSelService(svc)} style={{
                      flex: 1, padding: '8px', borderRadius: 7, border: 'none', cursor: 'pointer',
                      background: selService === svc ? t.accent : 'transparent',
                      color: selService === svc ? (t.isDark ? '#080808' : '#fff') : t.texteSecondaire,
                      fontSize: 13, fontFamily: font, fontWeight: selService === svc ? 600 : 400,
                      letterSpacing: '0.04em',
                    }}>
                      {svc === 'midi' ? L('Midi', 'Lunch') : L('Soir', 'Dinner')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loadingSvc ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: t.texteFaible, fontSize: 11, letterSpacing: '0.14em' }}>
                CHARGEMENT...
              </div>
            ) : (
              <>
                {/* ── Validated banner ── */}
                {isValidated && (
                  <div style={{
                    background: 'rgba(114,186,128,0.1)', border: '1px solid rgba(114,186,128,0.3)',
                    borderRadius: 12, padding: '12px 16px', marginBottom: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18, color: '#72BA80' }}>✓</span>
                      <div>
                        <div style={{ fontSize: 13, color: '#72BA80' }}>{L('Validé', 'Validated')}</div>
                        <div style={{ fontSize: 11, color: t.texteSecondaire }}>
                          {fmt$(totalInput)} · {employes.length} {L('employés', 'employees')}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setUnlocked(true)} style={{
                      background: 'transparent', border: `1px solid ${t.border}`,
                      borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                      fontSize: 11, color: t.texteSecondaire, fontFamily: font,
                    }}>
                      {L('Modifier', 'Edit')}
                    </button>
                  </div>
                )}

                {/* ── Pool total ── */}
                <div style={{ marginBottom: 14 }}>
                  {sectionLabel(L('Total du pool ($)', 'Pool total ($)'))}
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                      color: t.accent, fontSize: 18, fontFamily: "'Courier New', monospace", pointerEvents: 'none',
                    }}>$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={poolTotal}
                      onChange={e => setPoolTotal(e.target.value)}
                      disabled={isValidated}
                      placeholder="0.00"
                      style={{
                        width: '100%', background: t.surface1,
                        border: `1px solid ${isValidated ? t.border : t.borderAccent}`,
                        borderRadius: 12, color: t.texte,
                        padding: '13px 14px 13px 32px',
                        fontSize: 22, fontFamily: "'Courier New', monospace",
                        outline: 'none', boxSizing: 'border-box',
                        opacity: isValidated ? 0.6 : 1,
                      }}
                    />
                  </div>
                </div>

                {/* ── Employees ── */}
                <div style={{ marginBottom: 14 }}>
                  {sectionLabel(`${L('Employés présents', 'Present staff')} (${employes.length})`)}
                  {employes.length === 0 ? (
                    <div style={{
                      textAlign: 'center', padding: '18px', color: t.texteFaible, fontSize: 13,
                      background: t.surface1, borderRadius: 12, border: `1px solid ${t.border}`,
                    }}>
                      {L('Aucun shift publié pour ce service', 'No published shifts for this service')}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {employes.map((e, i) => {
                        const ha = roundQ(e.heures)
                        const mainRole = e.roles.find(r => ['gerant','admin','bar','serveur','busboy'].includes(r)) || e.roles[0] || ''
                        const roleColor = ROLE_COLORS[mainRole] || t.accent
                        const roleLabel = (lang === 'fr' ? ROLE_LBL_FR : ROLE_LBL_EN)[mainRole] || mainRole
                        return (
                          <div key={e.userId} style={{
                            background: t.surface1, border: `1px solid ${t.border}`,
                            borderRadius: 12, padding: '10px 14px',
                          }}>
                            {/* Name + role + (validated: amount) */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isValidated ? 0 : 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 13, color: t.texte }}>{e.nom}</span>
                                <span style={{
                                  padding: '2px 7px', borderRadius: 8, fontSize: 9,
                                  background: `${roleColor}20`, border: `1px solid ${roleColor}40`, color: roleColor,
                                }}>{roleLabel}</span>
                              </div>
                              {isValidated ? (
                                <span style={{ fontSize: 14, color: '#72BA80', fontFamily: "'Courier New', monospace" }}>
                                  {e.montantExistant != null ? fmt$(e.montantExistant) : '—'}
                                </span>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {e.heuresBrutes !== null && e.heuresBrutes !== e.heures && (
                                    <span style={{ fontSize: 10, color: t.texteFaible, textDecoration: 'line-through' }}>
                                      {e.heuresBrutes}h
                                    </span>
                                  )}
                                  <span style={{ fontSize: 11, color: ha !== e.heuresBrutes ? t.accent : t.texteSecondaire }}>
                                    → {ha}h
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Hour adjuster (edit mode) */}
                            {!isValidated && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 10, color: t.texteFaible, flex: 1 }}>
                                  {e.heuresBrutes !== null
                                    ? `${e.heuresBrutes}h ${L('brutes', 'raw')} → ${ha}h ${L('arrondies', 'rounded')}`
                                    : L('Aucune heure importée', 'No imported hours')}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <button
                                    style={btnStyle}
                                    onClick={() => setEmployes(prev => prev.map((emp, j) =>
                                      j === i ? { ...emp, heures: Math.max(0, parseFloat((emp.heures - 0.25).toFixed(2))) } : emp
                                    ))}
                                  >−</button>
                                  <span style={{ minWidth: 44, textAlign: 'center', fontSize: 14, color: t.texte, fontFamily: "'Courier New', monospace" }}>
                                    {e.heures}h
                                  </span>
                                  <button
                                    style={btnStyle}
                                    onClick={() => setEmployes(prev => prev.map((emp, j) =>
                                      j === i ? { ...emp, heures: parseFloat((emp.heures + 0.25).toFixed(2)) } : emp
                                    ))}
                                  >+</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* ── Cotes ── */}
                <div style={{ marginBottom: 14 }}>
                  {sectionLabel(L('Cotes actives pour ce service', 'Active deductions'))}
                  {cotes.length === 0 ? (
                    <div style={{ fontSize: 12, color: t.texteFaible, padding: '4px 0 10px' }}>
                      {L('Aucune cote configurée — voir Réglages', 'No deductions configured — see Settings')}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {cotes.map((c, i) => {
                        const montant = totalInput * c.pourcentage / 100
                        return (
                          <div key={c.id} style={{
                            background: t.surface1,
                            border: `1px solid ${c.enabled ? t.borderAccent : t.border}`,
                            borderRadius: 10, padding: '10px 14px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            opacity: isValidated ? 0.7 : 1,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <button
                                disabled={isValidated}
                                onClick={() => setCotes(prev => prev.map((ct, j) =>
                                  j === i ? { ...ct, enabled: !ct.enabled } : ct
                                ))}
                                style={{
                                  width: 18, height: 18, borderRadius: 4,
                                  border: `1px solid ${c.enabled ? t.accent : t.border}`,
                                  background: c.enabled ? t.accent : 'transparent',
                                  cursor: isValidated ? 'default' : 'pointer', flexShrink: 0,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                {c.enabled && <span style={{ fontSize: 9, color: t.isDark ? '#080808' : '#fff' }}>✓</span>}
                              </button>
                              <span style={{ fontSize: 13, color: t.texte }}>{c.nom}</span>
                              <span style={{ fontSize: 11, color: t.texteSecondaire }}>{c.pourcentage}%</span>
                            </div>
                            <span style={{ fontSize: 13, color: c.enabled ? '#E07070' : t.texteFaible, fontFamily: "'Courier New', monospace" }}>
                              {c.enabled && totalInput > 0 ? `−${fmt$(montant)}` : '—'}
                            </span>
                          </div>
                        )
                      })}

                      {/* Total après cotes */}
                      <div style={{
                        background: `${t.accent}0C`, border: `1px solid ${t.borderAccent}`,
                        borderRadius: 10, padding: '10px 14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <div>
                          <span style={{ fontSize: 12, color: t.accent }}>
                            {L('Total après cotes', 'After deductions')}
                          </span>
                          {cotesDeduites > 0 && (
                            <span style={{ fontSize: 10, color: t.texteSecondaire, marginLeft: 8 }}>
                              (−{fmt$(cotesDeduites)})
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 16, color: t.accent, fontFamily: "'Courier New', monospace", fontWeight: 600 }}>
                          {fmt$(poolNet)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Répartition preview ── */}
                {employes.length > 0 && totalInput > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    {sectionLabel(L('Répartition calculée', 'Calculated distribution'))}
                    <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
                      {/* Header */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px 56px 72px', padding: '8px 14px', borderBottom: `1px solid ${t.border}`, background: t.surface2 }}>
                        {['Nom','Coeff','Points','Part'].map((h, i) => (
                          <div key={h} style={{ fontSize: 9, color: t.texteFaible, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: i > 0 ? 'right' : 'left' }}>
                            {h}
                          </div>
                        ))}
                      </div>
                      {repartition.map((e, i) => (
                        <div key={e.userId} style={{
                          display: 'grid', gridTemplateColumns: '1fr 48px 56px 72px',
                          padding: '9px 14px', alignItems: 'center',
                          borderBottom: i < repartition.length - 1 ? `1px solid ${t.border}` : 'none',
                          background: isValidated ? `${t.accent}06` : 'transparent',
                        }}>
                          <div>
                            <div style={{ fontSize: 12, color: t.texte }}>{e.nom}</div>
                            <div style={{ fontSize: 10, color: t.texteSecondaire }}>{e.ha}h</div>
                          </div>
                          <div style={{ fontSize: 12, color: e.coeff < 1 ? '#C39BD3' : t.texteSecondaire, textAlign: 'right', fontFamily: "'Courier New', monospace" }}>
                            ×{e.coeff}
                          </div>
                          <div style={{ fontSize: 12, color: t.texteSecondaire, textAlign: 'right', fontFamily: "'Courier New', monospace" }}>
                            {e.points.toFixed(2)}
                          </div>
                          <div style={{ fontSize: 14, color: t.accent, textAlign: 'right', fontFamily: "'Courier New', monospace", fontWeight: 600 }}>
                            {fmt$(e.part)}
                          </div>
                        </div>
                      ))}
                      {/* Total line */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 48px 56px 72px',
                        padding: '9px 14px', borderTop: `1px solid ${t.border}`, background: t.surface2,
                      }}>
                        <div style={{ fontSize: 10, color: t.texteSecondaire, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {L('Total', 'Total')}
                        </div>
                        <div />
                        <div style={{ fontSize: 12, color: t.texteSecondaire, textAlign: 'right', fontFamily: "'Courier New', monospace" }}>
                          {totalPoints.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 14, color: t.accent, textAlign: 'right', fontFamily: "'Courier New', monospace", fontWeight: 600 }}>
                          {fmt$(repartition.reduce((s, e) => s + e.part, 0))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Validate button ── */}
                {!isValidated && (
                  <button
                    onClick={handleValidate}
                    disabled={saving || !poolTotal || employes.length === 0}
                    style={{
                      width: '100%', padding: '14px',
                      background: savedOk ? '#72BA80' : (!poolTotal || employes.length === 0) ? t.surface2 : t.accent,
                      border: 'none', borderRadius: 12,
                      cursor: (saving || !poolTotal || employes.length === 0) ? 'not-allowed' : 'pointer',
                      color: savedOk ? '#fff' : t.isDark ? '#080808' : '#fff',
                      fontSize: 14, letterSpacing: '0.08em', fontFamily: font, fontWeight: 600,
                      opacity: (!poolTotal || employes.length === 0) ? 0.4 : 1,
                      transition: 'background 0.3s',
                    }}
                  >
                    {savedOk
                      ? L('Validé ✓', 'Validated ✓')
                      : saving ? '...'
                      : L('Valider ce service', 'Validate service')}
                  </button>
                )}
              </>
            )}
          </>
        ) : (

        /* ════════════════════════════════ EMPLOYEE VIEW ═════════════════════════════ */
          <>
            {/* ── Week navigation ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <button
                onClick={() => { setWeekOffset(o => Math.max(o - 1, -7)); setExpanded(null) }}
                disabled={weekOffset <= -7}
                style={{
                  width: 38, height: 38, borderRadius: 10,
                  border: `1px solid ${t.border}`, background: t.surface1,
                  color: weekOffset <= -7 ? t.texteFaible : t.texte,
                  cursor: weekOffset <= -7 ? 'default' : 'pointer', fontSize: 18,
                }}
              >‹</button>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: t.texteSecondaire, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                  {L('Semaine du', 'Week of')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                  <span style={{ fontSize: 13, color: t.texte }}>{weekLabel} – {weekEndLabel}</span>
                  {weekSummary.isEstimate && (
                    <span style={{
                      fontSize: 8, padding: '2px 5px', borderRadius: 4,
                      border: `1px solid ${t.border}`, color: t.texteFaible,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}>
                      {L('ESTIMATION', 'ESTIMATE')}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => { setWeekOffset(o => Math.min(o + 1, 0)); setExpanded(null) }}
                disabled={weekOffset >= 0}
                style={{
                  width: 38, height: 38, borderRadius: 10,
                  border: `1px solid ${t.border}`, background: t.surface1,
                  color: weekOffset >= 0 ? t.texteFaible : t.texte,
                  cursor: weekOffset >= 0 ? 'default' : 'pointer', fontSize: 18,
                }}
              >›</button>
            </div>

            {/* ── Summary card ── */}
            <div style={{
              background: `linear-gradient(135deg, ${t.accent}22, ${t.accentClair}08)`,
              border: `1px solid ${t.borderAccent}`,
              borderRadius: 16, padding: '18px 20px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.accent, marginBottom: 8 }}>
                {L('Virement total', 'Total transfer')}
              </div>
              <div style={{ fontSize: 38, fontWeight: 300, color: t.accent, fontFamily: "'Courier New', monospace", marginBottom: 16 }}>
                {fmt$(weekSummary.salaire + weekSummary.pourboires)}
              </div>

              <div style={{ borderTop: `1px solid ${t.borderAccent}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {/* Salary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: t.texte }}>{L('Salaire', 'Salary')}</div>
                    {tauxHoraire > 0 && (
                      <div style={{ fontSize: 10, color: t.texteSecondaire }}>
                        {weekSummary.totalH}h × {fmt$(tauxHoraire)}/h
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 15, fontFamily: "'Courier New', monospace", color: t.texte }}>
                    {fmt$(weekSummary.salaire)}
                  </div>
                </div>
                {/* Tips */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: t.texte }}>{L('Pourboires', 'Tips')}</div>
                    <div style={{ fontSize: 10, color: t.texteSecondaire }}>
                      {weekItems.length} {L('service(s)', 'service(s)')}
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontFamily: "'Courier New', monospace", color: weekSummary.pourboires > 0 ? '#72BA80' : t.texteSecondaire }}>
                    {weekSummary.pourboires > 0 ? fmt$(weekSummary.pourboires) : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Service list ── */}
            {weekItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0', color: t.texteFaible, fontSize: 13 }}>
                {L('Aucune donnée pour cette semaine', 'No data for this week')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {weekItems.map(h => {
                  const svcColor = h.service === 'midi' ? '#F4A261' : h.service === 'soir' ? '#7EB8F7' : t.accent
                  const svcLabel = h.service
                    ? (h.service === 'midi' ? L('Midi', 'Lunch') : L('Soir', 'Dinner'))
                    : null
                  const isExp = expanded === h.id
                  return (
                    <button
                      key={h.id}
                      onClick={() => setExpanded(isExp ? null : h.id)}
                      style={{
                        width: '100%', background: t.surface1, border: `1px solid ${t.border}`,
                        borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                        textAlign: 'left', fontFamily: font,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 3, height: 38, borderRadius: 2, background: svcColor, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 13, color: t.texte }}>{fmtDate(h.date, lang)}</span>
                            {svcLabel && (
                              <span style={{
                                fontSize: 10, color: svcColor, padding: '1px 6px', borderRadius: 8,
                                border: `1px solid ${svcColor}44`, background: `${svcColor}11`,
                              }}>{svcLabel}</span>
                            )}
                            {!h.valide && (
                              <span style={{
                                fontSize: 9, color: t.texteFaible, padding: '1px 5px', borderRadius: 4,
                                border: `1px solid ${t.border}`, textTransform: 'uppercase', letterSpacing: '0.04em',
                              }}>
                                {L('En attente', 'Pending')}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: t.texteSecondaire }}>
                            {h.ha}h {tauxHoraire > 0 && `· ${fmt$(h.salairePart)} salaire`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          {h.montant > 0 ? (
                            <div style={{ fontSize: 14, color: '#72BA80', fontFamily: "'Courier New', monospace" }}>
                              {fmt$(h.montant)}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: t.texteFaible }}>—</div>
                          )}
                          <span style={{ fontSize: 11, color: t.texteFaible }}>{isExp ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExp && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div style={{ background: t.surface2, borderRadius: 8, padding: '9px 11px' }}>
                              <div style={{ fontSize: 9, color: t.texteFaible, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                                {L('Salaire', 'Salary')}
                              </div>
                              <div style={{ fontSize: 15, color: t.texte, fontFamily: "'Courier New', monospace" }}>
                                {fmt$(h.salairePart)}
                              </div>
                              {tauxHoraire > 0 && (
                                <div style={{ fontSize: 10, color: t.texteSecondaire, marginTop: 2 }}>
                                  {h.ha}h × {fmt$(tauxHoraire)}/h
                                </div>
                              )}
                            </div>
                            <div style={{ background: t.surface2, borderRadius: 8, padding: '9px 11px' }}>
                              <div style={{ fontSize: 9, color: t.texteFaible, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                                {L('Pourboires', 'Tips')}
                              </div>
                              <div style={{ fontSize: 15, color: h.montant > 0 ? '#72BA80' : t.texteFaible, fontFamily: "'Courier New', monospace" }}>
                                {h.montant > 0 ? fmt$(h.montant) : '—'}
                              </div>
                              {!h.valide && (
                                <div style={{ fontSize: 10, color: t.texteFaible, marginTop: 2 }}>
                                  {L('En attente validation', 'Pending validation')}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{
                            marginTop: 8, padding: '9px 11px', background: `${t.accent}0C`,
                            border: `1px solid ${t.borderAccent}`, borderRadius: 8,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}>
                            <span style={{ fontSize: 11, color: t.accent }}>{L('Total ce service', 'Service total')}</span>
                            <span style={{ fontSize: 15, color: t.accent, fontFamily: "'Courier New', monospace" }}>
                              {fmt$(h.salairePart + h.montant)}
                            </span>
                          </div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      <Navigation role={role} lang={lang} />
    </div>
  )
}
