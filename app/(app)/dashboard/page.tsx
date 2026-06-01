'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import KpiCard from '@/components/KpiCard'
import ShiftPill from '@/components/ShiftPill'
import { useAuth } from '@/lib/auth-context'

const MOIS_FR = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc']
const MOIS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const JOURS_FULL_FR = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const JOURS_FULL_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function isoDate(d: Date) { return d.toISOString().split('T')[0] }

function getWeekBounds() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0,0,0,0)
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5)
  return { monday, saturday }
}

export default function DashboardPage() {
  const { profile, userId, restaurantId, isManager, loading } = useAuth()
  const [todayShifts, setTodayShifts] = useState<any[]>([])
  const [nextShift, setNextShift] = useState<any>(null)
  const [pendingEchanges, setPendingEchanges] = useState(0)
  const [weekHeures, setWeekHeures] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [lastImport, setLastImport] = useState<string | null>(null)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [estimatedPay, setEstimatedPay] = useState<{ salaire: number; total: number } | null>(null)
  const router = useRouter()

  const loadData = useCallback(async () => {
    if (!profile || !userId) return
    const today = isoDate(new Date())
    const { monday, saturday } = getWeekBounds()

    const { count: notifCount } = await supabase.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId).eq('lu', false)
    setUnreadNotifs(notifCount || 0)

    if (isManager && restaurantId) {
      const { data: ts } = await supabase.from('horaire_shifts')
        .select('*, shift_types(*), profiles(nom,roles)')
        .eq('restaurant_id', restaurantId).eq('date', today).eq('statut', 'publie')
      setTodayShifts(ts || [])

      const { count: exchCount } = await supabase.from('echanges')
        .select('*', { count: 'exact', head: true }).eq('statut', 'en_attente_gerant')
      setPendingEchanges(exchCount || 0)

      const { data: weekShifts } = await supabase.from('horaire_shifts')
        .select('shift_types(debut,fin)').eq('restaurant_id', restaurantId).eq('statut', 'publie')
        .gte('date', isoDate(monday)).lte('date', isoDate(saturday))
      const totalH = (weekShifts || []).reduce((sum, s: any) => {
        const st = s.shift_types
        if (!st) return sum
        const [h1, m1] = st.debut.split(':').map(Number)
        const [h2, m2] = st.fin.split(':').map(Number)
        return sum + ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60
      }, 0)
      setWeekHeures(Math.round(totalH * 10) / 10)

      const { count: empCount } = await supabase.from('profiles')
        .select('*', { count: 'exact', head: true })
        .contains('restaurant_ids', [restaurantId]).eq('actif', true)
      setActiveCount(empCount || 0)

      const { data: lastH } = await supabase.from('heures_employes')
        .select('created_at').eq('source', 'import').order('created_at', { ascending: false }).limit(1)
      setLastImport(lastH?.[0]?.created_at || null)
    } else {
      const { data: upcomingShifts } = await supabase.from('horaire_shifts')
        .select('*, shift_types(*)')
        .eq('user_id', userId).eq('statut', 'publie').gte('date', today)
        .order('date', { ascending: true }).limit(1)
      setNextShift(upcomingShifts?.[0] || null)

      const { data: weekH } = await supabase.from('heures_employes')
        .select('heures').eq('user_id', userId)
        .gte('date', isoDate(monday)).lte('date', isoDate(saturday))
      const totalWeekH = (weekH || []).reduce((s, h) => s + (h.heures || 0), 0)
      const taux = profile?.taux_horaire || 0
      const salaire = Math.round(totalWeekH * 4) / 4 * taux
      setEstimatedPay({ salaire, total: salaire })
    }
  }, [profile, userId, restaurantId, isManager])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return <div className="loading-screen"><div className="loading-dot">CHARGEMENT…</div></div>

  const lang = (profile?.lang || 'fr') as 'fr' | 'en'
  const font = profile?.font_family || 'Georgia, serif'
  const prenom = profile?.nom?.split(' ')[0] || ''
  const MOIS = lang === 'fr' ? MOIS_FR : MOIS_EN
  const JOURS_FULL = lang === 'fr' ? JOURS_FULL_FR : JOURS_FULL_EN
  const today = new Date()
  const todayLabel = `${JOURS_FULL[today.getDay()]} ${today.getDate()} ${MOIS[today.getMonth()]}`

  function formatTime(ts: string) {
    const d = new Date(ts)
    return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`
  }

  return (
    <AppShell profile={profile} restaurant="Le Carré">
      <main className="page-content" style={{ paddingBottom: 88 }}>
        <div className="page-wrapper">

          {/* Welcome header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <h1 style={{ fontSize: 'var(--fz-2xl)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                {lang === 'fr' ? `Bonjour, ${prenom}` : `Hello, ${prenom}`}
              </h1>
            </div>
            <div style={{ fontSize: 'var(--fz-sm)', color: 'var(--text-muted)' }}>{todayLabel}</div>
          </div>

          {/* ─── MANAGER VIEW ─── */}
          {isManager && (
            <div className="md:grid md:grid-cols-[1fr_260px] md:gap-6">

              {/* Left column */}
              <div>
                {/* Today's schedule card */}
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>📅</span>
                    <span className="label-uppercase" style={{ color: 'var(--accent)' }}>
                      {lang === 'fr' ? "Aujourd'hui" : 'Today'} — {todayShifts.length} shift{todayShifts.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {todayShifts.length === 0 ? (
                      <p style={{ fontSize: 'var(--fz-sm)', color: 'var(--text-faint)', fontStyle: 'italic' }}>
                        {lang === 'fr' ? 'Aucun shift prévu' : 'No shifts scheduled'}
                      </p>
                    ) : todayShifts.map((s: any) => {
                      const st = s.shift_types
                      const couleur = st?.couleur
                      return (
                        <div key={s.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', background: 'var(--surface2)',
                          borderRadius: 'var(--radius-sm)',
                        }}>
                          {couleur && (
                            <div style={{ width: 3, height: 24, borderRadius: 2, background: couleur, flexShrink: 0 }} />
                          )}
                          <span style={{ fontSize: 'var(--fz-sm)', fontWeight: 500, flex: 1 }}>
                            {(s as any).profiles?.nom || '—'}
                          </span>
                          {st?.nom && (
                            <span style={{ fontSize: 'var(--fz-xs)', color: 'var(--text-secondary)' }}>{st.nom}</span>
                          )}
                          {st && (
                            <ShiftPill debut={st.debut} fin={st.fin}
                              color={couleur} bg={couleur ? `${couleur}18` : undefined}
                              compact />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* KPI grid */}
                <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  <button onClick={() => router.push('/horaire')} style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
                    <KpiCard
                      label={lang === 'fr' ? 'Échanges en attente' : 'Pending swaps'}
                      value={pendingEchanges}
                      icon="🔄"
                      iconBg="var(--warning-subtle)" iconColor="var(--warning)"
                      sub={pendingEchanges > 0 ? (lang === 'fr' ? 'à approuver' : 'to approve') : undefined}
                    />
                  </button>
                  <button onClick={() => router.push('/equipe')} style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
                    <KpiCard
                      label={lang === 'fr' ? 'Employés actifs' : 'Active staff'}
                      value={activeCount}
                      icon="👥"
                      iconBg="var(--success-subtle)" iconColor="var(--success)"
                    />
                  </button>
                  <KpiCard
                    label={lang === 'fr' ? 'Heures semaine' : 'Week hours'}
                    value={`${weekHeures}h`}
                    icon="⏱️"
                    iconBg="var(--info-subtle)" iconColor="var(--info)"
                  />
                  <button onClick={() => router.push('/import')} style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
                    <KpiCard
                      label={lang === 'fr' ? 'Dernier import' : 'Last import'}
                      value={lastImport ? formatTime(lastImport) : (lang === 'fr' ? 'Jamais' : 'Never')}
                      icon="📂"
                      iconBg="var(--surface2)" iconColor="var(--text-muted)"
                    />
                  </button>
                </div>
              </div>

              {/* Right column — desktop only */}
              <div className="hidden md:flex flex-col gap-4">
                <button onClick={() => router.push('/notifications')} style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
                  <KpiCard
                    label={lang === 'fr' ? 'Alertes' : 'Alerts'}
                    value={unreadNotifs}
                    icon="🔔"
                    iconBg={unreadNotifs > 0 ? 'var(--accent-subtle)' : 'var(--surface2)'}
                    iconColor={unreadNotifs > 0 ? 'var(--accent)' : 'var(--text-muted)'}
                    sub={unreadNotifs > 0 ? (lang === 'fr' ? 'non lues' : 'unread') : (lang === 'fr' ? 'Tout lu' : 'All read')}
                  />
                </button>
                <button onClick={() => router.push('/horaire')} className="card" style={{
                  all: 'unset', cursor: 'pointer', display: 'block',
                }}>
                  <div className="card" style={{ padding: '20px 22px' }}>
                    <div className="label-uppercase" style={{ marginBottom: 10 }}>
                      {lang === 'fr' ? 'Horaire' : 'Schedule'}
                    </div>
                    <p style={{ fontSize: 'var(--fz-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {lang === 'fr' ? 'Gérer les shifts de la semaine' : "Manage this week's shifts"}
                    </p>
                  </div>
                </button>
              </div>

            </div>
          )}

          {/* ─── EMPLOYEE VIEW ─── */}
          {!isManager && (
            <div style={{ maxWidth: 540 }}>
              {/* Next shift */}
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>📅</span>
                  <span className="label-uppercase" style={{ color: 'var(--accent)' }}>
                    {lang === 'fr' ? 'Mon prochain shift' : 'My next shift'}
                  </span>
                </div>
                <div className="card-body">
                  {nextShift ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 'var(--fz-md)', fontWeight: 500 }}>
                        {(() => {
                          const d = new Date(nextShift.date + 'T00:00:00')
                          return `${JOURS_FULL[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`
                        })()}
                      </div>
                      <ShiftPill
                        debut={nextShift.shift_types?.debut || ''}
                        fin={nextShift.shift_types?.fin || ''}
                        poste={nextShift.shift_types?.nom}
                        color={nextShift.shift_types?.couleur}
                        bg={nextShift.shift_types?.couleur ? `${nextShift.shift_types.couleur}18` : undefined}
                      />
                    </div>
                  ) : (
                    <p style={{ fontSize: 'var(--fz-sm)', color: 'var(--text-faint)', fontStyle: 'italic' }}>
                      {lang === 'fr' ? 'Aucun shift prévu' : 'No upcoming shifts'}
                    </p>
                  )}
                </div>
              </div>

              {/* Estimated pay */}
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>💰</span>
                    <span className="label-uppercase" style={{ color: 'var(--success)' }}>
                      {lang === 'fr' ? 'Paie estimée — semaine' : 'Estimated pay — week'}
                    </span>
                  </div>
                  <span className="badge badge-accent" style={{ fontSize: 'var(--fz-xs)', letterSpacing: '0.04em' }}>
                    {lang === 'fr' ? 'Estimation' : 'Estimate'}
                  </span>
                </div>
                <div className="card-body">
                  <div style={{ fontSize: 'var(--fz-3xl)', fontWeight: 700, color: 'var(--success)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    ${(estimatedPay?.total || 0).toFixed(2)}
                  </div>
                  {(estimatedPay?.salaire ?? 0) === 0 && (
                    <p style={{ fontSize: 'var(--fz-xs)', color: 'var(--text-faint)', marginTop: 8, fontStyle: 'italic' }}>
                      {lang === 'fr' ? 'En attente des heures importées' : 'Awaiting imported hours'}
                    </p>
                  )}
                </div>
              </div>

              {/* Notifications */}
              <button onClick={() => router.push('/notifications')} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>🔔</span>
                    <div>
                      <div style={{ fontSize: 'var(--fz-sm)', fontWeight: 500, color: 'var(--text)' }}>
                        {unreadNotifs > 0
                          ? (lang === 'fr' ? `${unreadNotifs} notification${unreadNotifs > 1 ? 's' : ''} non lue${unreadNotifs > 1 ? 's' : ''}` : `${unreadNotifs} unread`)
                          : (lang === 'fr' ? 'Aucune nouvelle' : 'All caught up')}
                      </div>
                      <div style={{ fontSize: 'var(--fz-xs)', color: 'var(--text-muted)' }}>
                        {lang === 'fr' ? 'Alertes' : 'Notifications'}
                      </div>
                    </div>
                  </div>
                  {unreadNotifs > 0 && (
                    <span className="badge badge-accent">{unreadNotifs}</span>
                  )}
                </div>
              </button>
            </div>
          )}

        </div>
      </main>
    </AppShell>
  )
}
