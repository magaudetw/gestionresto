'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getTheme } from '@/lib/themes'
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

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#9CA3AF', fontSize: 'var(--fz-12)', letterSpacing: '0.2em' }}>CHARGEMENT…</div>
    </div>
  )

  const t = getTheme(profile?.theme)
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

  const card = (extra?: object) => ({
    background: t.surface1,
    border: `1px solid ${t.border}`,
    borderRadius: 14,
    boxShadow: t.isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
    ...extra,
  })

  return (
    <AppShell profile={profile} restaurant="Le Carré">
      <main className="page-content" style={{ paddingBottom: 88 }}>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 0' }}>

          {/* Welcome header */}
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 'var(--fz-12)', color: t.texteSecondaire, marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {lang === 'fr' ? 'Bon retour' : 'Welcome back'}
            </p>
            <h1 className="font-title" style={{ fontSize: 'var(--fz-38)', fontWeight: 300, marginBottom: 4, color: t.texte, letterSpacing: '0.01em' }}>
              {prenom}
            </h1>
            <div style={{ fontSize: 'var(--fz-13)', color: t.texteFaible }}>{todayLabel}</div>
          </div>

          {/* ─── MANAGER VIEW ─── */}
          {isManager && (
            <div className="md:grid md:grid-cols-[1fr_260px] md:gap-6">

              {/* Left column */}
              <div>
                {/* Today's schedule card */}
                <div style={{ ...card(), padding: '20px 22px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 'var(--fz-18)' }}>📅</span>
                    <span style={{ fontSize: 'var(--fz-11)', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.accent, fontWeight: 600 }}>
                      {lang === 'fr' ? "Aujourd'hui" : 'Today'}
                    </span>
                  </div>
                  {todayShifts.length === 0 ? (
                    <div style={{ fontSize: 'var(--fz-13)', color: t.texteFaible, fontStyle: 'italic' }}>
                      {lang === 'fr' ? 'Aucun shift prévu' : 'No shifts scheduled'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {todayShifts.map((s: any) => {
                        const st = s.shift_types
                        const couleur = st?.couleur || t.accent
                        return (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: t.surface2, borderRadius: 8, minHeight: 44 }}>
                            <div style={{ width: 3, height: 28, borderRadius: 2, background: couleur, flexShrink: 0 }} />
                            <span style={{ fontSize: 'var(--fz-13)', color: t.texte, fontWeight: 500, flex: 1 }}>{(s as any).profiles?.nom || '—'}</span>
                            <span style={{ fontSize: 'var(--fz-11)', color: t.texteSecondaire }}>{st?.nom}</span>
                            <span style={{ fontSize: 'var(--fz-11)', color: t.texteFaible, fontFamily: "'Courier New', monospace" }}>{st?.debut}–{st?.fin}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* KPI grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }} className="md:grid-cols-4">

                  {/* Échanges */}
                  <button onClick={() => router.push('/horaire')} style={{
                    ...card(),
                    padding: '20px 20px 18px', cursor: 'pointer', textAlign: 'left', fontFamily: font,
                    borderTop: `3px solid ${pendingEchanges > 0 ? '#F59E0B' : t.border}`,
                    transition: 'box-shadow 0.15s', minHeight: 112,
                  }}>
                    <div style={{ fontSize: 'var(--fz-22)', marginBottom: 10 }}>🔄</div>
                    <div style={{ fontSize: 'var(--fz-10)', letterSpacing: '0.08em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 6 }}>
                      {lang === 'fr' ? 'Échanges' : 'Swaps'}
                    </div>
                    <div style={{ fontSize: 'var(--fz-28)', fontWeight: 300, color: pendingEchanges > 0 ? '#F59E0B' : t.texte, lineHeight: 1 }}>
                      {pendingEchanges}
                    </div>
                    {pendingEchanges > 0 && (
                      <div style={{ fontSize: 'var(--fz-10)', color: '#F59E0B', marginTop: 4 }}>
                        {lang === 'fr' ? 'en attente' : 'pending'}
                      </div>
                    )}
                  </button>

                  {/* Employés actifs */}
                  <button onClick={() => router.push('/equipe')} style={{
                    ...card(),
                    padding: '20px 20px 18px', cursor: 'pointer', textAlign: 'left', fontFamily: font,
                    borderTop: `3px solid #10B981`, minHeight: 112,
                  }}>
                    <div style={{ fontSize: 'var(--fz-22)', marginBottom: 10 }}>👥</div>
                    <div style={{ fontSize: 'var(--fz-10)', letterSpacing: '0.08em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 6 }}>
                      {lang === 'fr' ? 'Employés actifs' : 'Active staff'}
                    </div>
                    <div style={{ fontSize: 'var(--fz-28)', fontWeight: 300, color: '#10B981', lineHeight: 1 }}>{activeCount}</div>
                  </button>

                  {/* Heures semaine */}
                  <div style={{
                    ...card(),
                    padding: '20px 20px 18px',
                    borderTop: `3px solid #3B82F6`, minHeight: 112,
                  }}>
                    <div style={{ fontSize: 'var(--fz-22)', marginBottom: 10 }}>⏱️</div>
                    <div style={{ fontSize: 'var(--fz-10)', letterSpacing: '0.08em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 6 }}>
                      {lang === 'fr' ? 'Heures semaine' : 'Week hours'}
                    </div>
                    <div style={{ fontSize: 'var(--fz-28)', fontWeight: 300, color: '#3B82F6', lineHeight: 1 }}>{weekHeures}<span style={{ fontSize: 'var(--fz-14)' }}>h</span></div>
                  </div>

                  {/* Dernier import */}
                  <button onClick={() => router.push('/import')} style={{
                    ...card(),
                    padding: '20px 20px 18px', cursor: 'pointer', textAlign: 'left', fontFamily: font,
                    borderTop: `3px solid ${t.border}`, minHeight: 112,
                  }}>
                    <div style={{ fontSize: 'var(--fz-22)', marginBottom: 10 }}>📂</div>
                    <div style={{ fontSize: 'var(--fz-10)', letterSpacing: '0.08em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 6 }}>
                      {lang === 'fr' ? 'Dernier import' : 'Last import'}
                    </div>
                    <div style={{ fontSize: 'var(--fz-13)', fontWeight: 400, color: lastImport ? t.texte : t.texteFaible, lineHeight: 1.4 }}>
                      {lastImport ? formatTime(lastImport) : (lang === 'fr' ? 'Jamais' : 'Never')}
                    </div>
                  </button>
                </div>
              </div>

              {/* Right column — desktop only */}
              <div className="hidden md:flex flex-col gap-4">
                <button onClick={() => router.push('/notifications')} style={{
                  ...card(),
                  padding: '22px 24px', cursor: 'pointer', textAlign: 'left', fontFamily: font,
                  display: 'flex', flexDirection: 'column', gap: 10,
                  borderTop: `3px solid ${unreadNotifs > 0 ? t.accent : t.border}`,
                }}>
                  <div style={{ fontSize: 'var(--fz-24)' }}>🔔</div>
                  <div style={{ fontSize: 'var(--fz-10)', letterSpacing: '0.1em', textTransform: 'uppercase', color: unreadNotifs > 0 ? t.accent : t.texteSecondaire }}>
                    {lang === 'fr' ? 'Alertes' : 'Alerts'}
                  </div>
                  <div style={{ fontSize: 'var(--fz-34)', fontWeight: 300, color: unreadNotifs > 0 ? t.accent : t.texte, lineHeight: 1 }}>
                    {unreadNotifs}
                  </div>
                  <div style={{ fontSize: 'var(--fz-11)', color: t.texteSecondaire }}>
                    {unreadNotifs > 0 ? (lang === 'fr' ? 'non lues' : 'unread') : (lang === 'fr' ? 'Tout lu' : 'All read')}
                  </div>
                </button>

                <button onClick={() => router.push('/horaire')} style={{
                  ...card(),
                  padding: '22px 24px', cursor: 'pointer', textAlign: 'left', fontFamily: font,
                  display: 'flex', flexDirection: 'column', gap: 10,
                  borderTop: `3px solid #10B981`,
                }}>
                  <div style={{ fontSize: 'var(--fz-24)' }}>📋</div>
                  <div style={{ fontSize: 'var(--fz-10)', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.texteSecondaire }}>
                    {lang === 'fr' ? 'Horaire' : 'Schedule'}
                  </div>
                  <div style={{ fontSize: 'var(--fz-12)', color: t.texteSecondaire, lineHeight: 1.5 }}>
                    {lang === 'fr' ? 'Gérer les shifts de la semaine' : 'Manage this week\'s shifts'}
                  </div>
                </button>
              </div>

            </div>
          )}

          {/* ─── EMPLOYEE VIEW ─── */}
          {!isManager && (
            <div style={{ maxWidth: 540 }}>
              {/* Next shift */}
              <div style={{
                ...card(),
                padding: '20px 22px', marginBottom: 14,
                borderTop: `3px solid ${nextShift ? t.accent : t.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 'var(--fz-18)' }}>📅</span>
                  <span style={{ fontSize: 'var(--fz-11)', color: t.accent, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                    {lang === 'fr' ? 'Mon prochain shift' : 'My next shift'}
                  </span>
                </div>
                {nextShift ? (
                  <>
                    <div style={{ fontSize: 'var(--fz-16)', color: t.texte, marginBottom: 8, fontWeight: 500 }}>
                      {(() => {
                        const d = new Date(nextShift.date + 'T00:00:00')
                        return `${JOURS_FULL[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`
                      })()}
                    </div>
                    <span style={{
                      display: 'inline-flex', padding: '4px 12px', borderRadius: 20, fontSize: 'var(--fz-12)',
                      background: `${nextShift.shift_types?.couleur || t.accent}18`,
                      border: `1px solid ${nextShift.shift_types?.couleur || t.accent}44`,
                      color: nextShift.shift_types?.couleur || t.accent,
                    }}>
                      {nextShift.shift_types?.nom} · {nextShift.shift_types?.debut}
                    </span>
                  </>
                ) : (
                  <div style={{ fontSize: 'var(--fz-13)', color: t.texteFaible, fontStyle: 'italic' }}>
                    {lang === 'fr' ? 'Aucun shift prévu' : 'No upcoming shifts'}
                  </div>
                )}
              </div>

              {/* Estimated pay */}
              <div style={{
                ...card(),
                padding: '20px 22px', marginBottom: 14,
                borderTop: `3px solid #10B981`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 'var(--fz-18)' }}>💰</span>
                  <div>
                    <div style={{ fontSize: 'var(--fz-11)', color: '#10B981', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                      {lang === 'fr' ? 'Paie estimée cette semaine' : 'Estimated pay this week'}
                    </div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 'var(--fz-9)', color: t.texteFaible, border: `1px solid ${t.border}`, borderRadius: 4, padding: '2px 6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {lang === 'fr' ? 'Estimation' : 'Estimate'}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--fz-32)', fontWeight: 300, color: '#10B981', fontFamily: "'Courier New', monospace", lineHeight: 1 }}>
                  ${(estimatedPay?.total || 0).toFixed(2)}
                </div>
                {(estimatedPay?.salaire ?? 0) === 0 && (
                  <div style={{ fontSize: 'var(--fz-11)', color: t.texteFaible, marginTop: 8, fontStyle: 'italic' }}>
                    {lang === 'fr' ? 'En attente des heures importées' : 'Awaiting imported hours'}
                  </div>
                )}
              </div>

              {/* Notifications */}
              <button onClick={() => router.push('/notifications')} style={{
                width: '100%',
                ...card(),
                padding: '16px 20px', cursor: 'pointer', textAlign: 'left', fontFamily: font,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderTop: `3px solid ${unreadNotifs > 0 ? t.accent : t.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 'var(--fz-20)' }}>🔔</span>
                  <div>
                    <div style={{ fontSize: 'var(--fz-13)', color: t.texte, fontWeight: 500 }}>
                      {unreadNotifs > 0
                        ? (lang === 'fr' ? `${unreadNotifs} notification${unreadNotifs > 1 ? 's' : ''} non lue${unreadNotifs > 1 ? 's' : ''}` : `${unreadNotifs} unread`)
                        : (lang === 'fr' ? 'Aucune nouvelle' : 'All caught up')}
                    </div>
                    <div style={{ fontSize: 'var(--fz-11)', color: t.texteFaible }}>
                      {lang === 'fr' ? 'Alertes' : 'Notifications'}
                    </div>
                  </div>
                </div>
                {unreadNotifs > 0 && (
                  <div style={{
                    background: t.accent, color: '#fff',
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
