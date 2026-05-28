'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getTheme } from '@/lib/themes'
import type { Notification } from '@/types'

const TYPE_ICONS: Record<string, string> = {
  horaire: '📅',
  heures:  '⏱',
  echange: '🔄',
  system:  '⚙️',
}

const TYPE_COLORS: Record<string, string> = {
  horaire: '#7EB8F7',
  heures:  '#72BA80',
  echange: '#E0A850',
  system:  '#9BAFC0',
}

function timeAgo(dateStr: string, lang: 'fr' | 'en') {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  const hr  = Math.floor(diff / 3600000)
  const day = Math.floor(diff / 86400000)

  if (lang === 'fr') {
    if (min < 2)  return "À l'instant"
    if (min < 60) return `Il y a ${min} min`
    if (hr < 24)  return `Il y a ${hr}h`
    if (day < 7)  return `Il y a ${day}j`
    return new Date(dateStr).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })
  } else {
    if (min < 2)  return 'Just now'
    if (min < 60) return `${min}m ago`
    if (hr < 24)  return `${hr}h ago`
    if (day < 7)  return `${day}d ago`
    return new Date(dateStr).toLocaleDateString('en-CA', { day: 'numeric', month: 'short' })
  }
}

export default function NotificationsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState<string | null>(null)
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

      const { data: n } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setNotifs(n || [])
      setLoading(false)
    }
    load()
  }, [router])

  async function markAsRead(id: string) {
    setMarking(id)
    await supabase.from('notifications').update({ lu: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
    setMarking(null)
  }

  async function markAllRead() {
    const unreadIds = notifs.filter(n => !n.lu).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ lu: true }).in('id', unreadIds)
    setNotifs(prev => prev.map(n => ({ ...n, lu: true })))
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C9A84C', fontSize: 12, letterSpacing: '0.2em' }}>CHARGEMENT...</div>
    </div>
  )

  const t = getTheme(profile?.theme)
  const lang = (profile?.lang || 'fr') as 'fr' | 'en'
  const role = profile?.roles?.[0] || 'employe'
  const font = profile?.font_family || 'Georgia, serif'
  const unreadCount = notifs.filter(n => !n.lu).length

  return (
    <AppShell profile={profile} restaurant="Le Carré">
      <main style={{ padding: '16px', paddingBottom: 88 }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 300, margin: 0 }}>
              {lang === 'fr' ? 'Notifications' : 'Notifications'}
            </h1>
            {unreadCount > 0 && (
              <div style={{
                background: t.accent, color: t.isDark ? '#080808' : '#fff',
                borderRadius: 20, minWidth: 20, height: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, padding: '0 6px'
              }}>
                {unreadCount}
              </div>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{
              background: 'none', border: `1px solid ${t.border}`,
              color: t.texteSecondaire, borderRadius: 8, padding: '6px 12px',
              cursor: 'pointer', fontSize: 11, letterSpacing: '0.06em', fontFamily: font
            }}>
              {lang === 'fr' ? 'Tout lire' : 'Mark all read'}
            </button>
          )}
        </div>

        {notifs.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60, color: t.texteFaible }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
            <div style={{ fontSize: 14 }}>
              {lang === 'fr' ? 'Aucune notification' : 'No notifications'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {notifs.map(n => {
              const typeColor = TYPE_COLORS[n.type] || t.accent
              const icon = TYPE_ICONS[n.type] || '🔔'

              return (
                <button
                  key={n.id}
                  onClick={() => !n.lu && markAsRead(n.id)}
                  style={{
                    background: n.lu ? t.surface1 : `linear-gradient(135deg, ${t.surface2}, ${t.surface1})`,
                    border: `1px solid ${n.lu ? t.border : `${typeColor}44`}`,
                    borderRadius: 12, padding: '12px 14px',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    cursor: n.lu ? 'default' : 'pointer',
                    textAlign: 'left', width: '100%',
                    opacity: marking === n.id ? 0.5 : 1,
                    transition: 'opacity 0.2s',
                    fontFamily: font,
                  }}
                >
                  {/* Type icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: `${typeColor}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18
                  }}>
                    {icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: n.lu ? t.texteSecondaire : t.texte, lineHeight: 1.4, marginBottom: 4 }}>
                      {n.message}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: t.texteFaible }}>
                        {timeAgo(n.created_at, lang)}
                      </span>
                      <span style={{
                        fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: typeColor, opacity: 0.8
                      }}>
                        {n.type}
                      </span>
                    </div>
                  </div>

                  {/* Unread dot */}
                  {!n.lu && (
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: typeColor, flexShrink: 0, marginTop: 4
                    }} />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </main>

    </AppShell>
  )
}
