'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import type { Virement } from '@/types'

function isoDate(d: Date): string { return d.toISOString().split('T')[0] }
function fmt$(n: number): string { return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
function fmtK(n: number): string { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)) }

const MOIS_FR = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc']
const MOIS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getWeekBounds(offset: number) {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: isoDate(monday), end: isoDate(sunday), monday, semaineDu: isoDate(monday) }
}

function fmtWeekLabel(monday: Date, lang: 'fr' | 'en'): string {
  const MOIS = lang === 'fr' ? MOIS_FR : MOIS_EN
  const sun = new Date(monday)
  sun.setDate(monday.getDate() + 6)
  if (monday.getMonth() === sun.getMonth()) {
    return `${monday.getDate()}–${sun.getDate()} ${MOIS[monday.getMonth()]}`
  }
  return `${monday.getDate()} ${MOIS[monday.getMonth()]} – ${sun.getDate()} ${MOIS[sun.getMonth()]}`
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'var(--danger)', gerant: 'var(--warning)', bar: 'var(--info)', serveur: 'var(--success)', busboy: '#C39BD3',
}
const ROLE_LBL: Record<'fr' | 'en', Record<string, string>> = {
  fr: { admin: 'Admin', gerant: 'Gérant', bar: 'Bar', serveur: 'Serveur', busboy: 'Busboy' },
  en: { admin: 'Admin', gerant: 'Manager', bar: 'Bar', serveur: 'Server', busboy: 'Busboy' },
}

interface EmpSummary {
  userId: string
  nom: string
  roles: string[]
  tauxHoraire: number
  heures: number
  salaire: number
  pourboires: number
  total: number
  details: { date: string; service: string; heures: number; tips: number }[]
}

interface WeekTrend { label: string; pool: number; salaire: number }

interface CoteVerseeRow {
  label: string
  poolTotal: number
  distribue: number
  cotes: number
  nbServices: number
}

interface PoolModal {
  date: string
  service: string
  pool_total: string
  notes: string
}

function TrendChart({ data, font }: { data: WeekTrend[]; font: string }) {
  const hasData = data.some(d => d.pool > 0 || d.salaire > 0)
  if (!hasData) return (
    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-faint)', fontSize: 12 }}>
      Aucune donnée
    </div>
  )

  const maxVal = Math.max(...data.flatMap(d => [d.pool, d.salaire]), 1)
  const W = 300; const H = 130
  const padL = 34; const padR = 6; const padT = 18; const padB = 22
  const chartH = H - padT - padB
  const chartW = W - padL - padR
  const n = data.length || 1
  const groupW = chartW / n
  const barW = Math.min(20, groupW * 0.34)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} aria-hidden="true">
      {[0.25, 0.5, 0.75, 1].map(f => {
        const y = padT + chartH * (1 - f)
        return (
          <g key={f}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="2,3" />
            <text x={padL - 3} y={y + 3} textAnchor="end" fontSize={7} fill="var(--text-faint)">
              {fmtK(maxVal * f)}
            </text>
          </g>
        )
      })}
      <line x1={padL} x2={W - padR} y1={padT + chartH} y2={padT + chartH} stroke="var(--border)" strokeWidth={1} />
      {data.map((d, i) => {
        const cx = padL + groupW * i + groupW / 2
        const b1h = d.pool > 0 ? Math.max(2, (d.pool / maxVal) * chartH) : 0
        const b2h = d.salaire > 0 ? Math.max(2, (d.salaire / maxVal) * chartH) : 0
        return (
          <g key={i}>
            <rect x={cx - barW - 1} y={padT + chartH - b1h} width={barW} height={b1h} rx={2}
              fill="var(--accent)" opacity={b1h > 0 ? 0.85 : 0} />
            <rect x={cx + 1} y={padT + chartH - b2h} width={barW} height={b2h} rx={2}
              style={{ fill: 'var(--info)' }} opacity={b2h > 0 ? 0.85 : 0} />
            <text x={cx} y={H - 4} textAnchor="middle" fontSize={8} fill="var(--text-secondary)"
              fontFamily={font}>{d.label}</text>
          </g>
        )
      })}
      <rect x={padL} y={3} width={7} height={7} rx={1} fill="var(--accent)" opacity={0.85} />
      <text x={padL + 10} y={9} fontSize={7} fill="var(--text-secondary)">Pool</text>
      <rect x={padL + 38} y={3} width={7} height={7} rx={1} style={{ fill: 'var(--info)' }} opacity={0.85} />
      <text x={padL + 48} y={9} fontSize={7} fill="var(--text-secondary)">Salaire</text>
    </svg>
  )
}

export default function FinancesPage() {
  const { profile, restaurantId: ctxRid, isManager, loading } = useAuth()
  const [weekOffset, setWeekOffset]         = useState(0)
  const [weekPoolShifts, setWeekPoolShifts] = useState<any[]>([])
  const [allPoolShifts, setAllPoolShifts]   = useState<any[]>([])
  const [empSummaries, setEmpSummaries]     = useState<EmpSummary[]>([])
  const [virements, setVirements]           = useState<Virement[]>([])
  const [trendData, setTrendData]           = useState<WeekTrend[]>([])
  const [cotesData, setCotesData]           = useState<CoteVerseeRow[]>([])
  const [expandedRows, setExpandedRows]     = useState<Set<string>>(new Set())
  const [savingVirement, setSavingVirement] = useState<string | null>(null)

  // Pool shift entry
  const [poolModal, setPoolModal]       = useState<PoolModal | null>(null)
  const [savingPool, setSavingPool]     = useState(false)
  const [poolError, setPoolError]       = useState('')

  // Tip calculation
  const [calcShiftId, setCalcShiftId]   = useState<string | null>(null)
  const [calcLoading, setCalcLoading]   = useState(false)
  const [calcError, setCalcError]       = useState('')

  const router = useRouter()

  useEffect(() => {
    if (!loading && !isManager) router.push('/dashboard')
  }, [loading, isManager, router])

  const loadWeekData = useCallback(async (rid: string, offset: number) => {
    const { start, end, semaineDu } = getWeekBounds(offset)
    const [psRes, allPsRes, heuresRes, empsRes] = await Promise.all([
      supabase.from('pool_shifts').select('*')
        .eq('restaurant_id', rid).gte('date', start).lte('date', end).eq('statut', 'valide'),
      supabase.from('pool_shifts').select('*')
        .eq('restaurant_id', rid).gte('date', start).lte('date', end).order('date'),
      supabase.from('heures_employes').select('*').gte('date', start).lte('date', end),
      supabase.from('profiles').select('id,nom,taux_horaire,roles')
        .contains('restaurant_ids', [rid]).eq('actif', true),
    ])
    const shifts = psRes.data || []
    const heures = heuresRes.data || []
    const emps = empsRes.data || []
    setWeekPoolShifts(shifts)
    setAllPoolShifts(allPsRes.data || [])

    const summaryMap: Record<string, EmpSummary> = {}
    for (const emp of emps) {
      summaryMap[emp.id] = {
        userId: emp.id, nom: emp.nom, roles: emp.roles || [],
        tauxHoraire: emp.taux_horaire || 0,
        heures: 0, salaire: 0, pourboires: 0, total: 0, details: [],
      }
    }
    for (const h of heures) {
      const emp = summaryMap[h.user_id]
      if (!emp) continue
      const hrs = h.heures || 0
      emp.heures += hrs
      emp.salaire += hrs * emp.tauxHoraire
      const ps = shifts.find((s: any) => s.id === h.pool_shift_id)
      const tips = ps ? (h.montant_employe || 0) : 0
      if (ps) emp.pourboires += tips
      emp.details.push({ date: h.date, service: ps?.service || '—', heures: hrs, tips })
    }
    const summaries = Object.values(summaryMap)
      .map(s => ({
        ...s,
        salaire: Math.round(s.salaire * 100) / 100,
        total: Math.round((s.salaire + s.pourboires) * 100) / 100,
      }))
      .filter(s => s.heures > 0 || s.pourboires > 0)
      .sort((a, b) => b.total - a.total)
    setEmpSummaries(summaries)

    if (summaries.length > 0) {
      const rows = summaries.map(s => ({
        restaurant_id: rid, user_id: s.userId, semaine_du: semaineDu,
        montant_salaire: s.salaire, montant_pourboires: s.pourboires, montant_total: s.total,
      }))
      const { error } = await supabase.from('virements')
        .upsert(rows, { onConflict: 'restaurant_id,user_id,semaine_du' })
      if (!error) {
        const { data: vData } = await supabase.from('virements')
          .select('*').eq('restaurant_id', rid).eq('semaine_du', semaineDu)
          .order('montant_total', { ascending: false })
        setVirements(vData || [])
      }
    } else {
      const { data: vData } = await supabase.from('virements')
        .select('*').eq('restaurant_id', rid).eq('semaine_du', semaineDu)
        .order('montant_total', { ascending: false })
      setVirements(vData || [])
    }
  }, [])

  const loadTrendData = useCallback(async (rid: string, offset: number, lang: 'fr' | 'en') => {
    const { start: s4 } = getWeekBounds(offset - 3)
    const { end } = getWeekBounds(offset)
    const MOIS = lang === 'fr' ? MOIS_FR : MOIS_EN
    const [psRes, heuresRes, empsRes] = await Promise.all([
      supabase.from('pool_shifts').select('pool_total,date')
        .eq('restaurant_id', rid).eq('statut', 'valide').gte('date', s4).lte('date', end),
      supabase.from('heures_employes').select('heures,user_id,date').gte('date', s4).lte('date', end),
      supabase.from('profiles').select('id,taux_horaire').contains('restaurant_ids', [rid]).eq('actif', true),
    ])
    const psShifts = psRes.data || []
    const heures = heuresRes.data || []
    const tauxMap: Record<string, number> = {}
    ;(empsRes.data || []).forEach((e: any) => { tauxMap[e.id] = e.taux_horaire || 0 })

    const weeks: WeekTrend[] = []
    for (let i = -3; i <= 0; i++) {
      const { start: ws, end: we, monday } = getWeekBounds(offset + i)
      const pool = psShifts
        .filter((s: any) => s.date >= ws && s.date <= we)
        .reduce((sum: number, s: any) => sum + (s.pool_total || 0), 0)
      const salaire = heures
        .filter((h: any) => h.date >= ws && h.date <= we)
        .reduce((sum: number, h: any) => sum + (h.heures || 0) * (tauxMap[h.user_id] || 0), 0)
      weeks.push({
        label: `${monday.getDate()} ${MOIS[monday.getMonth()]}`,
        pool: Math.round(pool * 100) / 100,
        salaire: Math.round(salaire * 100) / 100,
      })
    }
    setTrendData(weeks)
  }, [])

  const loadCotesData = useCallback(async (rid: string, offset: number, lang: 'fr' | 'en') => {
    const { start: s8 } = getWeekBounds(offset - 7)
    const { end } = getWeekBounds(offset)
    const MOIS = lang === 'fr' ? MOIS_FR : MOIS_EN
    const psRes = await supabase.from('pool_shifts').select('id,pool_total,date')
      .eq('restaurant_id', rid).eq('statut', 'valide').gte('date', s8).lte('date', end)
    const psShifts = psRes.data || []
    if (psShifts.length === 0) { setCotesData([]); return }

    const ids = psShifts.map((s: any) => s.id)
    const { data: heures } = await supabase.from('heures_employes')
      .select('montant_employe,pool_shift_id').in('pool_shift_id', ids)
    const heuresRows = heures || []

    const rows: CoteVerseeRow[] = []
    for (let i = -7; i <= 0; i++) {
      const { start: ws, end: we, monday } = getWeekBounds(offset + i)
      const weekShifts = psShifts.filter((s: any) => s.date >= ws && s.date <= we)
      if (weekShifts.length === 0) continue
      const weekIds = new Set(weekShifts.map((s: any) => s.id))
      const poolTotal = weekShifts.reduce((s: number, p: any) => s + (p.pool_total || 0), 0)
      const distribue = heuresRows
        .filter((h: any) => weekIds.has(h.pool_shift_id))
        .reduce((s: number, h: any) => s + (h.montant_employe || 0), 0)
      rows.push({
        label: `${monday.getDate()} ${MOIS[monday.getMonth()]}`,
        poolTotal: Math.round(poolTotal * 100) / 100,
        distribue: Math.round(distribue * 100) / 100,
        cotes: Math.round((poolTotal - distribue) * 100) / 100,
        nbServices: weekShifts.length,
      })
    }
    setCotesData(rows.reverse())
  }, [])

  useEffect(() => {
    if (!ctxRid || !profile) return
    const lang = (profile.lang || 'fr') as 'fr' | 'en'
    loadWeekData(ctxRid, weekOffset)
    loadTrendData(ctxRid, weekOffset, lang)
    loadCotesData(ctxRid, weekOffset, lang)
  }, [ctxRid, weekOffset, profile, loadWeekData, loadTrendData, loadCotesData])

  async function toggleVirement(v: Virement) {
    setSavingVirement(v.id)
    const newStatut: 'en_attente' | 'effectue' = v.statut === 'effectue' ? 'en_attente' : 'effectue'
    const update = {
      statut: newStatut,
      effectue_le: newStatut === 'effectue' ? new Date().toISOString() : null,
    }
    await supabase.from('virements').update(update).eq('id', v.id)
    setVirements(prev => prev.map(x => x.id === v.id ? { ...x, ...update } as Virement : x))
    setSavingVirement(null)
  }

  async function handleInsertPoolShift() {
    if (!poolModal || !ctxRid) return
    const { date, service, pool_total, notes } = poolModal
    if (!date || !service || !pool_total) return
    setSavingPool(true)
    setPoolError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/manage-pool-shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({
        action: 'insert',
        payload: { restaurant_id: ctxRid, date, service, pool_total, notes },
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPoolError(json.error || 'Erreur')
      setSavingPool(false)
      return
    }
    setPoolModal(null)
    const lang = (profile?.lang || 'fr') as 'fr' | 'en'
    loadWeekData(ctxRid, weekOffset)
    loadTrendData(ctxRid, weekOffset, lang)
    setSavingPool(false)
  }

  async function handleCalculate(shiftId: string) {
    setCalcShiftId(shiftId)
    setCalcLoading(true)
    setCalcError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/manage-pool-shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ action: 'calculate', payload: { pool_shift_id: shiftId } }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setCalcError(json.error || 'Erreur')
      setCalcLoading(false)
      return
    }
    setCalcShiftId(null)
    setCalcLoading(false)
    if (ctxRid) {
      const lang = (profile?.lang || 'fr') as 'fr' | 'en'
      loadWeekData(ctxRid, weekOffset)
      loadTrendData(ctxRid, weekOffset, lang)
    }
  }

  function exportCSV() {
    const lang = (profile?.lang || 'fr') as 'fr' | 'en'
    const R = ROLE_LBL[lang]
    const header = lang === 'fr'
      ? ['Employé', 'Rôle', 'Heures', 'Salaire', 'Pourboires', 'Total']
      : ['Employee', 'Role', 'Hours', 'Salary', 'Tips', 'Total']
    const rows = empSummaries.map(s => [
      s.nom, R[s.roles[0]] || s.roles[0] || '',
      s.heures.toFixed(2), s.salaire.toFixed(2), s.pourboires.toFixed(2), s.total.toFixed(2),
    ])
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const { monday } = getWeekBounds(weekOffset)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finances_${isoDate(monday)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="loading-screen"><div className="loading-dot">CHARGEMENT...</div></div>

  const lang = (profile?.lang || 'fr') as 'fr' | 'en'
  const font = profile?.font_family || 'Georgia, serif'
  const R = ROLE_LBL[lang]
  const MOIS = lang === 'fr' ? MOIS_FR : MOIS_EN
  const { monday } = getWeekBounds(weekOffset)

  const totalPool = weekPoolShifts.reduce((s: number, p: any) => s + (p.pool_total || 0), 0)
  const totalSalaire = empSummaries.reduce((s, e) => s + e.salaire, 0)
  const totalVirements = virements
    .filter(v => v.statut === 'effectue')
    .reduce((s, v) => s + v.montant_total, 0)
  const nbServices = weekPoolShifts.length

  return (
    <AppShell profile={profile} restaurant="Le Carré">
      <main className="page-content page-wrapper" style={{ paddingBottom: 88 }}>

        {/* Title + week navigation */}
        <div className="page-header">
          <h1 className="page-title">{lang === 'fr' ? 'Finances' : 'Finances'}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setWeekOffset(w => w - 1)} className="btn btn-ghost" style={{ width: 30, height: 30, padding: 0 }}>←</button>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', minWidth: 106 }}>
              {fmtWeekLabel(monday, lang)}
            </div>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              disabled={weekOffset >= 0}
              className="btn btn-ghost"
              style={{ width: 30, height: 30, padding: 0 }}
            >→</button>
            <button
              onClick={() => {
                const { start } = getWeekBounds(weekOffset)
                setPoolModal({ date: start, service: 'soir', pool_total: '', notes: '' })
                setPoolError('')
              }}
              style={{
                background: 'var(--accent)', border: 'none', borderRadius: 8,
                color: 'var(--accent-text)', fontSize: 18, width: 30, height: 30,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title={lang === 'fr' ? 'Ajouter un service' : 'Add service'}
            >+</button>
          </div>
        </div>

        {/* Services list */}
        {allPoolShifts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>
              {lang === 'fr' ? `Services (${allPoolShifts.length})` : `Services (${allPoolShifts.length})`}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allPoolShifts.map(ps => {
                const dt = new Date(ps.date + 'T00:00:00')
                const dateLbl = `${dt.getDate()} ${MOIS[dt.getMonth()]}`
                const svcLbl = ps.service === 'midi' ? (lang === 'fr' ? 'Midi' : 'Lunch')
                  : ps.service === 'soir' ? (lang === 'fr' ? 'Soir' : 'Dinner') : ps.service
                const isCalc = calcShiftId === ps.id
                return (
                  <div key={ps.id} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12 }}>{dateLbl}</span>
                        <span style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em',
                          background: ps.service === 'midi' ? 'var(--warning-subtle)' : 'var(--info-subtle)',
                          color: ps.service === 'midi' ? 'var(--warning)' : 'var(--info)',
                        }}>{svcLbl}</span>
                        <span style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em',
                          background: ps.statut === 'valide' ? 'var(--success-subtle)' : 'var(--warning-subtle)',
                          color: ps.statut === 'valide' ? 'var(--success)' : 'var(--warning)',
                        }}>
                          {ps.statut === 'valide' ? (lang === 'fr' ? 'Calculé' : 'Calculated') : (lang === 'fr' ? 'Brouillon' : 'Draft')}
                        </span>
                      </div>
                      {ps.notes && <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>{ps.notes}</div>}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--accent)', fontFamily: "'Courier New', monospace", flexShrink: 0 }}>
                      {fmt$(ps.pool_total || 0)}
                    </div>
                    {ps.statut === 'brouillon' && (
                      <button
                        onClick={() => handleCalculate(ps.id)}
                        disabled={isCalc}
                        style={{
                          background: 'var(--accent)', border: 'none', borderRadius: 8,
                          color: 'var(--accent-text)', fontSize: 10, padding: '5px 10px',
                          cursor: isCalc ? 'wait' : 'pointer', letterSpacing: '0.06em', flexShrink: 0,
                          opacity: isCalc ? 0.6 : 1,
                        }}
                      >
                        {isCalc ? '...' : (lang === 'fr' ? 'Calculer' : 'Calculate')}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {calcError && (
              <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6, padding: '6px 10px', background: 'var(--danger-subtle)', borderRadius: 8 }}>
                {calcError}
              </div>
            )}
          </div>
        )}

        {/* KPI cards */}
        <div className="kpi-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 20 }}>
          {([
            { label: lang === 'fr' ? 'Pool pourboires' : 'Tip pool',        value: fmt$(totalPool),      color: 'var(--accent)',  sub: `${nbServices} service${nbServices !== 1 ? 's' : ''}` },
            { label: lang === 'fr' ? 'Masse salariale' : 'Labor cost',      value: fmt$(totalSalaire),   color: 'var(--info)',    sub: '' },
            { label: lang === 'fr' ? 'Virements effectués' : 'Paid out',    value: fmt$(totalVirements), color: 'var(--success)', sub: '' },
            { label: lang === 'fr' ? 'Total employés' : 'Total employees',  value: String(empSummaries.length), color: 'var(--warning)', sub: '' },
          ] as { label: string; value: string; color: string; sub: string }[]).map(({ label, value, color, sub }) => (
            <div key={label} className="kpi-card">
              <div className="kpi-label">{label}</div>
              <div className="kpi-value" style={{ color, fontFamily: "'Courier New', monospace" }}>{value}</div>
              {sub ? <div className="kpi-sub">{sub}</div> : null}
            </div>
          ))}
        </div>

        {/* 4-week trend chart */}
        <div className="card" style={{ padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12 }}>
            {lang === 'fr' ? 'Tendance 4 semaines' : '4-week trend'}
          </div>
          <TrendChart data={trendData} font={font} />
        </div>

        {/* Per-employee table */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              {lang === 'fr' ? `Employés (${empSummaries.length})` : `Employees (${empSummaries.length})`}
            </div>
            {empSummaries.length > 0 && (
              <button onClick={exportCSV} className="btn btn-ghost" style={{ fontSize: 10, letterSpacing: '0.08em' }}>
                {lang === 'fr' ? 'CSV' : 'CSV'} ↓
              </button>
            )}
          </div>

          {empSummaries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-faint)', fontSize: 'var(--fz-sm)' }}>
              {lang === 'fr' ? 'Aucune donnée pour cette semaine' : 'No data for this week'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {empSummaries.map(emp => {
                const isOpen = expandedRows.has(emp.userId)
                const role0 = emp.roles[0] || ''
                const roleColor = ROLE_COLORS[role0] || 'var(--text-secondary)'
                const roleLbl = R[role0] || role0
                return (
                  <div key={emp.userId}>
                    <div
                      onClick={() => setExpandedRows(prev => {
                        const next = new Set(prev)
                        isOpen ? next.delete(emp.userId) : next.add(emp.userId)
                        return next
                      })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px',
                        background: 'var(--surface1)',
                        border: `1px solid ${isOpen ? 'var(--border-accent)' : 'var(--border)'}`,
                        borderRadius: isOpen ? '10px 10px 0 0' : 10,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.nom}</div>
                        <div style={{ fontSize: 10, color: roleColor, marginTop: 1 }}>{roleLbl}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Hrs</div>
                          <div style={{ fontSize: 12, fontFamily: "'Courier New', monospace" }}>{emp.heures.toFixed(1)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{lang === 'fr' ? 'Sal.' : 'Sal.'}</div>
                          <div style={{ fontSize: 12, color: 'var(--info)', fontFamily: "'Courier New', monospace" }}>{fmt$(emp.salaire)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{lang === 'fr' ? 'Pourb.' : 'Tips'}</div>
                          <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: "'Courier New', monospace" }}>{fmt$(emp.pourboires)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Total</div>
                          <div style={{ fontSize: 13, color: 'var(--success)', fontFamily: "'Courier New', monospace", fontWeight: 500 }}>{fmt$(emp.total)}</div>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-faint)', paddingBottom: 2 }}>{isOpen ? '▲' : '▼'}</div>
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{
                        background: 'var(--surface2)',
                        border: '1px solid var(--border-accent)', borderTop: 'none',
                        borderRadius: '0 0 10px 10px', padding: '10px 14px',
                      }}>
                        {emp.details.length === 0 ? (
                          <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', padding: '8px 0' }}>
                            {lang === 'fr' ? 'Aucun détail' : 'No details'}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {emp.details
                              .slice()
                              .sort((a, b) => a.date.localeCompare(b.date))
                              .map((d, idx) => {
                                const dt = new Date(d.date + 'T00:00:00')
                                const dateLbl = `${dt.getDate()} ${MOIS[dt.getMonth()]}`
                                const svcColor = d.service === 'midi' ? 'var(--warning)' : d.service === 'soir' ? 'var(--info)' : 'var(--text-muted)'
                                const svcLbl = d.service === 'midi' ? (lang === 'fr' ? 'Midi' : 'Lunch')
                                  : d.service === 'soir' ? (lang === 'fr' ? 'Soir' : 'Dinner') : d.service
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 48 }}>{dateLbl}</div>
                                    <div style={{
                                      fontSize: 9, color: svcColor, padding: '1px 6px',
                                      background: `${svcColor}18`, borderRadius: 4, minWidth: 36, textAlign: 'center',
                                    }}>{svcLbl}</div>
                                    <div style={{ flex: 1 }} />
                                    <div style={{ fontSize: 11, fontFamily: "'Courier New', monospace" }}>{d.heures.toFixed(2)}h</div>
                                    <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: "'Courier New', monospace", minWidth: 56, textAlign: 'right' }}>
                                      {d.tips > 0 ? fmt$(d.tips) : '—'}
                                    </div>
                                  </div>
                                )
                              })}
                          </div>
                        )}
                        <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 6, fontSize: 10, color: 'var(--text-faint)' }}>
                          {lang === 'fr' ? 'Taux' : 'Rate'}: {fmt$(emp.tauxHoraire)}/h
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Virements */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12 }}>
            {lang === 'fr' ? `Virements (${virements.length})` : `Payments (${virements.length})`}
          </div>
          {virements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-faint)', fontSize: 'var(--fz-sm)' }}>
              {lang === 'fr' ? 'Aucun virement pour cette semaine' : 'No payments for this week'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {virements.map(v => {
                const emp = empSummaries.find(e => e.userId === v.user_id)
                const isEffectue = v.statut === 'effectue'
                const isSaving = savingVirement === v.id
                return (
                  <div key={v.id} className="card" style={{
                    padding: '12px 14px',
                    borderLeft: `3px solid ${isEffectue ? 'var(--success)' : 'var(--border)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {emp?.nom || '—'}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {lang === 'fr' ? 'Sal.' : 'Sal.'} {fmt$(v.montant_salaire)}
                          {' + '}
                          {lang === 'fr' ? 'Pourb.' : 'Tips'} {fmt$(v.montant_pourboires)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 300, color: 'var(--success)', fontFamily: "'Courier New', monospace" }}>
                          {fmt$(v.montant_total)}
                        </div>
                        <button
                          onClick={() => toggleVirement(v)}
                          disabled={isSaving}
                          title={isEffectue
                            ? (lang === 'fr' ? 'Marquer en attente' : 'Mark as pending')
                            : (lang === 'fr' ? 'Marquer effectué' : 'Mark as paid')}
                          style={{
                            width: 36, height: 20, borderRadius: 10, border: 'none',
                            cursor: isSaving ? 'default' : 'pointer',
                            background: isEffectue ? 'var(--success)' : 'var(--surface2)',
                            position: 'relative', opacity: isSaving ? 0.5 : 1,
                            transition: 'background 0.2s', flexShrink: 0,
                          }}
                        >
                          <div style={{
                            position: 'absolute', top: 3,
                            left: isEffectue ? 18 : 2,
                            width: 14, height: 14, borderRadius: '50%',
                            background: isEffectue ? 'var(--surface1)' : 'var(--text-secondary)',
                            transition: 'left 0.2s',
                          }} />
                        </button>
                      </div>
                    </div>
                    {isEffectue && v.effectue_le && (
                      <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 6 }}>
                        ✓ {lang === 'fr' ? 'Effectué le' : 'Paid on'}{' '}
                        {new Date(v.effectue_le).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Cotes versées — 8 weeks history */}
        {cotesData.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12 }}>
              {lang === 'fr' ? 'Cotes versées — 8 semaines' : 'Deductions paid out — 8 weeks'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cotesData.map((row, i) => (
                <div key={i} className="card" style={{
                  padding: '10px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 12 }}>{row.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>
                      {row.nbServices} {lang === 'fr' ? 'service(s)' : 'service(s)'}
                      {' · '}
                      {lang === 'fr' ? 'distribué' : 'distributed'}: {fmt$(row.distribue)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, color: 'var(--danger)', fontFamily: "'Courier New', monospace" }}>
                      {fmt$(row.cotes)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                      / {fmt$(row.poolTotal)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ── POOL SHIFT MODAL ── */}
      {poolModal && (
        <div
          onClick={() => setPoolModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480, margin: '0 auto',
              background: 'var(--surface1)', borderRadius: '20px 20px 0 0',
              padding: '20px 18px 32px',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: 18, fontWeight: 300, margin: '0 0 20px', color: 'var(--text)' }}>
              {lang === 'fr' ? 'Nouveau service' : 'New service'}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {lang === 'fr' ? 'Date *' : 'Date *'}
                </div>
                <input
                  type="date"
                  value={poolModal.date}
                  onChange={e => setPoolModal(m => m ? { ...m, date: e.target.value } : m)}
                  style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {lang === 'fr' ? 'Service *' : 'Service *'}
                </div>
                <select
                  value={poolModal.service}
                  onChange={e => setPoolModal(m => m ? { ...m, service: e.target.value } : m)}
                  style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                >
                  <option value="midi">{lang === 'fr' ? 'Midi' : 'Lunch'}</option>
                  <option value="soir">{lang === 'fr' ? 'Soir' : 'Dinner'}</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                {lang === 'fr' ? 'Pool pourboires ($) *' : 'Tip pool ($) *'}
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={poolModal.pool_total}
                onChange={e => setPoolModal(m => m ? { ...m, pool_total: e.target.value } : m)}
                placeholder="0.00"
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '10px 12px', fontSize: 16, fontFamily: "'Courier New', monospace", outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                {lang === 'fr' ? 'Notes' : 'Notes'}
              </div>
              <input
                value={poolModal.notes}
                onChange={e => setPoolModal(m => m ? { ...m, notes: e.target.value } : m)}
                placeholder={lang === 'fr' ? 'Soirée spéciale, etc.' : 'Special event, etc.'}
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {poolError && (
              <div style={{ background: 'var(--danger-subtle)', border: '1px solid var(--danger)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: 'var(--danger)' }}>
                {poolError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPoolModal(null)}
                style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}
              >
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={handleInsertPoolShift}
                disabled={savingPool || !poolModal.date || !poolModal.pool_total}
                style={{
                  flex: 2, padding: '12px', background: 'var(--accent)', border: 'none', borderRadius: 10,
                  color: 'var(--accent-text)', cursor: savingPool ? 'wait' : 'pointer',
                  fontSize: 13, fontWeight: 600,
                  opacity: !poolModal.date || !poolModal.pool_total ? 0.5 : 1,
                }}
              >
                {savingPool ? '...' : (lang === 'fr' ? 'Créer le service' : 'Create service')}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  )
}
