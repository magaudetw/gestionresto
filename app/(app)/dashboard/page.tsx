'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getTheme } from '@/lib/themes'

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
  const [profile, setProfile] = useState<any>(null)
  const [todayShifts, setTodayShifts] = useState<any[]>([])
  const [nextShift, setNextShift] = useState<any>(null)
  const [pendingEchanges, setPendingEchanges] = useState(0)
  const [weekHeures, setWeekHeures] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [lastImport, setLastImport] = useState<string | null>(null)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [estimatedPay, setEstimatedPay] = useState<{ salaire: number; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const user = session.user
      const { data: p, error: profileErr } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profileErr) { console.error('profiles:', profileErr.message); setLoading(false); return }
      if (!p) { router.push('/login'); return }
      setProfile(p)

      const isManager = p?.roles?.includes('gerant') || p?.roles?.includes('admin')
      const restaurantId = p?.restaurant_ids?.[0]
      const today = isoDate(new Date())
      const { monday, saturday } = getWeekBounds()

      // Unread notifications (all users)
      const { count: notifCount } = await supabase.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('lu', false)
      setUnreadNotifs(notifCount || 0)

      if (isManager) {
        // Today's shifts
        const { data: ts } = await supabase.from('horaire_shifts')
          .select('*, shift_types(*), profiles(nom,roles)')
          .eq('restaurant_id', restaurantId)
          .eq('date', today)
          .eq('statut', 'publie')
        setTodayShifts(ts || [])

        // Pending exchanges
        const { count: exchCount } = await supabase.from('echanges')
          .select('*', { count: 'exact', head: true })
          .eq('statut', 'en_attente_gerant')
        setPendingEchanges(exchCount || 0)

        // Week: total scheduled hours
        const { data: weekShifts } = await supabase.from('horaire_shifts')
          .select('shift_types(debut,fin)')
          .eq('restaurant_id', restaurantId)
          .eq('statut', 'publie')
          .gte('date', isoDate(monday))
          .lte('date', isoDate(saturday))
        const totalH = (weekShifts || []).reduce((sum, s: any) => {
          const st = s.shift_types
          if (!st) return sum
          const [h1, m1] = st.debut.split(':').map(Number)
          const [h2, m2] = st.fin.split(':').map(Number)
          return sum + ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60
        }, 0)
        setWeekHeures(Math.round(totalH * 10) / 10)

        // Active employees
        const { count: empCount } = await supabase.from('profiles')
          .select('*', { count: 'exact', head: true })
          .contains('restaurant_ids', restaurantId ? [restaurantId] : []).eq('actif', true)
        setActiveCount(empCount || 0)

        // Last import
        const { data: lastH } = await supabase.from('heures_employes')
          .select('created_at').eq('source', 'import').order('created_at', { ascending: false }).limit(1)
        setLastImport(lastH?.[0]?.created_at || null)
      } else {
        // Employee: next shift
        const { data: upcomingShifts } = await supabase.from('horaire_shifts')
          .select('*, shift_types(*)')
          .eq('user_id', user.id)
          .eq('statut', 'publie')
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(1)
        setNextShift(upcomingShifts?.[0] || null)

        // Estimated pay this week
        const { data: weekH } = await supabase.from('heures_employes')
          .select('heures')
          .eq('user_id', user.id)
          .gte('date', isoDate(monday))
          .lte('date', isoDate(saturday))
        const totalWeekH = (weekH || []).reduce((s, h) => s + (h.heures || 0), 0)
        const taux = p?.taux_horaire || 0
        const salaire = Math.round(totalWeekH * 4) / 4 * taux
        setEstimatedPay({ salaire, total: salaire })
      }

      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C9A84C', fontSize: 12, letterSpacing: '0.2em' }}>CHARGEMENT...</div>
    </div>
  )

  const t = getTheme(profile?.theme)
  const lang = (profile?.lang || 'fr') as 'fr' | 'en'
  const role = profile?.roles?.[0] || 'employe'
  const font = profile?.font_family || 'Georgia, serif'
  const isManager = role === 'gerant' || role === 'admin'
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
      <main className="animate-fade-up px-4 pt-5 pb-[88px] md:px-10 md:pt-10 md:pb-10">

        {/* Welcome */}
        <div className="mb-6 md:mb-8">
          <p style={{ fontSize: 12, color: t.texteSecondaire, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {lang === 'fr' ? 'Bon retour' : 'Welcome back'}
          </p>
          <h1 className="font-title" style={{ fontSize: 36, fontWeight: 300, marginBottom: 3, color: t.texte, letterSpacing: '0.01em' }}>{prenom}</h1>
          <div style={{ fontSize: 12, color: t.texteFaible }}>{todayLabel}</div>
        </div>

        {/* ─── MANAGER VIEW ─── */}
        {isManager && (
          <>
            {/* Desktop 2-col wrapper */}
            <div className="md:grid md:grid-cols-[1fr_280px] md:gap-6">
            {/* Left col on desktop */}
            <div>

            {/* Today's schedule */}
            <div className="glass-light card-shadow stagger-1 animate-fade-up" style={{ borderRadius: 14, padding: '16px 18px', marginBottom: 12, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.accent, marginBottom: 10 }}>
                {lang === 'fr' ? "Aujourd'hui" : 'Today'}
              </div>
              {todayShifts.length === 0 ? (
                <div style={{ fontSize: 13, color: t.texteFaible }}>{lang === 'fr' ? 'Aucun shift prévu' : 'No shifts scheduled'}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {todayShifts.map((s: any) => {
                    const st = s.shift_types
                    const couleur = st?.couleur || t.accent
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 3, height: 24, borderRadius: 2, background: couleur, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: t.texte }}>{(s as any).profiles?.nom || '—'}</span>
                        <span style={{ fontSize: 11, color: t.texteSecondaire }}>· {st?.nom}</span>
                        <span style={{ fontSize: 11, color: t.texteFaible, marginLeft: 'auto' }}>{st?.debut}–{st?.fin}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* KPI grid — 2 cols mobile, 4 cols desktop */}
            <div className="stagger-2 animate-fade-up grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
              {/* Pending exchanges */}
              <button onClick={() => router.push('/horaire')} style={{
                background: pendingEchanges > 0 ? 'rgba(224,160,80,0.1)' : t.surface1,
                border: `1px solid ${pendingEchanges > 0 ? 'rgba(224,160,80,0.35)' : t.border}`,
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', fontFamily: font,
              }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 6 }}>
                  {lang === 'fr' ? 'Échanges' : 'Swaps'}
                </div>
                <div style={{ fontSize: 24, fontWeight: 300, color: pendingEchanges > 0 ? '#E0A850' : t.texteSecondaire }}>
                  {pendingEchanges}
                </div>
                {pendingEchanges > 0 && (
                  <div style={{ fontSize: 10, color: '#E0A850', marginTop: 2 }}>
                    {lang === 'fr' ? 'en attente' : 'pending'}
                  </div>
                )}
              </button>

              {/* Active employees */}
              <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 6 }}>
                  {lang === 'fr' ? 'Employés actifs' : 'Active staff'}
                </div>
                <div style={{ fontSize: 24, fontWeight: 300, color: '#72BA80' }}>{activeCount}</div>
              </div>

              {/* Week hours */}
              <div style={{ background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 6 }}>
                  {lang === 'fr' ? 'Heures semaine' : 'Week hours'}
                </div>
                <div style={{ fontSize: 24, fontWeight: 300, color: '#7EB8F7' }}>{weekHeures}h</div>
              </div>

              {/* Last import */}
              <button onClick={() => router.push('/import')} style={{
                background: t.surface1, border: `1px solid ${t.border}`,
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', fontFamily: font,
              }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.texteSecondaire, marginBottom: 6 }}>
                  {lang === 'fr' ? 'Dernier import' : 'Last import'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 300, color: lastImport ? t.texte : t.texteFaible }}>
                  {lastImport ? formatTime(lastImport) : (lang === 'fr' ? 'Jamais' : 'Never')}
                </div>
              </button>
            </div>

            </div> {/* end left col */}

            {/* Right col: unread notifications quick link */}
            <div className="hidden md:flex flex-col gap-3">
              <button onClick={() => router.push('/notifications')} style={{
                background: unreadNotifs > 0 ? `${t.accent}12` : t.surface1,
                border: `1px solid ${unreadNotifs > 0 ? t.borderAccent : t.border}`,
                borderRadius: 14, padding: '18px 20px', cursor: 'pointer', textAlign: 'left', fontFamily: font,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: unreadNotifs > 0 ? t.accent : t.texteSecondaire }}>
                  {lang === 'fr' ? 'Alertes' : 'Alerts'}
                </div>
                <div style={{ fontSize: 32, fontWeight: 300, color: unreadNotifs > 0 ? t.accent : t.texteSecondaire }}>
                  {unreadNotifs}
                </div>
                <div style={{ fontSize: 11, color: unreadNotifs > 0 ? t.texteSecondaire : t.texteFaible }}>
                  {unreadNotifs > 0 ? (lang === 'fr' ? 'non lues' : 'unread') : (lang === 'fr' ? 'Tout lu' : 'All read')}
                </div>
              </button>
              <button onClick={() => router.push('/equipe')} style={{
                background: t.surface1, border: `1px solid ${t.border}`,
                borderRadius: 14, padding: '18px 20px', cursor: 'pointer', textAlign: 'left', fontFamily: font,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.texteSecondaire }}>
                  {lang === 'fr' ? 'Effectif actif' : 'Active staff'}
                </div>
                <div style={{ fontSize: 32, fontWeight: 300, color: '#72BA80' }}>{activeCount}</div>
              </button>
            </div>

            </div> {/* end desktop 2-col wrapper */}
          </>
        )}

        {/* ─── EMPLOYEE VIEW ─── */}
        {!isManager && (
          <>
            {/* Next shift */}
            <div className="animate-fade-up" style={{
              background: nextShift
                ? `linear-gradient(135deg, ${t.accent}22, ${t.accentClair}0A)`
                : t.surface1,
              border: `1px solid ${nextShift ? t.borderAccent : t.border}`,
              borderRadius: 14, padding: '16px 18px', marginBottom: 12,
            }}>
              <div style={{ fontSize: 11, color: t.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                {lang === 'fr' ? 'Mon prochain shift' : 'My next shift'}
              </div>
              {nextShift ? (
                <>
                  <div style={{ fontSize: 16, color: t.texte, marginBottom: 6 }}>
                    {(() => {
                      const d = new Date(nextShift.date + 'T00:00:00')
                      return `${JOURS_FULL[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11,
                      background: `${nextShift.shift_types?.couleur || t.accent}22`,
                      border: `1px solid ${nextShift.shift_types?.couleur || t.accent}55`,
                      color: nextShift.shift_types?.couleur || t.accent,
                    }}>
                      {nextShift.shift_types?.nom} · {nextShift.shift_types?.debut}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: t.texteFaible }}>
                  {lang === 'fr' ? 'Aucun shift prévu' : 'No upcoming shifts'}
                </div>
              )}
            </div>

            {/* Estimated pay */}
            <div style={{ background: 'rgba(114,186,128,0.08)', border: '1px solid rgba(114,186,128,0.25)', borderRadius: 14, padding: '16px 18px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: '#72BA80', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {lang === 'fr' ? 'Paie estimée cette semaine' : 'Estimated pay this week'}
                </div>
                <span style={{ fontSize: 9, color: t.texteFaible, border: `1px solid ${t.border}`, borderRadius: 4, padding: '2px 5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {lang === 'fr' ? 'Estimation' : 'Estimate'}
                </span>
              </div>
              <div style={{ fontSize: 30, fontWeight: 300, color: '#72BA80', fontFamily: "'Courier New', monospace" }}>
                ${(estimatedPay?.total || 0).toFixed(2)}
              </div>
              {(estimatedPay?.salaire ?? 0) === 0 && (
                <div style={{ fontSize: 11, color: t.texteFaible, marginTop: 4 }}>
                  {lang === 'fr' ? 'En attente des heures importées' : 'Awaiting imported hours'}
                </div>
              )}
            </div>

            {/* Notifications */}
            <button onClick={() => router.push('/notifications')} style={{
              width: '100%', background: unreadNotifs > 0 ? `${t.accent}12` : t.surface1,
              border: `1px solid ${unreadNotifs > 0 ? t.borderAccent : t.border}`,
              borderRadius: 14, padding: '14px 18px', cursor: 'pointer', textAlign: 'left', fontFamily: font,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 11, color: unreadNotifs > 0 ? t.accent : t.texteSecondaire, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  🔔 {lang === 'fr' ? 'Notifications' : 'Notifications'}
                </div>
                <div style={{ fontSize: 13, color: t.texte }}>
                  {unreadNotifs > 0
                    ? (lang === 'fr' ? `${unreadNotifs} non lue${unreadNotifs > 1 ? 's' : ''}` : `${unreadNotifs} unread`)
                    : (lang === 'fr' ? 'Aucune nouvelle' : 'All caught up')}
                </div>
              </div>
              {unreadNotifs > 0 && (
                <div style={{
                  background: t.accent, color: t.isDark ? '#080808' : '#fff',
                  borderRadius: 20, minWidth: 26, height: 26, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600,
                }}>
                  {unreadNotifs}
                </div>
              )}
            </button>
          </>
        )}
      </main>

    </AppShell>
  )
}
