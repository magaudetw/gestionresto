'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
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
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 'var(--fz-12)', color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {lang === 'fr' ? 'Bon retour' : 'Welcome back'}
            </p>
            <h1 className="font-title" style={{ fontSize: 'var(--fz-38)', fontWeight: 300, marginBottom: 4, letterSpacing: '0.01em' }}>
              {prenom}
            </h1>
            <div style={{ fontSize: 'var(--fz-13)', color: 'var(--text-muted)' }}>{todayLabel}</div>
          </div>

          {/* ─── MANAGER VIEW ─── */}
          {isManager && (
            <div className="md:grid md:grid-cols-[1fr_260px] md:gap-6">

              {/* Left column */}
              <div>
                {/* Today's schedule card */}
                <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 'var(--fz-18)' }}>📅</span>
                    <span style={{ fontSize: 'var(--fz-11)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600 }}>
                      {lang === 'fr' ? "Aujourd'hui" : 'Today'}
                    </span>
                  </div>
                  {todayShifts.length === 0 ? (
                    <div style={{ fontSize: 'var(--fz-13)', color: 'var(--text-faint)', fontStyle: 'italic' }}>
                      {lang === 'fr' ? 'Aucun shift prévu' : 'No shifts scheduled'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {todayShifts.map((s: any) => {
                        const st = s.shift_types
                        const couleur = st?.couleur || 'var(--accent)'
                        return (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, minHeight: 44 }}>
                            <div style={{ width: 3, height: 28, borderRadius: 2, background: couleur, flexShrink: 0 }} />
                            <span style={{ fontSize: 'var(--fz-13)', fontWeight: 500, flex: 1 }}>{(s as any).profiles?.nom || '—'}</span>
                            <span style={{ fontSize: 'var(--fz-11)', color: 'var(--text-secondary)' }}>{st?.nom}</span>
                            <span style={{ fontSize: 'var(--fz-11)', color: 'var(--text-muted)', fontFamily: "'Courier New', monospace" }}>{st?.debut}–{st?.fin}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* KPI grid */}
                <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>

                  {/* Échanges */}
                  <button onClick={() => router.push('/horaire')} className="kpi-card" style={{
                    cursor: 'pointer', textAlign: 'left', fontFamily: font,
                    borderTop: `3px solid ${pendingEchanges > 0 ? 'var(--warning)' : 'var(--border)'}`,
                  }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', marginBottom: 12, background: 'var(--warning-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fz-lg)' }}>🔄</div>
                    <div className="kpi-label">{lang === 'fr' ? 'Échanges' : 'Swaps'}</div>
                    <div className="kpi-value" style={{ color: pendingEchanges > 0 ? 'var(--warning)' : 'var(--text)' }}>
                      {pendingEchanges}
                    </div>
                    {pendingEchanges > 0 && (
                      <div className="kpi-sub" style={{ color: 'var(--warning)' }}>
                        {lang === 'fr' ? 'en attente' : 'pending'}
                      </div>
                    )}
                  </button>

                  {/* Employés actifs */}
                  <button onClick={() => router.push('/equipe')} className="kpi-card" style={{
                    cursor: 'pointer', textAlign: 'left', fontFamily: font,
                    borderTop: '3px solid var(--success)',
                  }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', marginBottom: 12, background: 'var(--success-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fz-lg)' }}>👥</div>
                    <div className="kpi-label">{lang === 'fr' ? 'Employés actifs' : 'Active staff'}</div>
                    <div className="kpi-value" style={{ color: 'var(--success)' }}>{activeCount}</div>
                  </button>

                  {/* Heures semaine */}
                  <div className="kpi-card" style={{ borderTop: '3px solid var(--info)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', marginBottom: 12, background: 'var(--info-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fz-lg)' }}>⏱️</div>
                    <div className="kpi-label">{lang === 'fr' ? 'Heures semaine' : 'Week hours'}</div>
                    <div className="kpi-value" style={{ color: 'var(--info)' }}>
                      {weekHeures}<span style={{ fontSize: 'var(--fz-14)' }}>h</span>
                    </div>
                  </div>

                  {/* Dernier import */}
                  <button onClick={() => router.push('/import')} className="kpi-card" style={{
                    cursor: 'pointer', textAlign: 'left', fontFamily: font,
                    borderTop: '3px solid var(--border)',
                  }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', marginBottom: 12, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fz-lg)' }}>📂</div>
                    <div className="kpi-label">{lang === 'fr' ? 'Dernier import' : 'Last import'}</div>
                    <div style={{ fontSize: 'var(--fz-13)', fontWeight: 400, color: lastImport ? 'var(--text)' : 'var(--text-faint)', lineHeight: 1.4, marginTop: 8 }}>
                      {lastImport ? formatTime(lastImport) : (lang === 'fr' ? 'Jamais' : 'Never')}
                    </div>
                  </button>

                </div>
              </div>

              {/* Right column — desktop only */}
              <div className="hidden md:flex flex-col gap-4">
                <button onClick={() => router.push('/notifications')} className="card" style={{
                  padding: '22px 24px', cursor: 'pointer', textAlign: 'left', fontFamily: font,
                  display: 'flex', flexDirection: 'column', gap: 10,
                  borderTop: `3px solid ${unreadNotifs > 0 ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                  <div style={{ fontSize: 'var(--fz-24)' }}>🔔</div>
                  <div style={{ fontSize: 'var(--fz-10)', letterSpacing: '0.1em', textTransform: 'uppercase', color: unreadNotifs > 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {lang === 'fr' ? 'Alertes' : 'Alerts'}
                  </div>
                  <div className="kpi-value" style={{ color: unreadNotifs > 0 ? 'var(--accent)' : 'var(--text)' }}>
                    {unreadNotifs}
                  </div>
                  <div style={{ fontSize: 'var(--fz-11)', color: 'var(--text-secondary)' }}>
                    {unreadNotifs > 0 ? (lang === 'fr' ? 'non lues' : 'unread') : (lang === 'fr' ? 'Tout lu' : 'All read')}
                  </div>
                </button>

                <button onClick={() => router.push('/horaire')} className="card" style={{
                  padding: '22px 24px', cursor: 'pointer', textAlign: 'left', fontFamily: font,
                  display: 'flex', flexDirection: 'column', gap: 10,
                  borderTop: '3px solid var(--success)',
                }}>
                  <div style={{ fontSize: 'var(--fz-24)' }}>📋</div>
                  <div style={{ fontSize: 'var(--fz-10)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    {lang === 'fr' ? 'Horaire' : 'Schedule'}
                  </div>
                  <div style={{ fontSize: 'var(--fz-12)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {lang === 'fr' ? 'Gérer les shifts de la semaine' : "Manage this week's shifts"}
                  </div>
                </button>
              </div>

            </div>
          )}

          {/* ─── EMPLOYEE VIEW ─── */}
          {!isManager && (
            <div style={{ maxWidth: 540 }}>
              {/* Next shift */}
              <div className="card" style={{
                padding: '20px 22px', marginBottom: 14,
                borderTop: `3px solid ${nextShift ? 'var(--accent)' : 'var(--border)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 'var(--fz-18)' }}>📅</span>
                  <span style={{ fontSize: 'var(--fz-11)', color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                    {lang === 'fr' ? 'Mon prochain shift' : 'My next shift'}
                  </span>
                </div>
                {nextShift ? (
                  <>
                    <div style={{ fontSize: 'var(--fz-16)', fontWeight: 500, marginBottom: 8 }}>
                      {(() => {
                        const d = new Date(nextShift.date + 'T00:00:00')
                        return `${JOURS_FULL[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`
                      })()}
                    </div>
                    <span style={{
                      display: 'inline-flex', padding: '4px 12px', borderRadius: 20, fontSize: 'var(--fz-12)',
                      background: nextShift.shift_types?.couleur ? `${nextShift.shift_types.couleur}18` : 'var(--accent-subtle)',
                      border: `1px solid ${nextShift.shift_types?.couleur ? `${nextShift.shift_types.couleur}44` : 'var(--border-accent)'}`,
                      color: nextShift.shift_types?.couleur || 'var(--accent)',
                    }}>
                      {nextShift.shift_types?.nom} · {nextShift.shift_types?.debut}
                    </span>
                  </>
                ) : (
                  <div style={{ fontSize: 'var(--fz-13)', color: 'var(--text-faint)', fontStyle: 'italic' }}>
                    {lang === 'fr' ? 'Aucun shift prévu' : 'No upcoming shifts'}
                  </div>
                )}
              </div>

              {/* Estimated pay */}
              <div className="card" style={{
                padding: '20px 22px', marginBottom: 14,
                borderTop: '3px solid var(--success)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 'var(--fz-18)' }}>💰</span>
                  <div>
                    <div style={{ fontSize: 'var(--fz-11)', color: 'var(--success)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                      {lang === 'fr' ? 'Paie estimée cette semaine' : 'Estimated pay this week'}
                    </div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 'var(--fz-9)', color: 'var(--text-faint)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {lang === 'fr' ? 'Estimation' : 'Estimate'}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--fz-32)', fontWeight: 300, color: 'var(--success)', fontFamily: "'Courier New', monospace", lineHeight: 1 }}>
                  ${(estimatedPay?.total || 0).toFixed(2)}
                </div>
                {(estimatedPay?.salaire ?? 0) === 0 && (
                  <div style={{ fontSize: 'var(--fz-11)', color: 'var(--text-faint)', marginTop: 8, fontStyle: 'italic' }}>
                    {lang === 'fr' ? 'En attente des heures importées' : 'Awaiting imported hours'}
                  </div>
                )}
              </div>

              {/* Notifications */}
              <button onClick={() => router.push('/notifications')} className="card" style={{
                width: '100%',
                padding: '16px 20px', cursor: 'pointer', textAlign: 'left', fontFamily: font,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderTop: `3px solid ${unreadNotifs > 0 ? 'var(--accent)' : 'var(--border)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 'var(--fz-20)' }}>🔔</span>
                  <div>
                    <div style={{ fontSize: 'var(--fz-13)', fontWeight: 500 }}>
                      {unreadNotifs > 0
                        ? (lang === 'fr' ? `${unreadNotifs} notification${unreadNotifs > 1 ? 's' : ''} non lue${unreadNotifs > 1 ? 's' : ''}` : `${unreadNotifs} unread`)
                        : (lang === 'fr' ? 'Aucune nouvelle' : 'All caught up')}
                    </div>
                    <div style={{ fontSize: 'var(--fz-11)', color: 'var(--text-faint)' }}>
                      {lang === 'fr' ? 'Alertes' : 'Notifications'}
                    </div>
                  </div>
                </div>
                {unreadNotifs > 0 && (
                  <div style={{
                    background: 'var(--accent)', color: 'var(--accent-text)',
                    borderRadius: 20, minWidth: 26, height: 26, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fz-13)', fontWeight: 600,
                  }}>
                    {unreadNotifs}
                  </div>
                )}
              </button>
            </div>
          )}

        </div>
      </main>
    </AppShell>
  )
}
